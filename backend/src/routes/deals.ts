import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess } from "../lib/rbac.js";

const newAccountSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
});

const dealSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().uuid().optional(),
  newAccount: newAccountSchema.optional(), // inline account creation — Account is no longer a hard prerequisite
  opportunityId: z.string().uuid().optional().nullable(), // a Deal may optionally reference an Opportunity
  contactId: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  closeDate: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid(),
  probability: z.number().int().min(0).max(100).optional(),
  dealType: z.string().optional().nullable(),
  forecastCategory: z.enum(["PIPELINE", "BEST_CASE", "COMMIT", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  description: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

export default async function dealRoutes(app: FastifyInstance) {
  app.get("/api/v1/deals", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string;
      includeArchived?: string; forecastCategory?: string; amountMin?: string; amountMax?: string;
      won?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "25")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where = {
      tenantId: req.authUser.tenantId,
      ...rbacFilter,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.won === "true"
        ? {
            OR: [
              { stage: { isWon: true } },
              { stage: { name: { in: ["Proposal Won", "Closed Won", "Won"], mode: "insensitive" as const } } },
              { forecastCategory: "CLOSED_WON" as const },
            ],
          }
        : {}),
      ...(q.forecastCategory ? { forecastCategory: q.forecastCategory as any } : {}),
      ...(q.amountMin || q.amountMax
        ? { amount: { ...(q.amountMin ? { gte: Number(q.amountMin) } : {}), ...(q.amountMax ? { lte: Number(q.amountMax) } : {}) } }
        : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, ownerId: true, owner: { select: { id: true, firstName: true, lastName: true } } } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
          contacts: { include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } } },
          stage: true,
          pipeline: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  // EXPORT — CSV of deals matching current filters
  app.get("/api/v1/deals/export", { preHandler: app.authenticate }, async (req, reply) => {
    const q = req.query as {
      search?: string;
      accountId?: string;
      ownerId?: string;
      stageId?: string;
      pipelineId?: string;
      won?: string;
      includeArchived?: string;
    };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.won === "true"
        ? {
            OR: [
              { stage: { isWon: true } },
              { stage: { name: { in: ["Proposal Won", "Closed Won", "Won"], mode: "insensitive" as const } } },
              { forecastCategory: "CLOSED_WON" as const },
            ],
          }
        : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    const deals = await prisma.deal.findMany({
      where,
      include: {
        account: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        stage: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const rows = deals.map((d) => ({
      name: d.name,
      account: d.account?.name || "",
      contactPerson: d.contact ? `${d.contact.firstName} ${d.contact.lastName}` : "",
      amount: Number(d.amount),
      stage: d.stage.name,
      owner: d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "",
      closeDate: d.closeDate ? d.closeDate.toISOString().slice(0, 10) : "",
      probability: `${d.probability}%`,
      dealType: d.dealType || "New Business",
      createdAt: d.createdAt ? d.createdAt.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "name", label: "Deal Name" },
      { key: "account", label: "Account" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "amount", label: "Deal Value" },
      { key: "stage", label: "Stage" },
      { key: "owner", label: "Owner" },
      { key: "closeDate", label: "Close Date" },
      { key: "probability", label: "Probability" },
      { key: "dealType", label: "Deal Type" },
      { key: "createdAt", label: "Created Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="deals.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → duplicate check → preview/commit
  app.post("/api/v1/deals/import", { preHandler: app.authenticate }, async (req, reply) => {
    const importSchema = z.object({
      rows: z.array(z.record(z.string())),
      mapping: z.record(z.string()),
      commit: z.boolean().default(false),
      createMissingAccount: z.boolean().default(true),
      createMissingContact: z.boolean().default(true),
      duplicateStrategy: z.enum(["skip", "create_new", "update_existing"]).default("skip"),
      rowDecisions: z.record(z.enum(["skip", "create_new", "update_existing"])).optional(),
    });

    const body = importSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const [dealPipeline, users, accounts, contacts] = await Promise.all([
      prisma.pipeline.findFirst({ where: { tenantId, type: "DEAL" }, include: { stages: { orderBy: { order: "asc" } } } }),
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
      prisma.contact.findMany({ where: { tenantId, archived: false } }),
    ]);

    if (!dealPipeline || !dealPipeline.stages.length) {
      return reply.code(400).send({ error: "Deal pipeline not configured for workspace" });
    }

    const stageMap = new Map(dealPipeline.stages.map((s) => [s.name.toLowerCase().trim(), s]));
    const allowedStages = dealPipeline.stages.map((s) => s.name);

    const results: {
      row: number;
      status: "valid" | "duplicate" | "error";
      error?: string;
      duplicateDetails?: { existingName: string; accountName: string; existingId: string };
      data?: any;
    }[] = [];

    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const mapped: Record<string, string> = {};
      for (const [field, column] of Object.entries(body.mapping)) {
        if (column && raw[column] !== undefined) mapped[field] = String(raw[column]).trim();
      }

      const name = mapped.name || mapped.dealName;
      const accountName = mapped.account || mapped.companyName || mapped.company;
      const contactPersonName = mapped.contactPerson || mapped.contact;
      const amountStr = mapped.amount || mapped.dealValue || mapped.value;
      const stageName = mapped.stage || mapped.dealStage;
      const ownerName = mapped.owner || mapped.assignedTo;
      const closeDateStr = mapped.closeDate || mapped.expectedCloseDate;
      const remarks = mapped.remarks || mapped.description;

      if (!name) {
        results.push({ row: i, status: "error", error: "Deal Name is required" });
        continue;
      }
      if (!accountName) {
        results.push({ row: i, status: "error", error: "Account is required" });
        continue;
      }

      let parsedAmount = 0;
      if (amountStr !== undefined && amountStr !== "") {
        const clean = amountStr.replace(/[^0-9.-]+/g, "");
        parsedAmount = Number(clean);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          results.push({ row: i, status: "error", error: `Deal Value must be a valid positive number (got "${amountStr}")` });
          continue;
        }
      } else {
        results.push({ row: i, status: "error", error: "Deal Value is required" });
        continue;
      }

      let stage = dealPipeline.stages[0];
      if (stageName) {
        const matched = stageMap.get(stageName.toLowerCase().trim());
        if (!matched) {
          results.push({
            row: i,
            status: "error",
            error: `Invalid Deal Stage "${stageName}". Allowed: ${allowedStages.join(", ")}`,
          });
          continue;
        }
        stage = matched;
      }

      let closeDate: Date | null = null;
      if (closeDateStr) {
        const d = new Date(closeDateStr);
        if (isNaN(d.getTime())) {
          results.push({ row: i, status: "error", error: `Invalid Close Date "${closeDateStr}"` });
          continue;
        }
        closeDate = d;
      }

      // Owner resolution
      let owner = users.find((u) => u.id === req.authUser.id) || users[0];
      if (ownerName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === ownerName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === ownerName.toLowerCase() ||
            u.firstName.toLowerCase() === ownerName.toLowerCase()
        );
        if (found) owner = found;
      }

      // Account resolution
      let existingAccount = accounts.find((a) => a.name.toLowerCase().trim() === accountName.toLowerCase().trim());
      if (!existingAccount && !body.createMissingAccount && !body.commit) {
        results.push({ row: i, status: "error", error: `Account "${accountName}" does not exist and auto-creation is disabled` });
        continue;
      }

      // Duplicate detection
      const existingDeal = await prisma.deal.findFirst({
        where: {
          tenantId,
          archived: false,
          name: { equals: name, mode: "insensitive" },
          ...(existingAccount ? { accountId: existingAccount.id } : {}),
        },
      });

      const isDuplicate = !!existingDeal;
      const previewData = {
        name,
        account: accountName,
        contactPerson: contactPersonName || "—",
        amount: parsedAmount,
        stage: stage.name,
        owner: `${owner.firstName} ${owner.lastName}`,
        closeDate: closeDate ? closeDate.toISOString().slice(0, 10) : "—",
      };

      const decision = body.rowDecisions?.[i] || body.duplicateStrategy;

      if (isDuplicate && !body.commit) {
        results.push({
          row: i,
          status: "duplicate",
          duplicateDetails: {
            existingName: existingDeal.name,
            accountName: accountName,
            existingId: existingDeal.id,
          },
          data: previewData,
        });
        continue;
      }

      if (isDuplicate && body.commit && decision === "skip") {
        results.push({ row: i, status: "duplicate", data: previewData });
        continue;
      }

      if (body.commit) {
        let accountId = existingAccount?.id;
        if (!accountId && body.createMissingAccount) {
          const newAcc = await prisma.account.create({
            data: {
              tenantId,
              name: accountName,
              ownerId: owner.id,
            },
          });
          accounts.push(newAcc);
          accountId = newAcc.id;
        }

        let contactId: string | null = null;
        if (contactPersonName && accountId) {
          const parts = contactPersonName.split(" ");
          const firstName = parts[0] || contactPersonName;
          const lastName = parts.slice(1).join(" ") || "Contact";
          let existingContact = contacts.find(
            (c) =>
              c.accountId === accountId &&
              (`${c.firstName} ${c.lastName}`.toLowerCase() === contactPersonName.toLowerCase() ||
                c.email?.toLowerCase() === contactPersonName.toLowerCase())
          );
          if (!existingContact && body.createMissingContact) {
            existingContact = await prisma.contact.create({
              data: {
                tenantId,
                accountId,
                firstName,
                lastName,
                ownerId: owner.id,
              },
            });
            contacts.push(existingContact);
          }
          if (existingContact) contactId = existingContact.id;
        }

        if (isDuplicate && decision === "update_existing" && existingDeal) {
          await prisma.deal.update({
            where: { id: existingDeal.id },
            data: {
              amount: parsedAmount,
              stageId: stage.id,
              probability: stage.probability,
              closeDate,
              ownerId: owner.id,
              contactId: contactId || undefined,
              description: remarks || undefined,
            },
          });
        } else {
          await prisma.deal.create({
            data: {
              tenantId,
              pipelineId: dealPipeline.id,
              stageId: stage.id,
              accountId: accountId!,
              contactId,
              ownerId: owner.id,
              name,
              amount: parsedAmount,
              probability: stage.probability,
              closeDate,
              description: remarks || null,
            },
          });
        }
      }

      results.push({ row: i, status: "valid", data: previewData });
    }

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.status === "valid").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      errors: results.filter((r) => r.status === "error").length,
      committed: body.commit,
    };

    return { summary, results };
  });

  app.post("/api/v1/deals", { preHandler: app.authenticate }, async (req, reply) => {
    const body = dealSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    if (!body.accountId && !body.newAccount) {
      return reply.code(400).send({ error: "Account is required — select an existing account or create a new one" });
    }

    const [account, stage, opportunity] = await Promise.all([
      body.accountId ? prisma.account.findFirst({ where: { id: body.accountId, tenantId } }) : Promise.resolve(null),
      prisma.pipelineStage.findFirst({ where: { id: body.stageId, pipelineId: body.pipelineId, pipeline: { tenantId } } }),
      body.opportunityId ? prisma.opportunity.findFirst({ where: { id: body.opportunityId, tenantId } }) : Promise.resolve(null),
    ]);
    if (body.accountId && !account) return reply.code(400).send({ error: "Account not found for this tenant" });
    if (!stage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });
    if (body.opportunityId && !opportunity) return reply.code(400).send({ error: "Opportunity not found for this tenant" });

    const deal = await prisma.$transaction(async (tx) => {
      let accountId = body.accountId;
      if (!accountId && body.newAccount) {
        const newAcc = await tx.account.create({
          data: { tenantId, name: body.newAccount.name, domain: body.newAccount.domain || null, industry: body.newAccount.industry || null, phone: body.newAccount.phone || null, website: body.newAccount.website || null, ownerId: body.ownerId },
        });
        accountId = newAcc.id;
      }
      const allContactIds = new Set<string>();
      if (body.contactId) allContactIds.add(body.contactId);
      if (body.contactIds) body.contactIds.forEach((id) => allContactIds.add(id));

      const d = await tx.deal.create({
        data: {
          tenantId,
          name: body.name,
          accountId: accountId!,
          opportunityId: body.opportunityId || null,
          contactId: body.contactId || null,
          amount: body.amount,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          closeDate: body.closeDate ? new Date(body.closeDate) : null,
          ownerId: body.ownerId,
          createdById: req.authUser.id,
          probability: body.probability ?? stage.probability,
          dealType: body.dealType,
          forecastCategory: body.forecastCategory,
          description: body.description,
          properties: body.properties ?? {},
          contacts: allContactIds.size > 0 ? { create: Array.from(allContactIds).map((contactId) => ({ contactId })) } : undefined,
        },
      });
      await tx.dealStageHistory.create({ data: { dealId: d.id, toStageId: body.stageId, changedById: req.authUser.id } });
      return d;
    });

    await logAudit({ tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: deal.id, action: "CREATED", newValues: deal });
    return reply.code(201).send(deal);
  });

  app.get("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deal = await prisma.deal.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        opportunity: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { include: { contact: true } },
        lineItems: { include: { product: true } },
        quotes: true,
        activities: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
      },
    });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    await requireCanAccess(req.authUser, deal, "read");
    return deal;
  });

  app.patch("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = dealSchema.partial().parse(req.body);
    const existing = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Deal not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const stageChanged = body.stageId && body.stageId !== existing.stageId;
    let targetStage = null;
    if (stageChanged) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId ?? existing.pipelineId },
      });
      if (!targetStage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });

      // Business rule: a Closed Won deal must have amount and close date (defaults to today if not provided).
      if (targetStage.isClosed && targetStage.isWon) {
        const amount = body.amount ?? existing.amount;
        if (!amount || Number(amount) <= 0) return reply.code(400).send({ error: "A valid amount is required to mark a deal Closed Won" });
      }
    }

    const { contactIds, ...rest } = body;
    const deal = await prisma.$transaction(async (tx) => {
      const isClosingWon = !!targetStage?.isClosed && targetStage.isWon;
      const isClosingLost = !!targetStage?.isClosed && !targetStage.isWon;

      const finalCloseDate = rest.closeDate
        ? new Date(rest.closeDate)
        : (isClosingWon ? (existing.closeDate ?? new Date()) : undefined);

      const updated = await tx.deal.update({
        where: { id },
        data: {
          ...rest,
          ...(finalCloseDate !== undefined && { closeDate: finalCloseDate }),
          probability: stageChanged ? targetStage!.probability : rest.probability,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : rest.forecastCategory,
          wonDate: isClosingWon ? (existing.wonDate ?? new Date()) : undefined,
        },
      });

      if (stageChanged) {
        await tx.dealStageHistory.create({
          data: { dealId: id, fromStageId: existing.stageId, toStageId: body.stageId!, changedById: req.authUser.id },
        });
      }
      if (contactIds) {
        await tx.dealContact.deleteMany({ where: { dealId: id } });
        await tx.dealContact.createMany({ data: contactIds.map((contactId) => ({ dealId: id, contactId })) });
      }
      if (isClosingWon) {
        // Bump the account's revenue metrics safely.
        const acct = await tx.account.findUnique({ where: { id: updated.accountId } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const newRev = currentRev + Number(updated.amount);
          await tx.account.update({
            where: { id: updated.accountId },
            data: { annualRevenue: newRev },
          });
        }
      }
      return updated;
    });

    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: id,
      action: stageChanged ? "STAGE_CHANGED" : "UPDATED", oldValues: existing, newValues: deal,
    });

    if (targetStage?.isClosed) {
      await notify({
        tenantId: req.authUser.tenantId, userId: deal.ownerId,
        message: `Deal "${deal.name}" was marked ${targetStage.isWon ? "Closed Won 🎉" : "Closed Lost"}`,
        link: `/deals/${deal.id}`,
      });
    }

    return deal;
  });

  app.delete("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Deal not found" });
    await prisma.deal.delete({ where: { id } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: id, action: "DELETED", oldValues: existing });
    return reply.code(204).send();
  });

  // --- Line items (Products on a Deal) ---
  const lineItemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    discountPct: z.number().min(0).max(100).optional(),
    taxPct: z.number().min(0).max(100).optional(),
  });

  app.post("/api/v1/deals/:id/line-items", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse(req.body);
    const deal = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId: req.authUser.tenantId } });
    if (!product) return reply.code(400).send({ error: "Product not found" });
    if (!product.active) return reply.code(400).send({ error: "Inactive products cannot be added" });

    const unitPrice = Number(product.unitPrice);
    const subtotal = body.quantity * unitPrice;
    const discountAmount = subtotal * ((body.discountPct ?? 0) / 100);
    const taxable = subtotal - discountAmount;
    const total = taxable + taxable * ((body.taxPct ?? 0) / 100);

    const lineItem = await prisma.lineItem.create({
      data: {
        productId: body.productId,
        dealId: id,
        quantity: body.quantity,
        unitPrice,
        discountPct: body.discountPct ?? 0,
        taxPct: body.taxPct ?? 0,
        total,
      },
    });

    // Recompute deal amount as sum of line items.
    const items = await prisma.lineItem.findMany({ where: { dealId: id } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.deal.update({ where: { id }, data: { amount: newAmount } });

    return reply.code(201).send(lineItem);
  });

  app.delete("/api/v1/deals/:dealId/line-items/:lineItemId", { preHandler: app.authenticate }, async (req, reply) => {
    const { dealId, lineItemId } = req.params as { dealId: string; lineItemId: string };
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId: req.authUser.tenantId } });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    await prisma.lineItem.delete({ where: { id: lineItemId } });
    const items = await prisma.lineItem.findMany({ where: { dealId } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.deal.update({ where: { id: dealId }, data: { amount: newAmount } });
    return reply.code(204).send();
  });

  app.post("/api/v1/deals/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Deal not found" });
    const deal = await prisma.deal.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: id, action: "ARCHIVED" });
    return deal;
  });

  app.post("/api/v1/deals/bulk", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1),
      action: z.enum(["assignOwner", "changeStage", "archive"]),
      ownerId: z.string().uuid().optional(),
      stageId: z.string().uuid().optional(),
    }).parse(req.body);

    const tenantId = req.authUser.tenantId;
    const scoped = await prisma.deal.findMany({ where: { id: { in: body.ids }, tenantId }, select: { id: true } });
    const ids = scoped.map((d) => d.id);
    if (!ids.length) return reply.code(404).send({ error: "No matching deals found" });

    let data: any = {};
    if (body.action === "assignOwner") {
      if (!body.ownerId) return reply.code(400).send({ error: "ownerId is required" });
      data = { ownerId: body.ownerId };
    } else if (body.action === "changeStage") {
      if (!body.stageId) return reply.code(400).send({ error: "stageId is required" });
      const stage = await prisma.pipelineStage.findFirst({ where: { id: body.stageId, pipeline: { tenantId } } });
      if (!stage) return reply.code(400).send({ error: "Invalid stage" });
      data = { stageId: body.stageId, probability: stage.probability };
    } else if (body.action === "archive") {
      data = { archived: true };
    }

    await prisma.deal.updateMany({ where: { id: { in: ids }, tenantId }, data });
    await logAudit({ tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: ids.join(","), action: `BULK_${body.action.toUpperCase()}`, newValues: data });
    return { updated: ids.length };
  });
}
