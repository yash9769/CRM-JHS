import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  jobTitle: z.string().optional().nullable(),
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

export default async function contactRoutes(app: FastifyInstance) {
  app.get("/api/v1/contacts", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string;
      pageSize?: string;
      search?: string;
      accountId?: string;
      ownerId?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || "25")));

    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.search
        ? {
            OR: [
              { firstName: { contains: q.search, mode: "insensitive" as const } },
              { lastName: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

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

  app.post("/api/v1/contacts", { preHandler: app.authenticate }, async (req, reply) => {
    const body = contactSchema.parse(req.body);
    if (body.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: body.accountId, tenantId: req.authUser.tenantId },
      });
      if (!account) return reply.code(400).send({ error: "Account not found for this tenant" });
    }
    const contact = await prisma.contact.create({ data: { ...body, tenantId: req.authUser.tenantId } });
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
        dealContacts: { include: { deal: { include: { stage: true } } } },
        activities: { orderBy: { createdAt: "desc" }, take: 50 },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!contact) return reply.code(404).send({ error: "Contact not found" });
    return contact;
  });

  app.patch("/api/v1/contacts/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = contactSchema.partial().parse(req.body);
    const existing = await prisma.contact.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Contact not found" });
    const contact = await prisma.contact.update({ where: { id }, data: body });
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
}
