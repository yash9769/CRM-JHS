import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireExportPermission } from "../lib/rbac.js";

const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "UNQUALIFIED", "CONVERTED"] as const;

const leadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  score: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
});

const convertSchema = z.object({
  createAccount: z.boolean().default(false),
  createContact: z.boolean().default(false),
  createOpportunity: z.boolean().default(false),

  // Account
  accountId: z.string().uuid().optional().nullable(), // use existing
  newAccount: z
    .object({
      name: z.string().min(1),
      domain: z.string().optional().nullable(),
      industry: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      website: z.string().optional().nullable(),
    })
    .optional(),

  // Contact
  contactId: z.string().uuid().optional().nullable(), // use existing

  // Opportunity
  opportunity: z
    .object({
      name: z.string().min(1),
      amount: z.number().positive(),
      pipelineId: z.string().uuid(),
      stageId: z.string().uuid(),
      ownerId: z.string().uuid(),
      expectedCloseDate: z.string().datetime().optional().nullable(),
    })
    .optional(),
});

async function findDuplicateLeads(tenantId: string, data: { email?: string | null; phone?: string | null; firstName: string; lastName: string; companyName?: string | null }) {
  const or: any[] = [];
  if (data.email) or.push({ email: { equals: data.email, mode: "insensitive" as const } });
  if (data.phone) or.push({ phone: data.phone });
  if (data.companyName) {
    or.push({
      AND: [
        { firstName: { equals: data.firstName, mode: "insensitive" as const } },
        { lastName: { equals: data.lastName, mode: "insensitive" as const } },
        { companyName: { equals: data.companyName, mode: "insensitive" as const } },
      ],
    });
  }
  if (!or.length) return [];
  return prisma.lead.findMany({
    where: { tenantId, archived: false, OR: or },
    take: 5,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, companyName: true, status: true },
  });
}

export default async function leadRoutes(app: FastifyInstance) {
  // LIST
  app.get("/api/v1/leads", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; status?: string;
      source?: string; ownerId?: string; sortBy?: string; sortDir?: "asc" | "desc";
      includeArchived?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "25")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where = {
      tenantId: req.authUser.tenantId,
      ...rbacFilter,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: "insensitive" as const } },
              { lastName: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
              { companyName: { contains: q.search, mode: "insensitive" as const } },
              { phone: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const sortBy = ["createdAt", "updatedAt", "score", "firstName", "lastName", "status", "companyName"].includes(q.sortBy || "")
      ? q.sortBy!
      : "createdAt";

    const [total, data] = await prisma.$transaction([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { [sortBy]: q.sortDir || "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  // EXPORT — CSV of leads matching current filters
  app.get("/api/v1/leads/export", { preHandler: app.authenticate }, async (req, reply) => {
    requireExportPermission(req.authUser);

    const q = req.query as { search?: string; status?: string; source?: string; ownerId?: string; includeArchived?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.search
        ? { OR: [
            { firstName: { contains: q.search, mode: "insensitive" as const } },
            { lastName: { contains: q.search, mode: "insensitive" as const } },
            { email: { contains: q.search, mode: "insensitive" as const } },
            { companyName: { contains: q.search, mode: "insensitive" as const } },
          ] }
        : {}),
    };
    const leads = await prisma.lead.findMany({ where, include: { owner: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } });
    const rows = leads.map((l) => ({
      firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone, companyName: l.companyName,
      jobTitle: l.jobTitle, source: l.source, status: l.status, score: l.score,
      owner: l.owner ? `${l.owner.firstName} ${l.owner.lastName}` : "", createdAt: l.createdAt.toISOString(),
    }));
    const csv = toCsv(rows, [
      { key: "firstName", label: "First Name" }, { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" }, { key: "phone", label: "Phone" }, { key: "companyName", label: "Company" },
      { key: "jobTitle", label: "Job Title" }, { key: "source", label: "Source" }, { key: "status", label: "Status" },
      { key: "score", label: "Score" }, { key: "owner", label: "Owner" }, { key: "createdAt", label: "Created At" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="leads.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → preview/commit
  app.post("/api/v1/leads/import", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({
      rows: z.array(z.record(z.string())),
      mapping: z.record(z.string()), // target field -> CSV column header
      commit: z.boolean().default(false),
      duplicateStrategy: z.enum(["skip", "create_new", "update_existing"]).default("skip"),
      rowDecisions: z.record(z.enum(["skip", "create_new", "update_existing"])).optional(),
    }).parse(req.body);

    const tenantId = req.authUser.tenantId;
    const users = await prisma.user.findMany({ where: { tenantId } });
    const results: { row: number; status: "valid" | "duplicate" | "error"; error?: string; duplicateDetails?: any; data?: any }[] = [];

    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const mapped: Record<string, string> = {};
      for (const [field, column] of Object.entries(body.mapping)) {
        if (column && raw[column] !== undefined) mapped[field] = String(raw[column]).trim();
      }

      let firstName = mapped.firstName;
      let lastName = mapped.lastName;
      if (!firstName && mapped.name) {
        const parts = mapped.name.split(" ");
        firstName = parts[0];
        lastName = parts.slice(1).join(" ") || "Lead";
      }

      if (!firstName || !lastName) {
        results.push({ row: i, status: "error", error: "First name and last name are required" });
        continue;
      }
      const email = mapped.email?.trim() || null;
      const phone = mapped.phone?.trim() || null;
      let dup: any = null;
      if (email || phone) {
        dup = await prisma.lead.findFirst({
          where: { tenantId, archived: false, OR: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])] },
        });
      }

      let owner = users.find((u) => u.id === req.authUser.id) || users[0];
      const ownerName = mapped.owner || mapped.accountOwner;
      if (ownerName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === ownerName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === ownerName.toLowerCase() ||
            u.firstName.toLowerCase() === ownerName.toLowerCase()
        );
        if (found) owner = found;
      }

      const data = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        phone,
        companyName: mapped.companyName?.trim() || mapped.company?.trim() || null,
        jobTitle: mapped.jobTitle?.trim() || null,
        source: mapped.source?.trim() || "Import",
        status: (LEAD_STATUSES as readonly string[]).includes(mapped.status) ? (mapped.status as any) : "NEW",
        owner: `${owner.firstName} ${owner.lastName}`,
      };

      const decision = body.rowDecisions?.[i] || body.duplicateStrategy;

      if (dup && !body.commit) {
        results.push({
          row: i,
          status: "duplicate",
          duplicateDetails: {
            existingName: `${dup.firstName} ${dup.lastName}`,
            existingEmail: dup.email || undefined,
            existingPhone: dup.phone || undefined,
            existingId: dup.id,
          },
          data,
        });
        continue;
      }

      if (dup && body.commit && decision === "skip") {
        results.push({ row: i, status: "duplicate", data });
        continue;
      }

      if (body.commit) {
        const { owner: _ownerStr, ...leadFields } = data;
        if (dup && decision === "update_existing") {
          await prisma.lead.update({
            where: { id: dup.id },
            data: {
              firstName: data.firstName,
              lastName: data.lastName,
              companyName: data.companyName,
              jobTitle: data.jobTitle,
              source: data.source,
              status: data.status,
              ownerId: owner.id,
            },
          });
        } else {
          await prisma.lead.create({ data: { ...leadFields, tenantId, ownerId: owner.id } });
        }
      }
      results.push({ row: i, status: "valid", data });
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
  app.post("/api/v1/leads/check-duplicate", { preHandler: app.authenticate }, async (req) => {
    const body = leadSchema.pick({ firstName: true, lastName: true, email: true, phone: true, companyName: true }).parse(req.body);
    const duplicates = await findDuplicateLeads(req.authUser.tenantId, body);
    return { duplicates };
  });

  // CREATE
  app.post("/api/v1/leads", { preHandler: app.authenticate }, async (req, reply) => {
    const body = leadSchema.parse(req.body);
    const force = (req.query as any)?.force === "true" || (req.body as any)?.force === true;
    const email = body.email || null;

    if (!force) {
      const duplicates = await findDuplicateLeads(req.authUser.tenantId, { ...body, email });
      if (duplicates.length) {
        return reply.code(409).send({ error: "Possible duplicate lead", duplicates });
      }
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId: req.authUser.tenantId,
        firstName: body.firstName,
        lastName: body.lastName,
        email,
        phone: body.phone || null,
        companyName: body.companyName || null,
        jobTitle: body.jobTitle || null,
        source: body.source || null,
        status: body.status || "NEW",
        score: body.score ?? 0,
        notes: body.notes || null,
        ownerId: body.ownerId || req.authUser.id,
      },
    });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "LEAD", recordId: lead.id, action: "CREATED", newValues: lead });
    if (lead.ownerId && lead.ownerId !== req.authUser.id) {
      await notify({ tenantId: req.authUser.tenantId, userId: lead.ownerId, message: `New lead assigned to you: ${lead.firstName} ${lead.lastName}`, link: `/leads/${lead.id}` });
    }
    return reply.code(201).send(lead);
  });

  // GET ONE
  app.get("/api/v1/leads/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        activities: { include: { owner: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        notesList: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!lead) return reply.code(404).send({ error: "Lead not found" });

    // Resolve conversion targets for display, if converted
    let convertedAccount = null, convertedContact = null, convertedOpportunity = null;
    if (lead.convertedAccountId) convertedAccount = await prisma.account.findUnique({ where: { id: lead.convertedAccountId }, select: { id: true, name: true } });
    if (lead.convertedContactId) convertedContact = await prisma.contact.findUnique({ where: { id: lead.convertedContactId }, select: { id: true, firstName: true, lastName: true } });
    if (lead.convertedOpportunityId) convertedOpportunity = await prisma.opportunity.findUnique({ where: { id: lead.convertedOpportunityId }, select: { id: true, name: true } });

    return { ...lead, convertedAccount, convertedContact, convertedOpportunity };
  });

  // UPDATE
  app.patch("/api/v1/leads/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = leadSchema.partial().parse(req.body);
    const existing = await prisma.lead.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Lead not found" });

    const lead = await prisma.lead.update({
      where: { id },
      data: { ...body, email: body.email === "" ? null : body.email },
    });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "LEAD", recordId: lead.id, action: "UPDATED", oldValues: existing, newValues: lead });
    return lead;
  });

  // ARCHIVE (soft delete)
  app.post("/api/v1/leads/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.lead.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Lead not found" });
    const lead = await prisma.lead.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "LEAD", recordId: id, action: "ARCHIVED" });
    return lead;
  });

  // BULK ACTIONS
  app.post("/api/v1/leads/bulk", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1),
      action: z.enum(["assignOwner", "changeStatus", "archive"]),
      ownerId: z.string().uuid().optional(),
      status: z.enum(LEAD_STATUSES).optional(),
    }).parse(req.body);

    const tenantId = req.authUser.tenantId;
    const scoped = await prisma.lead.findMany({ where: { id: { in: body.ids }, tenantId }, select: { id: true } });
    const ids = scoped.map((l) => l.id);
    if (!ids.length) return reply.code(404).send({ error: "No matching leads found" });

    let data: any = {};
    if (body.action === "assignOwner") {
      if (!body.ownerId) return reply.code(400).send({ error: "ownerId is required" });
      data = { ownerId: body.ownerId };
    } else if (body.action === "changeStatus") {
      if (!body.status) return reply.code(400).send({ error: "status is required" });
      data = { status: body.status };
    } else if (body.action === "archive") {
      data = { archived: true };
    }

    await prisma.lead.updateMany({ where: { id: { in: ids }, tenantId }, data });
    await logAudit({ tenantId, userId: req.authUser.id, objectType: "LEAD", recordId: ids.join(","), action: `BULK_${body.action.toUpperCase()}`, newValues: data });
    return { updated: ids.length };
  });

  app.delete("/api/v1/leads/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.lead.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Lead not found" });
    await prisma.lead.delete({ where: { id } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "LEAD", recordId: id, action: "DELETED", oldValues: existing });
    return reply.code(204).send();
  });

  // CONVERT — transactional, supports any combination of Account/Contact/Opportunity
  app.post("/api/v1/leads/:id/convert", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const tenantId = req.authUser.tenantId;
    const body = convertSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) return reply.code(404).send({ error: "Lead not found" });
    if (lead.status === "CONVERTED") return reply.code(409).send({ error: "Lead has already been converted" });

    if (body.createOpportunity && !body.opportunity) {
      return reply.code(400).send({ error: "Opportunity details are required to create an opportunity" });
    }
    if (body.createOpportunity && !body.createAccount && !body.accountId) {
      return reply.code(400).send({ error: "An opportunity requires an account — select an existing one or create a new one" });
    }
    if (body.createContact && !body.createAccount && !body.accountId && !body.contactId) {
      // contact without an account is allowed; nothing to validate
    }

    const result = await prisma.$transaction(async (tx) => {
      let accountId: string | null = body.accountId || null;
      if (body.createAccount) {
        if (!body.newAccount) throw Object.assign(new Error("New account details are required"), { statusCode: 400 });
        const acc = await tx.account.create({
          data: {
            tenantId,
            name: body.newAccount.name,
            domain: body.newAccount.domain || null,
            industry: body.newAccount.industry || null,
            phone: body.newAccount.phone || null,
            website: body.newAccount.website || null,
            ownerId: lead.ownerId || req.authUser.id,
          },
        });
        accountId = acc.id;
      }

      let contactId: string | null = body.contactId || null;
      if (body.createContact) {
        const contact = await tx.contact.create({
          data: {
            tenantId,
            accountId: accountId || null,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            phone: lead.phone,
            jobTitle: lead.jobTitle,
            lifecycleStage: "SALES_QUALIFIED",
            leadSource: lead.source,
            ownerId: lead.ownerId || req.authUser.id,
          },
        });
        contactId = contact.id;
      } else if (contactId && accountId) {
        // Associate the chosen existing contact with the chosen account, if not already linked
        const existingContact = await tx.contact.findFirst({ where: { id: contactId, tenantId } });
        if (existingContact && !existingContact.accountId) {
          await tx.contact.update({ where: { id: contactId }, data: { accountId } });
        }
      }

      let opportunityId: string | null = null;
      if (body.createOpportunity && body.opportunity) {
        if (!accountId) throw Object.assign(new Error("An account is required to create an opportunity"), { statusCode: 400 });
        const stage = await tx.pipelineStage.findFirst({ where: { id: body.opportunity.stageId, pipelineId: body.opportunity.pipelineId, pipeline: { tenantId } } });
        if (!stage) throw Object.assign(new Error("Invalid stage for this pipeline"), { statusCode: 400 });
        const opp = await tx.opportunity.create({
          data: {
            tenantId,
            name: body.opportunity.name,
            accountId,
            amount: body.opportunity.amount,
            pipelineId: body.opportunity.pipelineId,
            stageId: body.opportunity.stageId,
            probability: stage.probability,
            expectedCloseDate: body.opportunity.expectedCloseDate ? new Date(body.opportunity.expectedCloseDate) : null,
            ownerId: body.opportunity.ownerId,
            leadSource: lead.source,
            contacts: contactId ? { create: [{ contactId }] } : undefined,
          },
        });
        await tx.opportunityStageHistory.create({ data: { opportunityId: opp.id, toStageId: body.opportunity.stageId, changedById: req.authUser.id } });
        opportunityId = opp.id;
      }

      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: "CONVERTED",
          convertedAt: new Date(),
          convertedAccountId: accountId,
          convertedContactId: contactId,
          convertedOpportunityId: opportunityId,
        },
      });

      return { lead: updatedLead, accountId, contactId, opportunityId };
    });

    await logAudit({
      tenantId,
      userId: req.authUser.id,
      objectType: "LEAD",
      recordId: id,
      action: "CONVERTED",
      newValues: result,
    });

    return result;
  });
}
