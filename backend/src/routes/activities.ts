import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";

const activitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "FOLLOW_UP", "DEMO", "PROPOSAL", "OTHER"]),
  subject: z.string().min(1),
  body: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  objectType: z.enum(["ACCOUNT", "CONTACT", "OPPORTUNITY", "DEAL", "QUOTE"]),
  accountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
});

const noteSchema = z.object({
  body: z.string().min(1),
  accountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
});

export default async function activityRoutes(app: FastifyInstance) {
  app.get("/api/v1/activities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { accountId?: string; contactId?: string; opportunityId?: string; dealId?: string; status?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.contactId ? { contactId: q.contactId } : {}),
      ...(q.opportunityId ? { opportunityId: q.opportunityId } : {}),
      ...(q.dealId ? { dealId: q.dealId } : {}),
      ...(q.status ? { status: q.status as any } : {}),
    };
    const data = await prisma.activity.findMany({
      where,
      include: { owner: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { data };
  });

  app.post("/api/v1/activities", { preHandler: app.authenticate }, async (req, reply) => {
    const body = activitySchema.parse(req.body);
    const activity = await prisma.activity.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        tenantId: req.authUser.tenantId,
        ownerId: req.authUser.id,
        completedDate: body.status === "COMPLETED" ? new Date() : null,
      },
    });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "ACTIVITY", recordId: activity.id, action: "CREATED", newValues: activity });
    return reply.code(201).send(activity);
  });

  app.patch("/api/v1/activities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = activitySchema.partial().parse(req.body);
    const existing = await prisma.activity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Activity not found" });
    const activity = await prisma.activity.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
        completedDate: body.status === "COMPLETED" ? new Date() : existing.completedDate,
      },
    });
    return activity;
  });

  // Notes
  app.post("/api/v1/notes", { preHandler: app.authenticate }, async (req, reply) => {
    const body = noteSchema.parse(req.body);
    const note = await prisma.note.create({
      data: { ...body, tenantId: req.authUser.tenantId, authorId: req.authUser.id },
    });
    return reply.code(201).send(note);
  });

  app.patch("/api/v1/notes/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z.object({ body: z.string().min(1) }).parse(req.body);
    const existing = await prisma.note.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Note not found" });
    return prisma.note.update({ where: { id }, data: { body: body.body } });
  });

  app.delete("/api/v1/notes/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.note.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Note not found" });
    await prisma.note.delete({ where: { id } });
    return reply.code(204).send();
  });
}
