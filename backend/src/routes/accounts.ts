import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";

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

export default async function accountRoutes(app: FastifyInstance) {
  // LIST — server-side pagination, filtering, search
  app.get("/api/v1/accounts", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      accountType?: string;
      ownerId?: string;
      sortBy?: string;
      sortDir?: "asc" | "desc";
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || "25")));

    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountType ? { accountType: q.accountType as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { domain: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.account.count({ where }),
      prisma.account.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, opportunities: true, deals: true } },
        },
        orderBy: { [q.sortBy || "updatedAt"]: q.sortDir || "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  app.post("/api/v1/accounts", { preHandler: app.authenticate }, async (req, reply) => {
    const body = accountSchema.parse(req.body);
    const account = await prisma.account.create({
      data: { ...body, tenantId: req.authUser.tenantId },
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
        deals: {
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
    return account;
  });

  app.patch("/api/v1/accounts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = accountSchema.partial().parse(req.body);
    const existing = await prisma.account.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Account not found" });

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
}
