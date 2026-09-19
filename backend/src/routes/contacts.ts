import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess, requireExportPermission } from "../lib/rbac.js";
import { phoneSchema, nameSchema } from "../lib/validators.js";
import {
  emailListSchema, phoneListSchema, primaryEmail, primaryPhoneString, normalizePrimary,
  type EmailEntry, type PhoneEntry,
} from "../lib/multiValueFields.js";

const contactSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: phoneSchema,
  phoneNumber: phoneSchema,
  emails: emailListSchema,
  phones: phoneListSchema,
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

/** Writes the full emails[]/phones[] replacement set for a contact inside a transaction. */
async function syncContactMultiFields(
  tx: any,
  tenantId: string,
  contactId: string,
  emails: EmailEntry[] | undefined,
  phones: PhoneEntry[] | undefined
) {
  if (emails !== undefined) {
    await tx.contactEmail.deleteMany({ where: { contactId } });
    const normalized = normalizePrimary(emails);
    if (normalized.length) {
      await tx.contactEmail.createMany({
        data: normalized.map((e) => ({ tenantId, contactId, email: e.email, label: e.label || null, isPrimary: !!e.isPrimary })),
      });
    }
  }
  if (phones !== undefined) {
    await tx.contactPhone.deleteMany({ where: { contactId } });
    const normalized = normalizePrimary(phones);
    if (normalized.length) {
      await tx.contactPhone.createMany({
        data: normalized.map((p) => ({
          tenantId, contactId, countryCode: p.countryCode, number: p.number, label: p.label || null, isPrimary: !!p.isPrimary,
        })),
      });
    }
  }
}

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
          { phone: { contains: q.search, mode: "insensitive" as const } },
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
        orderBy: { createdAt: "desc" },
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
          { phone: { contains: q.search, mode: "insensitive" as const } },
        ],
      });
    }
    const contacts = await prisma.contact.findMany({ where, include: { account: { select: { name: true } }, owner: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } });
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
              createdById: req.authUser.id,
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
    const { designation, phoneNumber, emails, phones, ...rest } = body;
    // The emails[]/phones[] lists are the source of truth when present; the
    // legacy scalar columns are kept as a mirror of whichever entry is
    // primary so existing search/CSV/dedupe code keeps working unchanged.
    const resolvedEmail = emails !== undefined ? primaryEmail(emails) : (rest.email || null);
    const resolvedPhone = phones !== undefined
      ? primaryPhoneString(phones)
      : (phoneNumber !== undefined ? phoneNumber : body.phone);
    const dataToSave = {
      ...rest,
      email: resolvedEmail,
      phone: resolvedPhone,
      jobTitle: designation !== undefined ? designation : body.jobTitle,
    };
    // An email address is mandatory for every contact -- phone is optional,
    // mirroring the same check the create/edit forms run.
    if (!dataToSave.email) {
      return reply.code(400).send({
        error: "Validation error",
        details: [{ path: ["email"], message: "Email address is required." }],
      });
    }
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
    const contact = await prisma.$transaction(async (tx) => {
      const created = await tx.contact.create({
        data: { ...dataToSave, tenantId: req.authUser.tenantId, createdById: req.authUser.id },
      });
      await syncContactMultiFields(tx, req.authUser.tenantId, created.id, emails, phones);
      return created;
    });
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
        emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
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
    const { designation, phoneNumber, emails, phones, ...rest } = body;
    // Email is mandatory -- if the caller is replacing the emails[] list,
    // it must still resolve to at least one address.
    if (emails !== undefined && !primaryEmail(emails)) {
      return reply.code(400).send({
        error: "Validation error",
        details: [{ path: ["email"], message: "Email address is required." }],
      });
    }
    const dataToUpdate = {
      ...rest,
      ...(emails !== undefined ? { email: primaryEmail(emails) } : {}),
      ...(phones !== undefined
        ? { phone: primaryPhoneString(phones) }
        : phoneNumber !== undefined ? { phone: phoneNumber } : {}),
      ...(designation !== undefined ? { jobTitle: designation } : {}),
    };
    const contact = await prisma.$transaction(async (tx) => {
      const updated = await tx.contact.update({ where: { id }, data: dataToUpdate });
      await syncContactMultiFields(tx, req.authUser.tenantId, id, emails, phones);
      return updated;
    });
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

  // DELETION REQUEST — Manager submits deletion request for Partner Approval
  app.post("/api/v1/contacts/:id/deletion-request", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ reason: z.string().min(1, "Reason is required") }).parse(req.body);

    const existing = await prisma.contact.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const activePending = await prisma.contactDeletionRequest.findFirst({
      where: { tenantId: req.authUser.tenantId, contactId: id, status: "PENDING" },
    });
    if (activePending) {
      return reply.code(400).send({
        error: "A pending deletion request already exists for this contact. Please wait for partner review.",
      });
    }

    let partnerId = req.authUser.partnerId;
    if (!partnerId) {
      const partnerUser = await prisma.user.findFirst({
        where: { tenantId: req.authUser.tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
      });
      partnerId = partnerUser?.id || null;
    }

    const deletionRequest = await prisma.contactDeletionRequest.create({
      data: {
        tenantId: req.authUser.tenantId,
        contactId: id,
        contactName: `${existing.firstName} ${existing.lastName}`,
        requestedById: req.authUser.id,
        approverId: partnerId,
        reason: body.reason,
        status: "PENDING",
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const partnersToNotify = await prisma.user.findMany({
      where: { tenantId: req.authUser.tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
      select: { id: true },
    });
    for (const p of partnersToNotify) {
      await notify({
        tenantId: req.authUser.tenantId,
        userId: p.id,
        message: `Contact Deletion Requested: "${existing.firstName} ${existing.lastName}" requested by ${req.authUser.firstName} ${req.authUser.lastName}. Reason: ${body.reason}`,
        link: `/approvals`,
      });
    }

    return deletionRequest;
  });

  // GET pending/historical Contact Deletion Requests
  app.get("/api/v1/contacts/deletion-requests", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { status?: string };
    const statusFilter = q.status && q.status !== "all" ? (q.status as any) : "PENDING";
    const isManager = req.authUser.orgRole === "MANAGER";

    const where: any = {
      tenantId: req.authUser.tenantId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(isManager
        ? { requestedById: req.authUser.id }
        : {
            OR: [
              { approverId: req.authUser.id },
              { approverId: null },
              ...(req.authUser.orgRole === "SENIOR_PARTNER" ? [{ tenantId: req.authUser.tenantId }] : []),
            ],
          }),
    };

    const requests = await prisma.contactDeletionRequest.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true, account: { select: { id: true, name: true } } } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: requests };
  });

  // Approve Contact Deletion Request
  app.post("/api/v1/contacts/deletion-requests/:requestId/approve", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can approve contact deletion requests." });
    }
    const { requestId } = req.params as { requestId: string };
    const delReq = await prisma.contactDeletionRequest.findFirst({
      where: { id: requestId, tenantId: req.authUser.tenantId, status: "PENDING" },
      include: { contact: true, requestedBy: true },
    });
    if (!delReq) return reply.code(404).send({ error: "Pending deletion request not found" });

    await prisma.$transaction(async (tx) => {
      await tx.contactDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
        },
      });
      if (delReq.contactId) {
        const contactId = delReq.contactId;
        await tx.contactEmail.deleteMany({ where: { contactId } });
        await tx.contactPhone.deleteMany({ where: { contactId } });
        await tx.opportunityContact.deleteMany({ where: { contactId } });
        await tx.opportunity.updateMany({ where: { contactId }, data: { contactId: null } });
        await tx.activity.deleteMany({ where: { contactId } });
        await tx.note.deleteMany({ where: { contactId } });
        await tx.contact.delete({ where: { id: contactId } });
      }
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "CONTACT",
      recordId: delReq.contactId || requestId,
      action: "DELETED",
      oldValues: { contactName: delReq.contactName, reason: delReq.reason, approvedBy: req.authUser.email },
    });

    if (delReq.requestedById) {
      await notify({
        tenantId: req.authUser.tenantId,
        userId: delReq.requestedById,
        message: `Your deletion request for contact "${delReq.contactName}" was approved.`,
        link: `/contacts`,
      });
    }

    return { success: true, message: `Contact "${delReq.contactName}" deleted successfully.` };
  });

  // Disapprove Contact Deletion Request
  app.post("/api/v1/contacts/deletion-requests/:requestId/disapprove", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can reject contact deletion requests." });
    }
    const { requestId } = req.params as { requestId: string };
    const body = z.object({ reviewComment: z.string().optional() }).parse(req.body);

    const delReq = await prisma.contactDeletionRequest.findFirst({
      where: { id: requestId, tenantId: req.authUser.tenantId, status: "PENDING" },
    });
    if (!delReq) return reply.code(404).send({ error: "Pending deletion request not found" });

    const updated = await prisma.contactDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: "DISAPPROVED",
        reviewedById: req.authUser.id,
        reviewedAt: new Date(),
        reviewComment: body.reviewComment || null,
      },
    });

    if (delReq.requestedById) {
      await notify({
        tenantId: req.authUser.tenantId,
        userId: delReq.requestedById,
        message: `Your deletion request for contact "${delReq.contactName}" was rejected${body.reviewComment ? `: ${body.reviewComment}` : "."}`,
        link: `/contacts`,
      });
    }

    return updated;
  });

  // Revoke Contact Deletion Request (by Manager requester)
  app.post("/api/v1/contacts/deletion-requests/:requestId/revoke", { preHandler: app.authenticate }, async (req, reply) => {
    const { requestId } = req.params as { requestId: string };
    const delReq = await prisma.contactDeletionRequest.findFirst({
      where: { id: requestId, tenantId: req.authUser.tenantId, status: "PENDING" },
    });
    if (!delReq) return reply.code(404).send({ error: "Pending deletion request not found" });
    if (delReq.requestedById !== req.authUser.id && req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "You can only revoke your own deletion requests." });
    }

    const updated = await prisma.contactDeletionRequest.update({
      where: { id: requestId },
      data: { status: "CANCELLED", reviewedAt: new Date() },
    });
    return updated;
  });

  app.delete("/api/v1/contacts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({
        error: "Managers cannot directly delete contacts. Please submit a deletion request for Partner approval.",
      });
    }
    const { id } = req.params as { id: string };
    const existing = await prisma.contact.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    await requireCanAccess(req.authUser, existing, "write");

    await prisma.$transaction(async (tx) => {
      await tx.contactEmail.deleteMany({ where: { contactId: id } });
      await tx.contactPhone.deleteMany({ where: { contactId: id } });
      await tx.opportunityContact.deleteMany({ where: { contactId: id } });
      await tx.opportunity.updateMany({ where: { contactId: id }, data: { contactId: null } });
      await tx.activity.deleteMany({ where: { contactId: id } });
      await tx.note.deleteMany({ where: { contactId: id } });
      await tx.contactDeletionRequest.deleteMany({ where: { contactId: id } });
      await tx.contact.delete({ where: { id } });
    });

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
}
