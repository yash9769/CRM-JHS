import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";

const opportunitySchema = z.object({
  name: z.string().min(1),
  accountId: z.string().uuid(),
  amount: z.number().positive("Opportunity amount must be greater than 0"),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid(),
  opportunityType: z.enum(["NEW_BUSINESS", "EXPANSION", "RENEWAL"]).optional(),
  leadSource: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

export default async function opportunityRoutes(app: FastifyInstance) {
  app.get("/api/v1/opportunities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string; isConverted?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || "25")));

    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.isConverted !== undefined ? { isConverted: q.isConverted === "true" } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        include: {
          account: { select: { id: true, name: true } },
          stage: true,
          pipeline: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  app.post("/api/v1/opportunities", { preHandler: app.authenticate }, async (req, reply) => {
    const body = opportunitySchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const [account, stage] = await Promise.all([
      prisma.account.findFirst({ where: { id: body.accountId, tenantId } }),
      prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId, pipeline: { tenantId } },
      }),
    ]);
    if (!account) return reply.code(400).send({ error: "Account not found for this tenant" });
    if (!stage) return reply.code(400).send({ error: "Stage does not belong to the specified pipeline" });

    const opportunity = await prisma.$transaction(async (tx) => {
      const opp = await tx.opportunity.create({
        data: {
          tenantId,
          name: body.name,
          accountId: body.accountId,
          amount: body.amount,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          probability: body.probability ?? stage.probability,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          ownerId: body.ownerId,
          opportunityType: body.opportunityType,
          leadSource: body.leadSource,
          description: body.description,
          properties: body.properties ?? {},
          contacts: body.contactIds
            ? { create: body.contactIds.map((contactId) => ({ contactId })) }
            : undefined,
        },
      });
      await tx.opportunityStageHistory.create({
        data: { opportunityId: opp.id, toStageId: body.stageId, changedById: req.authUser.id },
      });
      return opp;
    });

    await logAudit({
      tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: opportunity.id, action: "CREATED", newValues: opportunity,
    });

    return reply.code(201).send(opportunity);
  });

  app.get("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const opp = await prisma.opportunity.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { include: { contact: true } },
        activities: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
        convertedDeal: true,
      },
    });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    return opp;
  });

  app.patch("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = opportunitySchema.partial().parse(req.body);
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    if (existing.isConverted) return reply.code(400).send({ error: "Cannot edit an opportunity already converted to a deal" });

    const stageChanged = body.stageId && body.stageId !== existing.stageId;
    if (stageChanged) {
      const stage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId ?? existing.pipelineId },
      });
      if (!stage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });
    }

    const { contactIds, ...rest } = body;
    const opportunity = await prisma.$transaction(async (tx) => {
      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          ...rest,
          expectedCloseDate: rest.expectedCloseDate ? new Date(rest.expectedCloseDate) : undefined,
        },
      });
      if (stageChanged) {
        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: id,
            fromStageId: existing.stageId,
            toStageId: body.stageId!,
            changedById: req.authUser.id,
          },
        });
      }
      if (contactIds) {
        await tx.opportunityContact.deleteMany({ where: { opportunityId: id } });
        await tx.opportunityContact.createMany({
          data: contactIds.map((contactId) => ({ opportunityId: id, contactId })),
        });
      }
      return updated;
    });

    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: stageChanged ? "STAGE_CHANGED" : "UPDATED", oldValues: existing, newValues: opportunity,
    });

    return opportunity;
  });

  app.delete("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    await prisma.opportunity.delete({ where: { id } });
    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: "DELETED", oldValues: existing,
    });
    return reply.code(204).send();
  });

  // Convert a qualified Opportunity into a Deal.
  // Preserves account, contacts, amount, owner, activities; keeps a reference
  // back to the originating Opportunity; never deletes the Opportunity.
  const convertSchema = z.object({
    dealName: z.string().optional(),
    dealPipelineId: z.string().uuid(),
    dealStageId: z.string().uuid(),
    closeDate: z.string().datetime().optional().nullable(),
  });

  app.post("/api/v1/opportunities/:id/convert", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = convertSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const opp = await prisma.opportunity.findFirst({
      where: { id, tenantId },
      include: { contacts: true },
    });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    if (opp.isConverted) return reply.code(400).send({ error: "Opportunity has already been converted" });

    const dealStage = await prisma.pipelineStage.findFirst({
      where: { id: body.dealStageId, pipelineId: body.dealPipelineId, pipeline: { tenantId } },
    });
    if (!dealStage) return reply.code(400).send({ error: "Invalid deal stage/pipeline" });

    const result = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          tenantId,
          name: body.dealName || opp.name,
          accountId: opp.accountId,
          opportunityId: opp.id,
          amount: opp.amount,
          pipelineId: body.dealPipelineId,
          stageId: body.dealStageId,
          probability: dealStage.probability,
          closeDate: body.closeDate ? new Date(body.closeDate) : opp.expectedCloseDate,
          ownerId: opp.ownerId,
          description: opp.description,
          properties: opp.properties as any,
          contacts: { create: opp.contacts.map((c) => ({ contactId: c.contactId, role: c.role })) },
        },
      });

      await tx.dealStageHistory.create({
        data: { dealId: deal.id, toStageId: body.dealStageId, changedById: req.authUser.id },
      });

      // Re-point the opportunity's activities/notes to also reference the new deal
      // (kept on the opportunity too — history is preserved, nothing is deleted).
      await tx.activity.updateMany({
        where: { opportunityId: opp.id },
        data: { dealId: deal.id },
      });

      const updatedOpp = await tx.opportunity.update({
        where: { id: opp.id },
        data: { isConverted: true, convertedDealId: deal.id },
      });

      await tx.association.create({
        data: {
          tenantId,
          fromObjectType: "OPPORTUNITY",
          fromRecordId: opp.id,
          toObjectType: "DEAL",
          toRecordId: deal.id,
          associationLabel: "converted_to",
        },
      });

      return { deal, updatedOpp };
    });

    await logAudit({
      tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: opp.id, action: "CONVERTED_TO_DEAL", newValues: { dealId: result.deal.id },
    });
    await notify({
      tenantId, userId: opp.ownerId,
      message: `"${opp.name}" was converted to a deal`, link: `/deals/${result.deal.id}`,
    });

    return reply.code(201).send(result.deal);
  });
}
