import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess, requireExportPermission } from "../lib/rbac.js";

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().regex(/^\d+$/, "Phone number must contain only numeric digits").optional().nullable().or(z.literal("")),
  phoneNumber: z.string().regex(/^\d+$/, "Phone number must contain only numeric digits").optional().nullable().or(z.literal("")),
  jobTitle: z.string().optional().nullable(),
  designation: z.string().optional().nullable(),
  lifecycleStage: z
    .enum(["SUBSCRIBER", "LEAD", "MARKETING_QUALIFIED", "SALES_QUALIFIED", "OPPORTUNITY", "CUSTOMER", "EVANGELIST"])
    .optional(),
  leadSource: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  accountId: z.string().uuid().optional().nullable(),
  linkedinUrl: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  properties: z.record(z.any()).optional(),
});

async function findDuplicateContacts(tenantId: string, data: { email?: string | null; phone?: string | null }) {
  const or: any[] = [];
  if (data.email) or.push({ email: { equals: data.email, mode: "insensitive" as const } });
  if (data.phone) or.push({ phone: data.phone });
  if (!or.length) return [];
  return prisma.contact.findMany({
    where: { tenantId, archived: false, OR: or },
    take: 5,
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, account: { select: { id: true, name: true } } },
  });
}

export default async function contactRoutes(app: FastifyInstance) {
  app.get("/api/v1/contacts", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      accountId?: string;
      ownerId?: string;
      lifecycleStage?: string;
      leadSource?: string;
      includeArchived?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "25")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    // The RBAC filter and the search filter BOTH produce an `OR` key. Spreading
    // them into the same object literal makes the later one silently overwrite
    // the earlier one, deleting the RBAC restriction. Compose them with `AND`
    // (an array) so both are always applied.
    const where: any = {
      tenantId: req.authUser.tenantId,
      AND: [rbacFilter],
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.lifecycleStage ? { lifecycleStage: q.lifecycleStage as any } : {}),
      ...(q.leadSource ? { leadSource: q.leadSource } : {}),
    };
    if (q.search) {
      where.AND.push({
        OR: [
          { firstName: { contains: q.search, mode: "insensitive" as const } },
          { lastName: { contains: q.search, mode: "insensitive" as const } },
          { email: { contains: q.search, mode: "insensitive" as const } },
        ],
      });
    }

    const [total, data] = await prisma.$transaction([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        include: {
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  app.post("/api/v1/contacts/check-duplicate", { preHandler: app.authenticate }, async (req) => {
    const body = contactSchema.pick({ email: true, phone: true }).parse(req.body);
    const duplicates = await findDuplicateContacts(req.authUser.tenantId, body);
    return { duplicates };
  });

  // EXPORT — CSV of contacts matching current filters
  app.get("/api/v1/contacts/export", { preHandler: app.authenticate }, async (req, reply) => {
    requireExportPermission(req.authUser);

    const q = req.query as { search?: string; accountId?: string; ownerId?: string; lifecycleStage?: string; includeArchived?: string };
    // Export must be scoped to the caller's visible users exactly like the LIST
    // handler above; composed under `AND` so the search `OR` cannot overwrite it.
    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where: any = {
      tenantId: req.authUser.tenantId,
      AND: [rbacFilter],
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.lifecycleStage ? { lifecycleStage: q.lifecycleStage as any } : {}),
    };
    if (q.search) {
      where.AND.push({
        OR: [
          { firstName: { contains: q.search, mode: "insensitive" as const } },
          { lastName: { contains: q.search, mode: "insensitive" as const } },
          { email: { contains: q.search, mode: "insensitive" as const } },
        ],
      });
    }
    const contacts = await prisma.contact.findMany({ where, include: { account: { select: { name: true } }, owner: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" } });
    const rows = contacts.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email || "",
      phone: c.phone || "",
      jobTitle: c.jobTitle || "",
      account: c.account?.name || "",
      lifecycleStage: c.lifecycleStage,
      linkedinUrl: c.linkedinUrl || "",
      owner: c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "",
      createdAt: c.createdAt ? c.createdAt.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "firstName", label: "First Name" },
      { key: "lastName", label: "Last Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "jobTitle", label: "Job Title" },
      { key: "account", label: "Account" },
      { key: "lifecycleStage", label: "Lifecycle Stage" },
      { key: "linkedinUrl", label: "LinkedIn URL" },
      { key: "owner", label: "Account Owner" },
      { key: "createdAt", label: "Created Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="contacts.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → duplicate check → preview/commit
  app.post("/api/v1/contacts/import", { preHandler: app.authenticate }, async (req, reply) => {
    const importSchema = z.object({
      rows: z.array(z.record(z.string())),
      mapping: z.record(z.string()),
      commit: z.boolean().default(false),
      createMissingAccount: z.boolean().default(true),
      duplicateStrategy: z.enum(["skip", "create_new", "update_existing"]).default("skip"),
      rowDecisions: z.record(z.enum(["skip", "create_new", "update_existing"])).optional(),
    });

    const body = importSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const [users, accounts, existingContacts] = await Promise.all([
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
      prisma.contact.findMany({ where: { tenantId, archived: false }, include: { account: true } }),
    ]);

    const results: {
      row: number;
      status: "valid" | "duplicate" | "error";
      error?: string;
      duplicateDetails?: { existingName: string; existingEmail?: string; existingPhone?: string; existingId: string };
      data?: any;
    }[] = [];

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
        lastName = parts.slice(1).join(" ") || "Contact";
      }

      const email = mapped.email || null;
      const phone = mapped.phone || null;
      const jobTitle = mapped.jobTitle || null;
      const accountName = mapped.account || mapped.companyName || mapped.company;
      const lifecycleStage = (mapped.lifecycleStage || "LEAD").toUpperCase().replace(/\s+/g, "_");
      const linkedinUrl = mapped.linkedinUrl || null;
      const ownerName = mapped.owner || mapped.accountOwner;

      if (!firstName || !lastName) {
        results.push({ row: i, status: "error", error: "First Name and Last Name are required" });
        continue;
      }

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.push({ row: i, status: "error", error: `Invalid email address "${email}"` });
        continue;
      }

      const validStages = ["SUBSCRIBER", "LEAD", "MARKETING_QUALIFIED", "SALES_QUALIFIED", "OPPORTUNITY", "CUSTOMER", "EVANGELIST", "OTHER"];
      const validatedStage = validStages.includes(lifecycleStage) ? (lifecycleStage as any) : "LEAD";

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
      let matchedAccount = accountName ? accounts.find((a) => a.name.toLowerCase().trim() === accountName.toLowerCase().trim()) : null;

      // Duplicate detection
      const dup = existingContacts.find(
        (c) =>
          (email && c.email && c.email.toLowerCase().trim() === email.toLowerCase().trim()) ||
          (phone && c.phone && c.phone.trim() === phone.trim())
      );

      const previewData = {
        firstName,
        lastName,
        email: email || "—",
        phone: phone || "—",
        jobTitle: jobTitle || "—",
        account: accountName || (matchedAccount ? matchedAccount.name : "—"),
        lifecycleStage: validatedStage,
        linkedinUrl: linkedinUrl || "—",
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
          data: previewData,
        });
        continue;
      }

      if (dup && body.commit && decision === "skip") {
        results.push({ row: i, status: "duplicate", data: previewData });
        continue;
      }

      if (body.commit) {
        let accountId = matchedAccount?.id || null;
        if (!accountId && accountName && body.createMissingAccount) {
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

        if (dup && decision === "update_existing") {
          await prisma.contact.update({
            where: { id: dup.id },
            data: {
              firstName,
              lastName,
              jobTitle: jobTitle || undefined,
              accountId: accountId || undefined,
              lifecycleStage: validatedStage,
              linkedinUrl: linkedinUrl || undefined,
              ownerId: owner.id,
            },
          });
        } else {
          const created = await prisma.contact.create({
            data: {
              tenantId,
              firstName,
              lastName,
              email,
              phone,
              jobTitle,
              accountId,
              lifecycleStage: validatedStage,
              linkedinUrl,
              ownerId: owner.id,
            },
          });
          existingContacts.push(created as any);
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

  app.post("/api/v1/contacts", { preHandler: app.authenticate }, async (req, reply) => {
    const body = contactSchema.parse(req.body);
    const { designation, phoneNumber, ...rest } = body;
    const dataToSave = {
      ...rest,
      phone: phoneNumber !== undefined ? phoneNumber : body.phone,
      jobTitle: designation !== undefined ? designation : body.jobTitle,
    };
    if (dataToSave.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: dataToSave.accountId, tenantId: req.authUser.tenantId },
      });
      if (!account) return reply.code(400).send({ error: "Account not found for this tenant" });
    }
    const force = (req.query as any)?.force === "true" || (req.body as any)?.force === true;
    if (!force && (dataToSave.email || dataToSave.phone)) {
      const duplicates = await findDuplicateContacts(req.authUser.tenantId, dataToSave);
      if (duplicates.length) return reply.code(409).send({ error: "Possible duplicate contact", duplicates });
    }
    const contact = await prisma.contact.create({ data: { ...dataToSave, tenantId: req.authUser.tenantId, createdById: req.authUser.id } });
    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "CONTACT",
      recordId: contact.id,
      action: "CREATED",
      newValues: contact,
    });
    return reply.code(201).send(contact);
  });

  app.get("/api/v1/contacts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contact = await prisma.contact.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        opportunityContacts: { include: { opportunity: { include: { stage: true } } } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!contact) return reply.code(404).send({ error: "Contact not found" });
    await requireCanAccess(req.authUser, contact, "read");
    return contact;
  });

  app.patch("/api/v1/contacts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = contactSchema.partial().parse(req.body);
    const existing = await prisma.contact.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    await requireCanAccess(req.authUser, existing, "write");
    const { designation, phoneNumber, ...rest } = body;
    const dataToUpdate = {
      ...rest,
      ...(phoneNumber !== undefined ? { phone: phoneNumber } : {}),
      ...(designation !== undefined ? { jobTitle: designation } : {}),
    };
    const contact = await prisma.contact.update({ where: { id }, data: dataToUpdate });
    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "CONTACT",
      recordId: contact.id,
      action: "UPDATED",
      oldValues: existing,
      newValues: contact,
    });
    return contact;
  });

  app.delete("/api/v1/contacts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.contact.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    await requireCanAccess(req.authUser, existing, "write");
    await prisma.contact.delete({ where: { id } });
    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "CONTACT",
      recordId: id,
      action: "DELETED",
      oldValues: existing,
    });
    return reply.code(204).send();
  });

  app.post("/api/v1/contacts/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.contact.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    const contact = await prisma.contact.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "CONTACT", recordId: id, action: "ARCHIVED" });
    return contact;
  });
}
