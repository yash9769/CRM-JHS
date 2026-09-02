import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess, requireExportPermission } from "../lib/rbac.js";

const accountSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  employeeCount: z.number().int().optional().nullable(),
  annualRevenue: z.number().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  accountType: z.enum(["PROSPECT", "CUSTOMER", "PARTNER", "FORMER_CUSTOMER"]).optional(),
  billingAddress: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  properties: z.record(z.any()).optional(),
});

async function findDuplicateAccounts(tenantId: string, data: { name: string; domain?: string | null }) {
  const or: any[] = [{ name: { equals: data.name, mode: "insensitive" as const } }];
  if (data.domain) or.push({ domain: { equals: data.domain, mode: "insensitive" as const } });
  return prisma.account.findMany({
    where: { tenantId, archived: false, OR: or },
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
      includeArchived?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "25")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where = {
      tenantId: req.authUser.tenantId,
      ...rbacFilter,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountType ? { accountType: q.accountType as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.industry ? { industry: q.industry } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { domain: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const sortBy = ["name", "createdAt", "updatedAt", "annualRevenue", "employeeCount"].includes(q.sortBy || "") ? q.sortBy! : "updatedAt";

    const [total, data] = await prisma.$transaction([
      prisma.account.count({ where }),
      prisma.account.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, opportunities: true } },
        },
        orderBy: { [sortBy]: q.sortDir || "desc" },
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
    const where = {
      tenantId: req.authUser.tenantId,
      ...rbacFilter,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountType ? { accountType: q.accountType as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.industry ? { industry: q.industry } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { domain: { contains: q.search, mode: "insensitive" as const } }] } : {}),
    };
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
      { key: "accountType", label: "Account Type" },
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
    const force = (req.query as any)?.force === "true" || (req.body as any)?.force === true;
    if (!force) {
      const duplicates = await findDuplicateAccounts(req.authUser.tenantId, body);
      if (duplicates.length) return reply.code(409).send({ error: "Possible duplicate account", duplicates });
    }
    const account = await prisma.account.create({
      data: { ...body, tenantId: req.authUser.tenantId, createdById: req.authUser.id },
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
          include: { stage: true, owner: { select: { id: true, firstName: true, lastName: true } } },
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
      },
    });
    if (!account) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, account, "read");
    return account;
  });

  app.patch("/api/v1/accounts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = accountSchema.partial().parse(req.body);
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const account = await prisma.account.update({ where: { id }, data: body });
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
    await requireCanAccess(req.authUser, existing, "write");
    await prisma.account.delete({ where: { id } });
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

  // Dependency impact preview, shown before archiving
  app.get("/api/v1/accounts/:id/impact", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    const [contacts, opportunities, activities] = await Promise.all([
      prisma.contact.count({ where: { accountId: id } }),
      prisma.opportunity.count({ where: { accountId: id } }),
      prisma.activity.count({ where: { accountId: id } }),
    ]);
    return { contacts, opportunities, activities };
  });

  app.post("/api/v1/accounts/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    const account = await prisma.account.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "ACCOUNT", recordId: id, action: "ARCHIVED" });
    return account;
  });

  app.post("/api/v1/accounts/:id/unarchive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });
    const account = await prisma.account.update({ where: { id }, data: { archived: false } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "ACCOUNT", recordId: id, action: "UNARCHIVED" });
    return account;
  });
}
