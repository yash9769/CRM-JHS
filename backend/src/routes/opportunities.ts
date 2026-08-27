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
  ownerId: z.string().uuid().optional(),
});

const newContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
});

const opportunitySchema = z.object({
  name: z.string().min(1, "Opportunity name is required"),
  accountId: z.string().uuid().optional(),
  newAccount: newAccountSchema.optional(),
  contactId: z.string().uuid().optional().nullable(),
  newContact: newContactSchema.optional(),
  amount: z.number({ invalid_type_error: "Opportunity value must be a number" }).nonnegative("Opportunity value must be non-negative"),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid("Opportunity Stage is required"),
  probability: z.number().int().min(0).max(100).optional(),
  createdAt: z.string().datetime().optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  actualCloseDate: z.string().datetime().optional().nullable(),
  wonDate: z.string().datetime().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  dealType: z.string().optional().nullable(),
  forecastCategory: z.enum(["PIPELINE", "BEST_CASE", "COMMIT", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  ownerId: z.string().uuid("Assigned To is required"),
  opportunityType: z.enum(["NEW_BUSINESS", "EXPANSION", "RENEWAL"]).optional(),
  leadSource: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

const lineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
});

export default async function opportunityRoutes(app: FastifyInstance) {
  app.get("/api/v1/opportunities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string;
      includeArchived?: string; amountMin?: string; amountMax?: string; leadSource?: string;
      won?: string; forecastCategory?: string;
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
      ...(q.forecastCategory ? { forecastCategory: q.forecastCategory as any } : {}),
      ...(q.leadSource ? { leadSource: q.leadSource } : {}),
      ...(q.amountMin || q.amountMax
        ? { amount: { ...(q.amountMin ? { gte: Number(q.amountMin) } : {}), ...(q.amountMax ? { lte: Number(q.amountMax) } : {}) } }
        : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              jobTitle: true,
            },
          },
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

  // EXPORT — CSV of opportunities matching current filters
  app.get("/api/v1/opportunities/export", { preHandler: app.authenticate }, async (req, reply) => {
    const q = req.query as { search?: string; accountId?: string; ownerId?: string; stageId?: string; includeArchived?: string; won?: string };
    const where = {
      tenantId: req.authUser.tenantId,
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
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    const opps = await prisma.opportunity.findMany({
      where,
      include: {
        account: { select: { name: true, owner: { select: { firstName: true, lastName: true } } } },
        contact: { select: { firstName: true, lastName: true } },
        stage: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const rows = opps.map((o) => ({
      accountOwner: o.account?.owner ? `${o.account.owner.firstName} ${o.account.owner.lastName}` : "",
      account: o.account?.name || "",
      contactPerson: o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : "",
      name: o.name,
      stage: o.stage.name,
      amount: Number(o.amount),
      dealType: o.dealType || o.opportunityType || "NEW_BUSINESS",
      forecastCategory: o.forecastCategory,
      remarks: o.description || "",
      assignedTo: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "",
      createdDate: o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "",
      closeDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString().slice(0, 10) : "",
      actualCloseDate: o.actualCloseDate ? o.actualCloseDate.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "accountOwner", label: "Account Owner" },
      { key: "account", label: "Account" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "name", label: "Opportunity Name" },
      { key: "stage", label: "Stage" },
      { key: "amount", label: "Opportunity Value" },
      { key: "dealType", label: "Type" },
      { key: "forecastCategory", label: "Forecast Category" },
      { key: "remarks", label: "Remarks" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "createdDate", label: "Created Date" },
      { key: "closeDate", label: "Expected Close Date" },
      { key: "actualCloseDate", label: "Actual Close Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="opportunities.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → duplicate check → preview/commit
  app.post("/api/v1/opportunities/import", { preHandler: app.authenticate }, async (req, reply) => {
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

    const [oppPipeline, users, accounts, contacts] = await Promise.all([
      prisma.pipeline.findFirst({ where: { tenantId, type: "OPPORTUNITY" }, include: { stages: { orderBy: { order: "asc" } } } }),
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
      prisma.contact.findMany({ where: { tenantId, archived: false } }),
    ]);

    if (!oppPipeline || !oppPipeline.stages.length) {
      return reply.code(400).send({ error: "Opportunity pipeline not configured for workspace" });
    }

    const oppStageMap = new Map(oppPipeline.stages.map((s) => [s.name.toLowerCase().trim(), s]));
    const allowedOppStages = oppPipeline.stages.map((s) => s.name);

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

      const oppName = mapped.name || mapped.opportunityName || mapped.dealName;
      const accountName = mapped.account || mapped.companyName || mapped.company;
      const amountStr = mapped.amount || mapped.dealValue || mapped.value;
      const oppStageName = mapped.opportunityStage || mapped.stage || mapped.dealStage;
      const contactPersonName = mapped.contactPerson || mapped.contact;
      const accountOwnerName = mapped.accountOwner;
      const assignedToName = mapped.assignedTo || mapped.owner;
      const remarks = mapped.remarks || mapped.description || "";
      const createdDateStr = mapped.createdDate || mapped.createdAt;
      const closeDateStr = mapped.closeDate || mapped.expectedCloseDate;

      if (!oppName) {
        results.push({ row: i, status: "error", error: "Opportunity Name is required" });
        continue;
      }
      if (!accountName) {
        results.push({ row: i, status: "error", error: "Account is required" });
        continue;
      }

      let parsedAmount = 0;
      if (amountStr !== undefined && amountStr !== "") {
        const cleanAmount = amountStr.replace(/[^0-9.-]+/g, "");
        parsedAmount = Number(cleanAmount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          results.push({ row: i, status: "error", error: `Value must be a valid non-negative number (got "${amountStr}")` });
          continue;
        }
      }

      let stage = oppPipeline.stages[0];
      if (oppStageName) {
        const matched = oppStageMap.get(oppStageName.toLowerCase().trim());
        if (!matched) {
          results.push({
            row: i,
            status: "error",
            error: `Invalid Stage "${oppStageName}". Allowed: ${allowedOppStages.join(", ")}`,
          });
          continue;
        }
        stage = matched;
      }

      let createdAt = new Date();
      if (createdDateStr) {
        const d = new Date(createdDateStr);
        if (isNaN(d.getTime())) {
          results.push({ row: i, status: "error", error: `Invalid Created Date "${createdDateStr}"` });
          continue;
        }
        createdAt = d;
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

      let assignedUser = users.find((u) => u.id === req.authUser.id) || users[0];
      if (assignedToName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === assignedToName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === assignedToName.toLowerCase() ||
            u.firstName.toLowerCase() === assignedToName.toLowerCase()
        );
        if (found) assignedUser = found;
      }

      let accountOwner = assignedUser;
      if (accountOwnerName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === accountOwnerName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === accountOwnerName.toLowerCase() ||
            u.firstName.toLowerCase() === accountOwnerName.toLowerCase()
        );
        if (found) accountOwner = found;
      }

      let existingAccount = accounts.find((a) => a.name.toLowerCase().trim() === accountName.toLowerCase().trim());
      if (!existingAccount && !body.createMissingAccount && !body.commit) {
        results.push({ row: i, status: "error", error: `Account "${accountName}" does not exist and auto-creation is disabled` });
        continue;
      }

      const existingOpp = await prisma.opportunity.findFirst({
        where: {
          tenantId,
          archived: false,
          name: { equals: oppName, mode: "insensitive" },
          ...(existingAccount ? { accountId: existingAccount.id } : {}),
        },
      });

      const isDuplicate = !!existingOpp;
      const previewData = {
        name: oppName,
        accountName,
        accountOwner: `${accountOwner.firstName} ${accountOwner.lastName}`,
        contactPerson: contactPersonName || "—",
        amount: parsedAmount,
        stage: stage.name,
        assignedTo: `${assignedUser.firstName} ${assignedUser.lastName}`,
        createdDate: createdAt.toISOString().slice(0, 10),
        closeDate: closeDate ? closeDate.toISOString().slice(0, 10) : "—",
        remarks,
      };

      const decision = body.rowDecisions?.[i] || body.duplicateStrategy;

      if (isDuplicate && !body.commit) {
        results.push({
          row: i,
          status: "duplicate",
          duplicateDetails: {
            existingName: existingOpp.name,
            accountName: accountName,
            existingId: existingOpp.id,
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
              ownerId: accountOwner.id,
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
                ownerId: assignedUser.id,
              },
            });
            contacts.push(existingContact);
          }
          if (existingContact) contactId = existingContact.id;
        }

        if (isDuplicate && decision === "update_existing" && existingOpp) {
          await prisma.opportunity.update({
            where: { id: existingOpp.id },
            data: {
              amount: parsedAmount,
              stageId: stage.id,
              probability: stage.probability,
              expectedCloseDate: closeDate,
              ownerId: assignedUser.id,
              contactId: contactId || undefined,
              description: remarks || undefined,
            },
          });
        } else {
          await prisma.opportunity.create({
            data: {
              tenantId,
              pipelineId: oppPipeline.id,
              stageId: stage.id,
              accountId: accountId!,
              contactId,
              ownerId: assignedUser.id,
              name: oppName,
              amount: parsedAmount,
              probability: stage.probability,
              expectedCloseDate: closeDate,
              description: remarks || null,
              createdAt,
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

  app.post("/api/v1/opportunities", { preHandler: app.authenticate }, async (req, reply) => {
    const body = opportunitySchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    if (!body.accountId && !body.newAccount) {
      return reply.code(400).send({ error: "Account is required — select an existing account or create a new one" });
    }

    if (body.createdAt && body.expectedCloseDate) {
      if (new Date(body.expectedCloseDate) < new Date(body.createdAt)) {
        return reply.code(400).send({ error: "Close Date cannot be earlier than Created Date" });
      }
    }

    const [account, stage] = await Promise.all([
      body.accountId ? prisma.account.findFirst({ where: { id: body.accountId, tenantId } }) : Promise.resolve(null),
      prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId, pipeline: { tenantId } },
      }),
    ]);
    if (body.accountId && !account) return reply.code(400).send({ error: "Account not found for this tenant" });
    if (!stage) return reply.code(400).send({ error: "Stage does not belong to the specified pipeline" });

    const opportunity = await prisma.$transaction(async (tx) => {
      let accountId = body.accountId;
      if (!accountId && body.newAccount) {
        const newAcc = await tx.account.create({
          data: {
            tenantId,
            name: body.newAccount.name,
            domain: body.newAccount.domain || null,
            industry: body.newAccount.industry || null,
            phone: body.newAccount.phone || null,
            website: body.newAccount.website || null,
            ownerId: body.newAccount.ownerId || body.ownerId,
          },
        });
        accountId = newAcc.id;
      }

      let contactId = body.contactId;
      if (!contactId && body.newContact) {
        const newCt = await tx.contact.create({
          data: {
            tenantId,
            accountId: accountId!,
            firstName: body.newContact.firstName,
            lastName: body.newContact.lastName,
            email: body.newContact.email || null,
            phone: body.newContact.phone || null,
            jobTitle: body.newContact.jobTitle || null,
            ownerId: body.ownerId,
          },
        });
        contactId = newCt.id;
      }

      const allContactIds = new Set<string>();
      if (contactId) allContactIds.add(contactId);
      if (body.contactIds) body.contactIds.forEach((id) => allContactIds.add(id));

      const isClosingWon = stage.isClosed && stage.isWon;
      const isClosingLost = stage.isClosed && !stage.isWon;

      const opp = await tx.opportunity.create({
        data: {
          tenantId,
          name: body.name,
          accountId: accountId!,
          contactId: contactId || null,
          amount: body.amount,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          probability: body.probability ?? stage.probability,
          createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          actualCloseDate: body.actualCloseDate ? new Date(body.actualCloseDate) : (isClosingWon ? new Date() : null),
          wonDate: body.wonDate ? new Date(body.wonDate) : (isClosingWon ? new Date() : null),
          lostReason: body.lostReason || null,
          dealType: body.dealType || null,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : (body.forecastCategory || "PIPELINE"),
          ownerId: body.ownerId,
          createdById: req.authUser.id,
          opportunityType: body.opportunityType || "NEW_BUSINESS",
          leadSource: body.leadSource,
          description: body.description ?? body.remarks ?? null,
          properties: body.properties ?? {},
          contacts: allContactIds.size > 0
            ? { create: Array.from(allContactIds).map((cId) => ({ contactId: cId })) }
            : undefined,
        },
      });

      await tx.opportunityStageHistory.create({
        data: { opportunityId: opp.id, toStageId: body.stageId, changedById: req.authUser.id },
      });

      if (isClosingWon) {
        const acct = await tx.account.findUnique({ where: { id: accountId! } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const newRev = currentRev + Number(opp.amount);
          await tx.account.update({
            where: { id: accountId! },
            data: { annualRevenue: newRev },
          });
        }
      }

      return opp;
    });

    await logAudit({
      tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: opportunity.id, action: "CREATED", newValues: opportunity,
    });

    const fullOpp = await prisma.opportunity.findFirst({
      where: { id: opportunity.id },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        stage: true,
        pipeline: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.code(201).send(fullOpp);
  });

  app.get("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const opp = await prisma.opportunity.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        contact: true,
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
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    await requireCanAccess(req.authUser, opp, "read");
    return opp;
  });

  app.patch("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = opportunitySchema.partial().parse(req.body);
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const effectiveCreatedAt = body.createdAt ? new Date(body.createdAt) : existing.createdAt;
    const effectiveCloseDate = body.expectedCloseDate !== undefined ? (body.expectedCloseDate ? new Date(body.expectedCloseDate) : null) : existing.expectedCloseDate;
    if (effectiveCreatedAt && effectiveCloseDate && effectiveCloseDate < effectiveCreatedAt) {
      return reply.code(400).send({ error: "Close Date cannot be earlier than Created Date" });
    }

    let targetStage: any = null;
    const stageChanged = body.stageId && body.stageId !== existing.stageId;
    if (stageChanged) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId ?? existing.pipelineId },
      });
      if (!targetStage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });

      if (targetStage.isClosed && targetStage.isWon) {
        const amount = body.amount ?? existing.amount;
        if (!amount || Number(amount) <= 0) {
          return reply.code(400).send({ error: "A valid amount is required to mark an opportunity Closed Won" });
        }
      }
    }

    const { contactIds, remarks, newAccount, newContact, ...rest } = body;
    const opportunity = await prisma.$transaction(async (tx) => {
      const isClosingWon = !!targetStage?.isClosed && targetStage.isWon;
      const isClosingLost = !!targetStage?.isClosed && !targetStage.isWon;

      const finalActualCloseDate = rest.actualCloseDate
        ? new Date(rest.actualCloseDate)
        : (isClosingWon ? (existing.actualCloseDate ?? new Date()) : undefined);

      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          ...rest,
          probability: stageChanged && targetStage ? targetStage.probability : rest.probability,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : rest.forecastCategory,
          wonDate: isClosingWon ? (existing.wonDate ?? new Date()) : undefined,
          actualCloseDate: finalActualCloseDate,
          lostReason: isClosingLost ? (rest.lostReason ?? existing.lostReason) : undefined,
          description: rest.description !== undefined ? rest.description : (remarks !== undefined ? remarks : undefined),
          createdAt: rest.createdAt ? new Date(rest.createdAt) : undefined,
          expectedCloseDate: rest.expectedCloseDate !== undefined ? (rest.expectedCloseDate ? new Date(rest.expectedCloseDate) : null) : undefined,
          contactId: rest.contactId !== undefined ? rest.contactId : undefined,
        },
      });

      if (stageChanged) {
        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: id,
            fromStageId: existing.stageId,
            toStageId: body.stageId!,
            changedById: req.authUser.id,
          },
        });
      }

      if (contactIds || rest.contactId) {
        const idsToLink = new Set<string>(contactIds || []);
        if (rest.contactId) idsToLink.add(rest.contactId);

        await tx.opportunityContact.deleteMany({ where: { opportunityId: id } });
        if (idsToLink.size > 0) {
          await tx.opportunityContact.createMany({
            data: Array.from(idsToLink).map((contactId) => ({ opportunityId: id, contactId })),
          });
        }
      }

      if (isClosingWon) {
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
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: stageChanged ? "STAGE_CHANGED" : "UPDATED", oldValues: existing, newValues: opportunity,
    });

    if (targetStage?.isClosed) {
      await notify({
        tenantId: req.authUser.tenantId, userId: opportunity.ownerId,
        message: `Opportunity "${opportunity.name}" was marked ${targetStage.isWon ? "Closed Won 🎉" : "Closed Lost"}`,
        link: `/opportunities/${opportunity.id}`,
      });
    }

    const fullOpp = await prisma.opportunity.findFirst({
      where: { id },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return fullOpp;
  });

  app.delete("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    await prisma.opportunity.delete({ where: { id } });
    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: "DELETED", oldValues: existing,
    });
    return reply.code(204).send();
  });

  // --- Line items (Products on an Opportunity) ---
  app.post("/api/v1/opportunities/:id/line-items", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse(req.body);
    const opp = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
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
        opportunityId: id,
        quantity: body.quantity,
        unitPrice,
        discountPct: body.discountPct ?? 0,
        taxPct: body.taxPct ?? 0,
        total,
      },
    });

    const items = await prisma.lineItem.findMany({ where: { opportunityId: id } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.opportunity.update({ where: { id }, data: { amount: newAmount } });

    return reply.code(201).send(lineItem);
  });

  app.delete("/api/v1/opportunities/:opportunityId/line-items/:lineItemId", { preHandler: app.authenticate }, async (req, reply) => {
    const { opportunityId, lineItemId } = req.params as { opportunityId: string; lineItemId: string };
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId: req.authUser.tenantId } });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    await prisma.lineItem.delete({ where: { id: lineItemId } });
    const items = await prisma.lineItem.findMany({ where: { opportunityId } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.opportunity.update({ where: { id: opportunityId }, data: { amount: newAmount } });
    return reply.code(204).send();
  });

  app.post("/api/v1/opportunities/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    const opp = await prisma.opportunity.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY", recordId: id, action: "ARCHIVED" });
    return opp;
  });

  app.post("/api/v1/opportunities/bulk", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1),
      action: z.enum(["assignOwner", "changeStage", "archive"]),
      ownerId: z.string().uuid().optional(),
      stageId: z.string().uuid().optional(),
    }).parse(req.body);

    const tenantId = req.authUser.tenantId;
    const scoped = await prisma.opportunity.findMany({ where: { id: { in: body.ids }, tenantId }, select: { id: true } });
    const ids = scoped.map((o) => o.id);
    if (!ids.length) return reply.code(404).send({ error: "No matching opportunities found" });

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

    await prisma.opportunity.updateMany({ where: { id: { in: ids }, tenantId }, data });
    await logAudit({ tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY", recordId: ids.join(","), action: `BULK_${body.action.toUpperCase()}`, newValues: data });
    return { updated: ids.length };
  });
}
