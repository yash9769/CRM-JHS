import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";

const activitySchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "FOLLOW_UP", "DEMO", "PROPOSAL", "OTHER"]),
  subject: z.string().min(1),
  body: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
  objectType: z.enum(["ACCOUNT", "CONTACT", "OPPORTUNITY", "DEAL", "QUOTE", "LEAD"]),
  accountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional(),
});

const noteSchema = z.object({
  body: z.string().min(1),
  accountId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  opportunityId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
});

export default async function activityRoutes(app: FastifyInstance) {
  app.get("/api/v1/activities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { accountId?: string; contactId?: string; opportunityId?: string; dealId?: string; leadId?: string; status?: string; ownerId?: string; dueBefore?: string; dueAfter?: string; type?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.contactId ? { contactId: q.contactId } : {}),
      ...(q.opportunityId ? { opportunityId: q.opportunityId } : {}),
      ...(q.dealId ? { dealId: q.dealId } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.dueBefore || q.dueAfter
        ? { dueDate: { ...(q.dueBefore ? { lte: new Date(q.dueBefore) } : {}), ...(q.dueAfter ? { gte: new Date(q.dueAfter) } : {}) } }
        : {}),
    };
    const data = await prisma.activity.findMany({
      where,
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        opportunity: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return { data };
  });

  // EXPORT — CSV of activities/tasks matching filters
  app.get("/api/v1/activities/export", { preHandler: app.authenticate }, async (req, reply) => {
    const q = req.query as {
      type?: string;
      status?: string;
      ownerId?: string;
      accountId?: string;
      contactId?: string;
      opportunityId?: string;
      dealId?: string;
      leadId?: string;
      search?: string;
    };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.type ? { type: q.type as any } : {}),
      ...(q.status ? { status: q.status as any } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.contactId ? { contactId: q.contactId } : {}),
      ...(q.opportunityId ? { opportunityId: q.opportunityId } : {}),
      ...(q.dealId ? { dealId: q.dealId } : {}),
      ...(q.leadId ? { leadId: q.leadId } : {}),
      ...(q.search ? { subject: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    const activities = await prisma.activity.findMany({
      where,
      include: {
        owner: { select: { firstName: true, lastName: true } },
        account: { select: { name: true } },
        contact: { select: { firstName: true, lastName: true } },
        opportunity: { select: { name: true } },
        deal: { select: { name: true } },
        lead: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const rows = activities.map((a) => {
      let relatedEntity = "";
      if (a.account) relatedEntity = `Account: ${a.account.name}`;
      else if (a.deal) relatedEntity = `Deal: ${a.deal.name}`;
      else if (a.opportunity) relatedEntity = `Opportunity: ${a.opportunity.name}`;
      else if (a.lead) relatedEntity = `Lead: ${a.lead.firstName} ${a.lead.lastName}`;
      else if (a.contact) relatedEntity = `Contact: ${a.contact.firstName} ${a.contact.lastName}`;

      return {
        subject: a.subject,
        type: a.type,
        status: a.status,
        dueDate: a.dueDate ? a.dueDate.toISOString().slice(0, 10) : "",
        assignedTo: a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : "",
        relatedEntity,
        notes: a.body || "",
        createdAt: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "",
      };
    });
    const csv = toCsv(rows, [
      { key: "subject", label: "Subject" },
      { key: "type", label: "Type" },
      { key: "status", label: "Status" },
      { key: "dueDate", label: "Due Date" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "relatedEntity", label: "Related Entity" },
      { key: "notes", label: "Notes" },
      { key: "createdAt", label: "Created Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="tasks.csv"');
    return reply.send(csv);
  });

  app.post("/api/v1/activities", { preHandler: app.authenticate }, async (req, reply) => {
    const body = activitySchema.parse(req.body);
    const activity = await prisma.activity.create({
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        tenantId: req.authUser.tenantId,
        ownerId: body.ownerId || req.authUser.id,
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
