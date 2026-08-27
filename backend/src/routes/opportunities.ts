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
  amount: z.number({ invalid_type_error: "Deal value must be a number" }).nonnegative("Deal value must be non-negative"),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid("Opportunity Stage is required"),
  dealStageId: z.string().uuid().optional().nullable(),
  probability: z.number().int().min(0).max(100).optional(),
  createdAt: z.string().datetime().optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid("Assigned To is required"),
  opportunityType: z.enum(["NEW_BUSINESS", "EXPANSION", "RENEWAL"]).optional(),
  leadSource: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

export default async function opportunityRoutes(app: FastifyInstance) {
  app.get("/api/v1/opportunities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string; isConverted?: string;
      includeArchived?: string; amountMin?: string; amountMax?: string; leadSource?: string;
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
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.won === "true"
        ? {
            OR: [
              { stage: { isWon: true } },
              { stage: { name: { in: ["Proposal Won", "Closed Won", "Won"], mode: "insensitive" as const } } },
            ],
          }
        : {}),
      ...(q.isConverted !== undefined ? { isConverted: q.isConverted === "true" } : {}),
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
          dealStage: true,
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
        dealStage: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const rows = opps.map((o) => ({
      accountOwner: o.account?.owner ? `${o.account.owner.firstName} ${o.account.owner.lastName}` : "",
      account: o.account?.name || "",
      contactPerson: o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : "",
      name: o.name,
      opportunityStage: o.stage.name,
      amount: Number(o.amount),
      remarks: o.description || "",
      assignedTo: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "",
      createdDate: o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "",
      closeDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "accountOwner", label: "Account Owner" },
      { key: "account", label: "Account" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "name", label: "Opportunity Name" },
      { key: "opportunityStage", label: "Opportunity Stage" },
      { key: "amount", label: "Deal Value" },
      { key: "remarks", label: "Remarks" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "createdDate", label: "Created Date" },
      { key: "closeDate", label: "Close Date" },
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

    const [oppPipeline, dealPipeline, users, accounts, contacts] = await Promise.all([
      prisma.pipeline.findFirst({ where: { tenantId, type: "OPPORTUNITY" }, include: { stages: { orderBy: { order: "asc" } } } }),
      prisma.pipeline.findFirst({ where: { tenantId, type: "DEAL" }, include: { stages: { orderBy: { order: "asc" } } } }),
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
      prisma.contact.findMany({ where: { tenantId, archived: false } }),
    ]);

    if (!oppPipeline || !oppPipeline.stages.length) {
      return reply.code(400).send({ error: "Opportunity pipeline not configured for workspace" });
    }

    const oppStageMap = new Map(oppPipeline.stages.map((s) => [s.name.toLowerCase().trim(), s]));
    const dealStageMap = new Map((dealPipeline?.stages || oppPipeline.stages).map((s) => [s.name.toLowerCase().trim(), s]));
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

      const oppName = mapped.name || mapped.opportunityName;
      const accountName = mapped.account || mapped.companyName || mapped.company;
      const amountStr = mapped.amount || mapped.dealValue || mapped.value;
      const oppStageName = mapped.opportunityStage || mapped.stage;
      const dealStageName = mapped.dealStage;
      const contactPersonName = mapped.contactPerson || mapped.contact;
      const accountOwnerName = mapped.accountOwner;
      const assignedToName = mapped.assignedTo || mapped.owner;
      const remarks = mapped.remarks || mapped.description || "";
      const createdDateStr = mapped.createdDate || mapped.createdAt;
      const closeDateStr = mapped.closeDate || mapped.expectedCloseDate;

      // 1. Validation
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
          results.push({ row: i, status: "error", error: `Deal Value must be a valid non-negative number (got "${amountStr}")` });
          continue;
        }
      }

      // Stage Validation against canonical 8 stages
      let stage = oppPipeline.stages[0];
      if (oppStageName) {
        const matched = oppStageMap.get(oppStageName.toLowerCase().trim());
        if (!matched) {
          results.push({
            row: i,
            status: "error",
            error: `Invalid Opportunity Stage "${oppStageName}". Allowed: ${allowedOppStages.join(", ")}`,
          });
          continue;
        }
        stage = matched;
      }

      let dealStage: any = null;
      if (dealStageName) {
        const matched = dealStageMap.get(dealStageName.toLowerCase().trim());
        if (!matched) {
          results.push({
            row: i,
            status: "error",
            error: `Invalid Deal Stage "${dealStageName}". Allowed: ${allowedOppStages.join(", ")}`,
          });
          continue;
        }
        dealStage = matched;
      }

      // Date validation
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
        if (d < createdAt) {
          results.push({ row: i, status: "error", error: `Close Date (${closeDateStr}) cannot be earlier than Created Date (${createdAt.toISOString().slice(0, 10)})` });
          continue;
        }
        closeDate = d;
      }

      // 2. User & Owner Resolution
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

      // 3. Account Resolution
      let existingAccount = accounts.find((a) => a.name.toLowerCase().trim() === accountName.toLowerCase().trim());
      if (!existingAccount && !body.createMissingAccount && !body.commit) {
        results.push({ row: i, status: "error", error: `Account "${accountName}" does not exist and auto-creation is disabled` });
        continue;
      }

      // 4. Duplicate Detection (Opportunity Name + Account)
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
        opportunityStage: stage.name,
        dealStage: dealStage ? dealStage.name : stage.name,
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

      // Commit execution
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

        // Contact resolution
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
              dealStageId: dealStage ? dealStage.id : null,
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
              dealStageId: dealStage ? dealStage.id : null,
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

    // Validate or default dealStageId
    let dealStageId = body.dealStageId;
    if (dealStageId) {
      const ds = await prisma.pipelineStage.findFirst({
        where: { id: dealStageId, pipeline: { tenantId } },
      });
      if (!ds) dealStageId = null;
    }

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

      const opp = await tx.opportunity.create({
        data: {
          tenantId,
          name: body.name,
          accountId: accountId!,
          contactId: contactId || null,
          amount: body.amount,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          dealStageId: dealStageId || null,
          probability: body.probability ?? stage.probability,
          createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
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
        dealStage: true,
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
        dealStage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { include: { contact: true } },
        activities: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
        convertedDeal: true,
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
    if (existing.isConverted) return reply.code(400).send({ error: "Cannot edit an opportunity already converted to a deal" });
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
    }

    const { contactIds, remarks, newAccount, newContact, ...rest } = body;
    const opportunity = await prisma.$transaction(async (tx) => {
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          ...rest,
          probability: stageChanged && targetStage ? targetStage.probability : rest.probability,
          description: rest.description !== undefined ? rest.description : (remarks !== undefined ? remarks : undefined),
          createdAt: rest.createdAt ? new Date(rest.createdAt) : undefined,
          expectedCloseDate: rest.expectedCloseDate !== undefined ? (rest.expectedCloseDate ? new Date(rest.expectedCloseDate) : null) : undefined,
          contactId: rest.contactId !== undefined ? rest.contactId : undefined,
          dealStageId: rest.dealStageId !== undefined ? rest.dealStageId : undefined,
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
      return updated;
    });

    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: stageChanged ? "STAGE_CHANGED" : "UPDATED", oldValues: existing, newValues: opportunity,
    });

    const fullOpp = await prisma.opportunity.findFirst({
      where: { id },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        stage: true,
        dealStage: true,
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

  // Convert a qualified Opportunity into a Deal.
  const convertSchema = z.object({
    dealName: z.string().optional(),
    dealPipelineId: z.string().uuid(),
    dealStageId: z.string().uuid(),
    closeDate: z.string().datetime().optional().nullable(),
  });

  app.post("/api/v1/opportunities/:id/convert", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = convertSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const opp = await prisma.opportunity.findFirst({
      where: { id, tenantId },
      include: { contacts: true },
    });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    if (opp.isConverted) return reply.code(400).send({ error: "Opportunity has already been converted" });

    const dealStage = await prisma.pipelineStage.findFirst({
      where: { id: body.dealStageId, pipelineId: body.dealPipelineId, pipeline: { tenantId } },
    });
    if (!dealStage) return reply.code(400).send({ error: "Invalid deal stage/pipeline" });

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId,
          name: body.dealName || opp.name,
          accountId: opp.accountId,
          contactId: opp.contactId,
          opportunityId: opp.id,
          amount: opp.amount,
          pipelineId: body.dealPipelineId,
          stageId: body.dealStageId,
          probability: dealStage.probability,
          closeDate: body.closeDate ? new Date(body.closeDate) : opp.expectedCloseDate,
          ownerId: opp.ownerId,
          description: opp.description,
          properties: opp.properties as any,
          contacts: { create: opp.contacts.map((c) => ({ contactId: c.contactId, role: c.role })) },
        },
      });

      await tx.dealStageHistory.create({
        data: { dealId: deal.id, toStageId: body.dealStageId, changedById: req.authUser.id },
      });

      await tx.activity.updateMany({
        where: { opportunityId: opp.id },
        data: { dealId: deal.id },
      });

      const updatedOpp = await tx.opportunity.update({
        where: { id: opp.id },
        data: { isConverted: true, convertedDealId: deal.id },
      });

      await tx.association.create({
        data: {
          tenantId,
          fromObjectType: "OPPORTUNITY",
          fromRecordId: opp.id,
          toObjectType: "DEAL",
          toRecordId: deal.id,
          associationLabel: "converted_to",
        },
      });

      return { deal, updatedOpp };
    });

    await logAudit({
      tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: opp.id, action: "CONVERTED_TO_DEAL", newValues: { dealId: result.deal.id },
    });
    await notify({
      tenantId, userId: opp.ownerId,
      message: `"${opp.name}" was converted to a deal`, link: `/deals/${result.deal.id}`,
    });

    return reply.code(201).send(result.deal);
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
