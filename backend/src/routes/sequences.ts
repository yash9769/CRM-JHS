import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { SequenceStepType, EnrollmentStatus } from "@prisma/client";
import { getCreatedByFilter, requireCanAccess } from "../lib/rbac.js";

const StepTypeSchema = z.enum(["EMAIL", "WAIT", "TASK", "CALL_REMINDER"]);

const CreateSequenceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    type: StepTypeSchema,
    config: z.record(z.any()).optional(),
  })).optional(),
});

const EnrollSchema = z.object({
  contactIds: z.array(z.string()).min(1),
});

export default async function sequenceRoutes(app: FastifyInstance) {
  app.get("/api/v1/sequences", { preHandler: [app.authenticate] }, async (req: any) => {
    const sequences = await prisma.sequence.findMany({
      where: { tenantId: req.authUser.tenantId, ...(await getCreatedByFilter(req.authUser)) },
      include: {
        steps: { orderBy: { order: "asc" } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { enrollments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return { data: sequences };
  });

  app.get("/api/v1/sequences/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const seq = await prisma.sequence.findFirst({
      where: { id: req.params.id, tenantId: req.authUser.tenantId },
      include: {
        steps: { orderBy: { order: "asc" } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        enrollments: {
          include: { contact: { select: { id: true, firstName: true, lastName: true, email: true } } },
          orderBy: { enrolledAt: "desc" },
          take: 50,
        },
      },
    });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    return seq;
  });

  app.post("/api/v1/sequences", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = CreateSequenceSchema.parse(req.body);
    const sequence = await prisma.sequence.create({
      data: {
        tenantId: req.authUser.tenantId,
        name: body.name,
        description: body.description,
        ownerId: req.authUser.id,
        steps: body.steps ? {
          create: body.steps.map(s => ({
            order: s.order,
            type: s.type as SequenceStepType,
            config: s.config || {},
          })),
        } : undefined,
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, action: "CREATE", objectType: "Sequence", recordId: sequence.id, newValues: sequence });
    return reply.code(201).send(sequence);
  });

  app.patch("/api/v1/sequences/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = z.object({ name: z.string().optional(), description: z.string().optional() }).parse(req.body);
    const existing = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, existing);
    const updated = await prisma.sequence.update({ where: { id: req.params.id }, data: body });
    return updated;
  });

  app.delete("/api/v1/sequences/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const existing = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, existing);
    await prisma.sequenceEnrollment.deleteMany({ where: { sequenceId: req.params.id } });
    await prisma.sequenceStep.deleteMany({ where: { sequenceId: req.params.id } });
    await prisma.sequence.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  app.post("/api/v1/sequences/:id/steps", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = z.object({ order: z.number().int().positive(), type: StepTypeSchema, config: z.record(z.any()).optional() }).parse(req.body);
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    const step = await prisma.sequenceStep.create({
      data: { sequenceId: req.params.id, order: body.order, type: body.type as SequenceStepType, config: body.config || {} },
    });
    return reply.code(201).send(step);
  });

  app.delete("/api/v1/sequences/:id/steps/:stepId", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    await prisma.sequenceStep.delete({ where: { id: req.params.stepId } });
    return reply.code(204).send();
  });

  app.post("/api/v1/sequences/:id/enroll", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const { contactIds } = EnrollSchema.parse(req.body);
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    let enrolled = 0;
    for (const contactId of contactIds) {
      try {
        const existing = await prisma.sequenceEnrollment.findFirst({ where: { sequenceId: req.params.id, contactId } });
        if (existing) {
          await prisma.sequenceEnrollment.update({ where: { id: existing.id }, data: { status: EnrollmentStatus.ACTIVE } });
        } else {
          await prisma.sequenceEnrollment.create({ data: { sequenceId: req.params.id, contactId, status: EnrollmentStatus.ACTIVE } });
        }
        enrolled++;
      } catch { /* skip */ }
    }
    return { enrolled, total: contactIds.length };
  });

  app.get("/api/v1/sequences/:id/enrollments", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: { sequenceId: req.params.id },
      include: { contact: { select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true } } },
      orderBy: { enrolledAt: "desc" },
    });
    return { data: enrollments };
  });

  app.delete("/api/v1/sequences/:id/enrollments/:enrollmentId", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const seq = await prisma.sequence.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!seq) return reply.code(404).send({ error: "Sequence not found" });
    await requireCanAccess(req.authUser, seq);
    await prisma.sequenceEnrollment.update({ where: { id: req.params.enrollmentId }, data: { status: EnrollmentStatus.UNENROLLED } });
    return reply.code(204).send();
  });
}
