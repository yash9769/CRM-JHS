import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";

const decisionSchema = z.object({
  comments: z.string().optional().nullable(),
});

export default async function approvalRoutes(app: FastifyInstance) {
  // Get all pending stage approvals for current user's tenant
  app.get("/api/v1/opportunities/approvals/pending", { preHandler: app.authenticate }, async (req) => {
    const isManager = req.authUser.orgRole === "MANAGER";

    const where = {
      tenantId: req.authUser.tenantId,
      status: "PENDING" as const,
      ...(isManager
        ? { requestedById: req.authUser.id }
        : {
            OR: [
              { approverId: req.authUser.id },
              { approverId: null },
              // If Senior Partner, show all tenant pending approvals
              ...(req.authUser.orgRole === "SENIOR_PARTNER" ? [{ tenantId: req.authUser.tenantId }] : []),
            ],
          }),
    };

    const approvals = await prisma.stageApproval.findMany({
      where,
      include: {
        opportunity: {
          include: {
            account: { select: { id: true, name: true } },
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        fromStage: true,
        toStage: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: approvals };
  });

  // Approve a stage change request (Partner / Senior Partner only)
  app.post("/api/v1/opportunities/approvals/:id/approve", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can approve stage changes." });
    }

    const { id } = req.params as { id: string };
    const body = decisionSchema.parse(req.body || {});

    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId, status: "PENDING" },
      include: { opportunity: true, toStage: true, requestedBy: true },
    });

    if (!approval) {
      return reply.code(404).send({ error: "Pending stage approval request not found" });
    }

    const targetStage = approval.toStage;
    const isClosingWon = targetStage.isClosed && targetStage.isWon;
    const isClosingLost = targetStage.isClosed && !targetStage.isWon;

    // Execute transaction: update approval & update opportunity stage
    const result = await prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.stageApproval.update({
        where: { id },
        data: {
          status: "APPROVED",
          approverId: req.authUser.id,
          comments: body.comments || null,
        },
      });

      const updatedOpp = await tx.opportunity.update({
        where: { id: approval.opportunityId },
        data: {
          stageId: approval.toStageId,
          probability: targetStage.probability,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : undefined,
          wonDate: isClosingWon ? new Date() : undefined,
          actualCloseDate: isClosingWon ? new Date() : undefined,
        },
      });

      await tx.opportunityStageHistory.create({
        data: {
          opportunityId: approval.opportunityId,
          fromStageId: approval.fromStageId,
          toStageId: approval.toStageId,
          changedById: req.authUser.id,
        },
      });

      return { approval: updatedApproval, opportunity: updatedOpp };
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_APPROVED",
      newValues: { approvalId: id, toStage: targetStage.name },
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: approval.requestedById,
      message: `Your stage change request for "${approval.opportunity.name}" to "${targetStage.name}" was approved!`,
      link: `/opportunities/${approval.opportunityId}`,
    });

    return result;
  });

  // Reject a stage change request (Partner / Senior Partner only)
  app.post("/api/v1/opportunities/approvals/:id/reject", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can reject stage changes." });
    }

    const { id } = req.params as { id: string };
    const body = decisionSchema.parse(req.body || {});

    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId, status: "PENDING" },
      include: { opportunity: true, toStage: true },
    });

    if (!approval) {
      return reply.code(404).send({ error: "Pending stage approval request not found" });
    }

    const updatedApproval = await prisma.stageApproval.update({
      where: { id },
      data: {
        status: "REJECTED",
        approverId: req.authUser.id,
        comments: body.comments || null,
      },
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_REJECTED",
      newValues: { approvalId: id, comments: body.comments },
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: approval.requestedById,
      message: `Your stage change request for "${approval.opportunity.name}" to "${approval.toStage.name}" was rejected.`,
      link: `/opportunities/${approval.opportunityId}`,
    });

    return updatedApproval;
  });
}
