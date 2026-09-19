import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess, requireExportPermission } from "../lib/rbac.js";
import { phoneSchema } from "../lib/validators.js";
import { computeOpportunityFinancials } from "../lib/financial.js";
import {
  emailListSchema, phoneListSchema, primaryPhoneString, normalizePrimary,
  type EmailEntry, type PhoneEntry,
} from "../lib/multiValueFields.js";

const accountSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  employeeCount: z.number().int().nonnegative("Employee count must be non-negative").optional().nullable(),
  annualRevenue: z.number().nonnegative("Annual revenue must be non-negative").optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  accountType: z.enum(["PROSPECT", "CUSTOMER", "PARTNER", "FORMER_CUSTOMER"]).optional(),
  billingAddress: z.string().optional().nullable(),
  phone: phoneSchema,
  emails: emailListSchema,
  phones: phoneListSchema,
  website: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  properties: z.record(z.any()).optional(),
});

/** Writes the full emails[]/phones[] replacement set for an account inside a transaction. */
async function syncAccountMultiFields(
  tx: any,
  tenantId: string,
  accountId: string,
  emails: EmailEntry[] | undefined,
  phones: PhoneEntry[] | undefined
) {
  if (emails !== undefined) {
    await tx.accountEmail.deleteMany({ where: { accountId } });
    const normalized = normalizePrimary(emails);
    if (normalized.length) {
      await tx.accountEmail.createMany({
        data: normalized.map((e) => ({ tenantId, accountId, email: e.email, label: e.label || null, isPrimary: !!e.isPrimary })),
      });
    }
  }
  if (phones !== undefined) {
    await tx.accountPhone.deleteMany({ where: { accountId } });
    const normalized = normalizePrimary(phones);
    if (normalized.length) {
      await tx.accountPhone.createMany({
        data: normalized.map((p) => ({
          tenantId, accountId, countryCode: p.countryCode, number: p.number, label: p.label || null, isPrimary: !!p.isPrimary,
        })),
      });
    }
  }
}

/**
 * The Account form only exposes a single "Website" field (Domain was folded
 * into it), but `domain` is still a separate indexed column used for search
 * and duplicate detection -- so derive it from whatever website was entered
 * rather than asking for both.
 */
function deriveDomainFromWebsite(website?: string | null): string | null {
  if (!website) return null;
  try {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(website) ? website : `https://${website}`;
    return new URL(withScheme).hostname.replace(/^www\./i, "").toLowerCase() || null;
  } catch {
    // Not a parseable URL -- fall back to a light manual strip so a bare
    // "acme.com" or "www.acme.com/pricing" still yields a usable domain.
    return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase() || null;
  }
}

async function findDuplicateAccounts(tenantId: string, data: { name: string; domain?: string | null }) {
  const or: any[] = [{ name: { equals: data.name, mode: "insensitive" as const } }];
  if (data.domain) or.push({ domain: { equals: data.domain, mode: "insensitive" as const } });
  return prisma.account.findMany({
    where: { tenantId, OR: or },
    take: 5,
    select: { id: true, name: true, domain: true, industry: true, accountType: true },
  });
}

export default async function accountRoutes(app: FastifyInstance) {
  // LIST — server-side pagination, filtering, search
  app.get("/api/v1/accounts", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      accountType?: string;
      ownerId?: string;
      industry?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
      startsWith?: string;
      includeArchived?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "50")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where: any = {
      tenantId: req.authUser.tenantId,
      AND: [rbacFilter],
      ...(q.accountType ? { accountType: q.accountType as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.industry ? { industry: q.industry } : {}),
    };
    if (q.startsWith) {
      if (q.startsWith === "0-9") {
        where.AND.push({
          OR: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => ({
            name: { startsWith: num, mode: "insensitive" as const },
          })),
        });
      } else {
        where.AND.push({
          name: { startsWith: q.startsWith, mode: "insensitive" as const },
        });
      }
    }
    if (q.search) {
      where.AND.push({
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { domain: { contains: q.search, mode: "insensitive" as const } },
        ],
      });
    }

    const sortBy = ["name", "createdAt", "updatedAt", "industry", "annualRevenue", "employeeCount"].includes(q.sortBy || "")
      ? q.sortBy!
      : "name";
    const sortDir = q.sortDir || (sortBy === "name" ? "asc" : "desc");

    const [total, data] = await prisma.$transaction([
      prisma.account.count({ where }),
      prisma.account.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, opportunities: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  // DUPLICATE CHECK
  app.post("/api/v1/accounts/check-duplicate", { preHandler: app.authenticate }, async (req) => {
    const body = accountSchema.pick({ name: true, domain: true }).parse(req.body);
    const duplicates = await findDuplicateAccounts(req.authUser.tenantId, body);
    return { duplicates };
  });

  // EXPORT — CSV of accounts matching current filters
  app.get("/api/v1/accounts/export", { preHandler: app.authenticate }, async (req, reply) => {
    requireExportPermission(req.authUser);

    const q = req.query as { search?: string; accountType?: string; ownerId?: string; industry?: string; includeArchived?: string };
    const rbacFilter = await getCreatedByFilter(req.authUser);
    // Compose RBAC + search under `AND` — see the note on the LIST handler above.
    const where: any = {
      tenantId: req.authUser.tenantId,
      AND: [rbacFilter],
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountType ? { accountType: q.accountType as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.industry ? { industry: q.industry } : {}),
    };
    if (q.search) {
      where.AND.push({
        OR: [
          { name: { contains: q.search, mode: "insensitive" as const } },
          { domain: { contains: q.search, mode: "insensitive" as const } },
        ],
      });
    }
    const accounts = await prisma.account.findMany({ where, include: { owner: { select: { firstName: true, lastName: true } } }, orderBy: { updatedAt: "desc" } });
    const rows = accounts.map((a) => ({
      name: a.name,
      domain: a.domain || "",
      industry: a.industry || "",
      accountType: a.accountType,
      phone: a.phone || "",
      website: a.website || "",
      annualRevenue: a.annualRevenue ? String(a.annualRevenue) : "",
      employeeCount: a.employeeCount ? String(a.employeeCount) : "",
      billingAddress: a.billingAddress || "",
      owner: a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : "",
      description: a.description || "",
      createdAt: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "name", label: "Account Name" },
      { key: "domain", label: "Domain" },
      { key: "industry", label: "Industry" },
      { key: "phone", label: "Phone" },
      { key: "website", label: "Website" },
      { key: "annualRevenue", label: "Annual Revenue" },
      { key: "employeeCount", label: "Employee Count" },
      { key: "billingAddress", label: "Billing Address" },
      { key: "owner", label: "Account Owner" },
      { key: "description", label: "Description" },
      { key: "createdAt", label: "Created Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="accounts.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → duplicate check → preview/commit
  app.post("/api/v1/accounts/import", { preHandler: app.authenticate }, async (req, reply) => {
    const importSchema = z.object({
      rows: z.array(z.record(z.string())),
      mapping: z.record(z.string()),
      commit: z.boolean().default(false),
      duplicateStrategy: z.enum(["skip", "create_new", "update_existing"]).default("skip"),
      rowDecisions: z.record(z.enum(["skip", "create_new", "update_existing"])).optional(),
    });

    const body = importSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const [users, existingAccounts] = await Promise.all([
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
    ]);

    const results: {
      row: number;
      status: "valid" | "duplicate" | "error";
      error?: string;
      duplicateDetails?: { existingName: string; existingDomain?: string; existingId: string };
      data?: any;
    }[] = [];

    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const mapped: Record<string, string> = {};
      for (const [field, column] of Object.entries(body.mapping)) {
        if (column && raw[column] !== undefined) mapped[field] = String(raw[column]).trim();
      }

      const name = mapped.name || mapped.accountName || mapped.companyName || mapped.company;
      const domain = mapped.domain || mapped.companyDomain;
      const industry = mapped.industry;
      const accountType = (mapped.accountType || mapped.type || "PROSPECT").toUpperCase().replace(/\s+/g, "_");
      const phone = mapped.phone;
      const website = mapped.website;
      const annualRevenueStr = mapped.annualRevenue || mapped.revenue;
      const employeeCountStr = mapped.employeeCount || mapped.employees;
      const billingAddress = mapped.billingAddress || mapped.address;
      const ownerName = mapped.owner || mapped.accountOwner;
      const description = mapped.description || mapped.notes;

      if (!name) {
        results.push({ row: i, status: "error", error: "Account Name is required" });
        continue;
      }

      let annualRevenue: number | null = null;
      if (annualRevenueStr) {
        const clean = annualRevenueStr.replace(/[^0-9.-]+/g, "");
        const num = Number(clean);
        if (isNaN(num)) {
          results.push({ row: i, status: "error", error: `Invalid Annual Revenue "${annualRevenueStr}"` });
          continue;
        }
        annualRevenue = num;
      }

      let employeeCount: number | null = null;
      if (employeeCountStr) {
        const clean = employeeCountStr.replace(/[^0-9]+/g, "");
        const num = parseInt(clean, 10);
        if (isNaN(num)) {
          results.push({ row: i, status: "error", error: `Invalid Employee Count "${employeeCountStr}"` });
          continue;
        }
        employeeCount = num;
      }

      const validTypes = ["PROSPECT", "CUSTOMER", "PARTNER", "VENDOR", "OTHER"];
      const validatedType = validTypes.includes(accountType) ? (accountType as any) : "PROSPECT";

      // Resolve owner
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

      // Duplicate detection
      const dup = existingAccounts.find(
        (a) =>
          a.name.toLowerCase().trim() === name.toLowerCase().trim() ||
          (domain && a.domain && a.domain.toLowerCase().trim() === domain.toLowerCase().trim())
      );

      const previewData = {
        name,
        domain: domain || "—",
        industry: industry || "—",
        accountType: validatedType,
        phone: phone || "—",
        website: website || "—",
        annualRevenue,
        employeeCount,
        billingAddress: billingAddress || "—",
        owner: `${owner.firstName} ${owner.lastName}`,
        description,
      };

      const decision = body.rowDecisions?.[i] || body.duplicateStrategy;

      if (dup && !body.commit) {
        results.push({
          row: i,
          status: "duplicate",
          duplicateDetails: {
            existingName: dup.name,
            existingDomain: dup.domain || undefined,
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
        if (dup && decision === "update_existing") {
          await prisma.account.update({
            where: { id: dup.id },
            data: {
              domain: domain || undefined,
              industry: industry || undefined,
              accountType: validatedType,
              phone: phone || undefined,
              website: website || undefined,
              annualRevenue: annualRevenue !== null ? annualRevenue : undefined,
              employeeCount: employeeCount !== null ? employeeCount : undefined,
              billingAddress: billingAddress || undefined,
              ownerId: owner.id,
              description: description || undefined,
            },
          });
        } else {
          const created = await prisma.account.create({
            data: {
              tenantId,
              name,
              domain: domain || null,
              industry: industry || null,
              accountType: validatedType,
              phone: phone || null,
              website: website || null,
              annualRevenue,
              employeeCount,
              billingAddress: billingAddress || null,
              ownerId: owner.id,
              createdById: req.authUser.id,
              description: description || null,
            },
          });
          existingAccounts.push(created);
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

  app.post("/api/v1/accounts", { preHandler: app.authenticate }, async (req, reply) => {
    const body = accountSchema.parse(req.body);
    body.domain = deriveDomainFromWebsite(body.website) ?? body.domain;
    const { emails, phones, ...rest } = body;
    // emails[]/phones[] are the source of truth when present; `phone` stays
    // in sync with whichever entry is primary for existing search/CSV/dedupe code.
    if (phones !== undefined) rest.phone = primaryPhoneString(phones);
    const force = (req.query as any)?.force === "true" || (req.body as any)?.force === true;
    if (!force) {
      const duplicates = await findDuplicateAccounts(req.authUser.tenantId, rest);
      if (duplicates.length) return reply.code(409).send({ error: "Possible duplicate account", duplicates });
    }
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.account.create({
        data: { ...rest, tenantId: req.authUser.tenantId, createdById: req.authUser.id },
      });
      await syncAccountMultiFields(tx, req.authUser.tenantId, created.id, emails, phones);
      return created;
    });
    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "ACCOUNT",
      recordId: account.id,
      action: "CREATED",
      newValues: account,
    });
    return reply.code(201).send(account);
  });

  app.get("/api/v1/accounts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const account = await prisma.account.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { orderBy: { createdAt: "desc" } },
        opportunities: {
          include: {
            stage: true,
            owner: { select: { id: true, firstName: true, lastName: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        quotes: { orderBy: { createdAt: "desc" } },
        activities: {
          include: { owner: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        notes: {
          include: { author: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
        emails: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
        phones: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      },
    });
    if (!account) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, account, "read");
    // Prisma Decimal fields are serialized as strings; cast them to numbers
    // so callers can round-trip values through PATCH without type errors.
    const toNumber = (v: any): number | null => (v === null || v === undefined ? null : Number(v));
    return {
      ...account,
      annualRevenue: toNumber(account.annualRevenue),
      employeeCount: account.employeeCount ?? null,
      opportunities: account.opportunities.map((o) => ({ ...o, ...computeOpportunityFinancials(o) })),
    };
  });

  app.patch("/api/v1/accounts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = accountSchema.partial().parse(req.body);
    if (body.website !== undefined) {
      body.domain = deriveDomainFromWebsite(body.website);
    }
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const { emails, phones, ...rest } = body;
    if (phones !== undefined) rest.phone = primaryPhoneString(phones);

    const account = await prisma.$transaction(async (tx) => {
      const updated = await tx.account.update({ where: { id }, data: rest });
      await syncAccountMultiFields(tx, req.authUser.tenantId, id, emails, phones);
      return updated;
    });
    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "ACCOUNT",
      recordId: account.id,
      action: "UPDATED",
      oldValues: existing,
      newValues: account,
    });
    return account;
  });

  app.delete("/api/v1/accounts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });

    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot directly delete accounts. Please submit a deletion request with reason for Partner approval." });
    }

    await requireCanAccess(req.authUser, existing, "write");

    await prisma.$transaction(async (tx) => {
      await tx.opportunityAttachment.deleteMany({ where: { opportunity: { accountId: id } } });
      await tx.stageApproval.deleteMany({ where: { opportunity: { accountId: id } } });
      await tx.opportunityStageHistory.deleteMany({ where: { opportunity: { accountId: id } } });
      await tx.opportunityContact.deleteMany({ where: { opportunity: { accountId: id } } });
      await tx.lineItem.deleteMany({ where: { quote: { accountId: id } } });
      await tx.lineItem.deleteMany({ where: { opportunity: { accountId: id } } });
      await tx.quote.deleteMany({ where: { accountId: id } });
      await tx.opportunity.deleteMany({ where: { accountId: id } });
      await tx.contactEmail.deleteMany({ where: { contact: { accountId: id } } });
      await tx.contactPhone.deleteMany({ where: { contact: { accountId: id } } });
      await tx.contact.deleteMany({ where: { accountId: id } });
      await tx.accountEmail.deleteMany({ where: { accountId: id } });
      await tx.accountPhone.deleteMany({ where: { accountId: id } });
      await tx.activity.deleteMany({ where: { accountId: id } });
      await tx.note.deleteMany({ where: { accountId: id } });
      await tx.accountDeletionRequest.deleteMany({ where: { accountId: id } });
      await tx.account.delete({ where: { id } });
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "ACCOUNT",
      recordId: id,
      action: "DELETED",
      oldValues: existing,
    });
    return reply.code(204).send();
  });

  // Bulk delete — only for non-Managers, mirroring single-delete rules.
  app.post("/api/v1/accounts/bulk-delete", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot directly delete accounts. Please submit a deletion request with reason for Partner approval." });
    }
    const body = z.object({ ids: z.array(z.string().uuid()).min(1, "Select at least one account") }).parse(req.body);
    const results: { id: string; status: "deleted" | "not_found" | "forbidden" }[] = [];

    for (const id of body.ids) {
      const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
      if (!existing) { results.push({ id, status: "not_found" }); continue; }
      try {
        await requireCanAccess(req.authUser, existing, "write");
      } catch {
        results.push({ id, status: "forbidden" }); continue;
      }
      await prisma.$transaction(async (tx) => {
        await tx.opportunityAttachment.deleteMany({ where: { opportunity: { accountId: id } } });
        await tx.stageApproval.deleteMany({ where: { opportunity: { accountId: id } } });
        await tx.opportunityStageHistory.deleteMany({ where: { opportunity: { accountId: id } } });
        await tx.opportunityContact.deleteMany({ where: { opportunity: { accountId: id } } });
        await tx.lineItem.deleteMany({ where: { quote: { accountId: id } } });
        await tx.lineItem.deleteMany({ where: { opportunity: { accountId: id } } });
        await tx.quote.deleteMany({ where: { accountId: id } });
        await tx.opportunity.deleteMany({ where: { accountId: id } });
        await tx.contactEmail.deleteMany({ where: { contact: { accountId: id } } });
        await tx.contactPhone.deleteMany({ where: { contact: { accountId: id } } });
        await tx.contact.deleteMany({ where: { accountId: id } });
        await tx.accountEmail.deleteMany({ where: { accountId: id } });
        await tx.accountPhone.deleteMany({ where: { accountId: id } });
        await tx.activity.deleteMany({ where: { accountId: id } });
        await tx.note.deleteMany({ where: { accountId: id } });
        await tx.accountDeletionRequest.deleteMany({ where: { accountId: id } });
        await tx.account.delete({ where: { id } });
      });
      await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "ACCOUNT", recordId: id, action: "DELETED", oldValues: existing });
      results.push({ id, status: "deleted" });
    }

    return { results };
  });

  // Raise deletion request (for Managers / Partners)
  app.post("/api/v1/accounts/:id/deletion-request", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const requestSchema = z.object({
      reason: z.string().min(1, "Reason is mandatory"),
      confirmName: z.string().optional(),
    });

    const body = requestSchema.parse(req.body);
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const pendingRequest = await prisma.accountDeletionRequest.findFirst({
      where: { tenantId: req.authUser.tenantId, accountId: id, status: "PENDING" },
    });
    if (pendingRequest) {
      return reply.code(400).send({ error: "A deletion request is already pending for this account." });
    }

    let partnerId = req.authUser.partnerId;
    if (!partnerId) {
      const partnerUser = await prisma.user.findFirst({
        where: { tenantId: req.authUser.tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
      });
      partnerId = partnerUser?.id || null;
    }

    const deletionRequest = await prisma.accountDeletionRequest.create({
      data: {
        tenantId: req.authUser.tenantId,
        accountId: id,
        accountName: existing.name,
        requestedById: req.authUser.id,
        approverId: partnerId,
        reason: body.reason,
        status: "PENDING",
      },
      include: {
        account: { select: { id: true, name: true } },
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
        message: `Account Deletion Requested: "${existing.name}" requested by ${req.authUser.firstName} ${req.authUser.lastName}. Reason: ${body.reason}`,
        link: `/approvals`,
      });
    }

    return deletionRequest;
  });

  // GET pending/historical Account Deletion Requests
  app.get("/api/v1/accounts/deletion-requests", { preHandler: app.authenticate }, async (req) => {
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
              ...((req.authUser.orgRole === "SENIOR_PARTNER" || req.authUser.orgRole === "SUPER_ADMIN") ? [{ tenantId: req.authUser.tenantId }] : []),
            ],
          }),
    };

    const requests = await prisma.accountDeletionRequest.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, domain: true, industry: true, owner: { select: { id: true, firstName: true, lastName: true } } } },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: requests };
  });

  // Approve Account Deletion Request
  app.post("/api/v1/accounts/deletion-requests/:requestId/approve", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can approve account deletion requests." });
    }
    const { requestId } = req.params as { requestId: string };
    const delReq = await prisma.accountDeletionRequest.findFirst({
      where: { id: requestId, tenantId: req.authUser.tenantId, status: "PENDING" },
      include: { account: true, requestedBy: true },
    });
    if (!delReq) return reply.code(404).send({ error: "Pending deletion request not found" });

    await prisma.$transaction(async (tx) => {
      await tx.accountDeletionRequest.update({
        where: { id: requestId },
        data: {
          status: "APPROVED",
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
        },
      });
      if (delReq.accountId) {
        const accId = delReq.accountId;
        await tx.opportunityAttachment.deleteMany({ where: { opportunity: { accountId: accId } } });
        await tx.stageApproval.deleteMany({ where: { opportunity: { accountId: accId } } });
        await tx.opportunityStageHistory.deleteMany({ where: { opportunity: { accountId: accId } } });
        await tx.opportunityContact.deleteMany({ where: { opportunity: { accountId: accId } } });
        await tx.lineItem.deleteMany({ where: { quote: { accountId: accId } } });
        await tx.lineItem.deleteMany({ where: { opportunity: { accountId: accId } } });
        await tx.quote.deleteMany({ where: { accountId: accId } });
        await tx.opportunity.deleteMany({ where: { accountId: accId } });
        await tx.contactEmail.deleteMany({ where: { contact: { accountId: accId } } });
        await tx.contactPhone.deleteMany({ where: { contact: { accountId: accId } } });
        await tx.contact.deleteMany({ where: { accountId: accId } });
        await tx.accountEmail.deleteMany({ where: { accountId: accId } });
        await tx.accountPhone.deleteMany({ where: { accountId: accId } });
        await tx.activity.deleteMany({ where: { accountId: accId } });
        await tx.note.deleteMany({ where: { accountId: accId } });
        await tx.account.delete({ where: { id: accId } });
      }
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "ACCOUNT",
      recordId: delReq.accountId || requestId,
      action: "DELETED_VIA_APPROVAL",
      oldValues: delReq.account,
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: delReq.requestedById,
      message: `Your deletion request for account "${delReq.accountName || delReq.account?.name || 'Account'}" was approved and deleted by ${req.authUser.firstName} ${req.authUser.lastName}.`,
      link: "/accounts",
    });

    return { message: "Account deletion approved and account permanently removed." };
  });

  // Reject / Revoke Account Deletion Request
  app.post("/api/v1/accounts/deletion-requests/:requestId/reject", { preHandler: app.authenticate }, async (req, reply) => {
    const { requestId } = req.params as { requestId: string };
    const body = (req.body || {}) as { reviewComment?: string };
    const delReq = await prisma.accountDeletionRequest.findFirst({
      where: { id: requestId, tenantId: req.authUser.tenantId, status: "PENDING" },
      include: { account: true },
    });
    if (!delReq) return reply.code(404).send({ error: "Pending deletion request not found" });

    const isRequester = delReq.requestedById === req.authUser.id;
    const isApprover = req.authUser.orgRole === "PARTNER" || req.authUser.orgRole === "SENIOR_PARTNER";

    if (!isRequester && !isApprover) {
      return reply.code(403).send({ error: "You do not have permission to reject or revoke this request." });
    }

    const nextStatus = isRequester && !isApprover ? "CANCELLED" : "DISAPPROVED";

    const updated = await prisma.accountDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        reviewedById: req.authUser.id,
        reviewedAt: new Date(),
        reviewComment: body.reviewComment || null,
      },
    });

    if (nextStatus === "DISAPPROVED") {
      await notify({
        tenantId: req.authUser.tenantId,
        userId: delReq.requestedById,
        message: `Your deletion request for account "${delReq.accountName || delReq.account?.name || 'Account'}" was rejected by ${req.authUser.firstName} ${req.authUser.lastName}.`,
        link: "/accounts",
      });
    }

    return updated;
  });

  // Dependency impact preview, shown before archiving
  app.get("/api/v1/accounts/:id/impact", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, existing, "read");
    const [contacts, opportunities, activities] = await Promise.all([
      prisma.contact.count({ where: { accountId: id } }),
      prisma.opportunity.count({ where: { accountId: id } }),
      prisma.activity.count({ where: { accountId: id } }),
    ]);
    return { contacts, opportunities, activities };
  });


}
