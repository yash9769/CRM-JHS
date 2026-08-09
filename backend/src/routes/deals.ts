import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";

const dealSchema = z.object({
  name: z.string().min(1),
  accountId: z.string().uuid(),
  amount: z.number().positive(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  closeDate: z.string().datetime().optional().nullable(),
  ownerId: z.string().uuid(),
  probability: z.number().int().min(0).max(100).optional(),
  dealType: z.string().optional().nullable(),
  forecastCategory: z.enum(["PIPELINE", "BEST_CASE", "COMMIT", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  description: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

export default async function dealRoutes(app: FastifyInstance) {
  app.get("/api/v1/deals", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize || "25")));

    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
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

  app.post("/api/v1/deals", { preHandler: app.authenticate }, async (req, reply) => {
    const body = dealSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;
    const [account, stage] = await Promise.all([
      prisma.account.findFirst({ where: { id: body.accountId, tenantId } }),
      prisma.pipelineStage.findFirst({ where: { id: body.stageId, pipelineId: body.pipelineId, pipeline: { tenantId } } }),
    ]);
    if (!account) return reply.code(400).send({ error: "Account not found for this tenant" });
    if (!stage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });

    const deal = await prisma.$transaction(async (tx) => {
      const d = await tx.deal.create({
        data: {
          tenantId,
          name: body.name,
          accountId: body.accountId,
          amount: body.amount,
          pipelineId: body.pipelineId,
          stageId: body.stageId,
          closeDate: body.closeDate ? new Date(body.closeDate) : null,
          ownerId: body.ownerId,
          probability: body.probability ?? stage.probability,
          dealType: body.dealType,
          forecastCategory: body.forecastCategory,
          description: body.description,
          properties: body.properties ?? {},
          contacts: body.contactIds ? { create: body.contactIds.map((contactId) => ({ contactId })) } : undefined,
        },
      });
      await tx.dealStageHistory.create({ data: { dealId: d.id, toStageId: body.stageId, changedById: req.authUser.id } });
      return d;
    });

    await logAudit({ tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: deal.id, action: "CREATED", newValues: deal });
    return reply.code(201).send(deal);
  });

  app.get("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const deal = await prisma.deal.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: true,
        opportunity: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { include: { contact: true } },
        lineItems: { include: { product: true } },
        quotes: true,
        activities: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
      },
    });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    return deal;
  });

  app.patch("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = dealSchema.partial().parse(req.body);
    const existing = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Deal not found" });

    const stageChanged = body.stageId && body.stageId !== existing.stageId;
    let targetStage = null;
    if (stageChanged) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId ?? existing.pipelineId },
      });
      if (!targetStage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });

      // Business rule: a Closed Won deal must have amount and close date (defaults to today if not provided).
      if (targetStage.isClosed && targetStage.isWon) {
        const amount = body.amount ?? existing.amount;
        if (!amount || Number(amount) <= 0) return reply.code(400).send({ error: "A valid amount is required to mark a deal Closed Won" });
      }
    }

    const { contactIds, ...rest } = body;
    const deal = await prisma.$transaction(async (tx) => {
      const isClosingWon = !!targetStage?.isClosed && targetStage.isWon;
      const isClosingLost = !!targetStage?.isClosed && !targetStage.isWon;

      const finalCloseDate = rest.closeDate
        ? new Date(rest.closeDate)
        : (isClosingWon ? (existing.closeDate ?? new Date()) : undefined);

      const updated = await tx.deal.update({
        where: { id },
        data: {
          ...rest,
          ...(finalCloseDate !== undefined && { closeDate: finalCloseDate }),
          probability: stageChanged ? targetStage!.probability : rest.probability,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : rest.forecastCategory,
          wonDate: isClosingWon ? (existing.wonDate ?? new Date()) : undefined,
        },
      });

      if (stageChanged) {
        await tx.dealStageHistory.create({
          data: { dealId: id, fromStageId: existing.stageId, toStageId: body.stageId!, changedById: req.authUser.id },
        });
      }
      if (contactIds) {
        await tx.dealContact.deleteMany({ where: { dealId: id } });
        await tx.dealContact.createMany({ data: contactIds.map((contactId) => ({ dealId: id, contactId })) });
      }
      if (isClosingWon) {
        // Bump the account's revenue metrics safely.
        const acct = await tx.account.findUnique({ where: { id: updated.accountId } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const newRev = currentRev + Number(updated.amount);
          await tx.account.update({
            where: { id: updated.accountId },
            data: { annualRevenue: newRev },
          });
        }
      }
      return updated;
    });

    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: id,
      action: stageChanged ? "STAGE_CHANGED" : "UPDATED", oldValues: existing, newValues: deal,
    });

    if (targetStage?.isClosed) {
      await notify({
        tenantId: req.authUser.tenantId, userId: deal.ownerId,
        message: `Deal "${deal.name}" was marked ${targetStage.isWon ? "Closed Won 🎉" : "Closed Lost"}`,
        link: `/deals/${deal.id}`,
      });
    }

    return deal;
  });

  app.delete("/api/v1/deals/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Deal not found" });
    await prisma.deal.delete({ where: { id } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "DEAL", recordId: id, action: "DELETED", oldValues: existing });
    return reply.code(204).send();
  });

  // --- Line items (Products on a Deal) ---
  const lineItemSchema = z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    discountPct: z.number().min(0).max(100).optional(),
    taxPct: z.number().min(0).max(100).optional(),
  });

  app.post("/api/v1/deals/:id/line-items", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse(req.body);
    const deal = await prisma.deal.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId: req.authUser.tenantId } });
    if (!product) return reply.code(400).send({ error: "Product not found" });
    if (!product.active) return reply.code(400).send({ error: "Inactive products cannot be added" });

    const unitPrice = Number(product.unitPrice);
    const subtotal = body.quantity * unitPrice;
    const discountAmount = subtotal * ((body.discountPct ?? 0) / 100);
    const taxable = subtotal - discountAmount;
    const total = taxable + taxable * ((body.taxPct ?? 0) / 100);

    const lineItem = await prisma.lineItem.create({
      data: {
        productId: body.productId,
        dealId: id,
        quantity: body.quantity,
        unitPrice,
        discountPct: body.discountPct ?? 0,
        taxPct: body.taxPct ?? 0,
        total,
      },
    });

    // Recompute deal amount as sum of line items.
    const items = await prisma.lineItem.findMany({ where: { dealId: id } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.deal.update({ where: { id }, data: { amount: newAmount } });

    return reply.code(201).send(lineItem);
  });

  app.delete("/api/v1/deals/:dealId/line-items/:lineItemId", { preHandler: app.authenticate }, async (req, reply) => {
    const { dealId, lineItemId } = req.params as { dealId: string; lineItemId: string };
    const deal = await prisma.deal.findFirst({ where: { id: dealId, tenantId: req.authUser.tenantId } });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });
    await prisma.lineItem.delete({ where: { id: lineItemId } });
    const items = await prisma.lineItem.findMany({ where: { dealId } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.deal.update({ where: { id: dealId }, data: { amount: newAmount } });
    return reply.code(204).send();
  });
}
