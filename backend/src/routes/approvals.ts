import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";

const decisionSchema = z.object({
  comments: z.string().optional().nullable(),
  approverComment: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
});

export default async function approvalRoutes(app: FastifyInstance) {
  // GET /api/v1/opportunities/approvals/pending (or all with status filter)
  app.get("/api/v1/opportunities/approvals/pending", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      status?: string;
      requestedStage?: string;
      requestedById?: string;
      accountId?: string;
      search?: string;
    };

    const isManager = req.authUser.orgRole === "MANAGER";
    const statusFilter = q.status && q.status !== "all" ? (q.status as any) : "PENDING";

    const where: any = {
      tenantId: req.authUser.tenantId,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q.requestedById ? { requestedById: q.requestedById } : {}),
      ...(q.requestedStage ? { toStage: { name: { equals: q.requestedStage, mode: "insensitive" } } } : {}),
      ...(q.accountId ? { opportunity: { accountId: q.accountId } } : {}),
      ...(q.search
        ? {
            opportunity: {
              name: { contains: q.search, mode: "insensitive" },
            },
          }
        : {}),
      ...(isManager
        ? { requestedById: req.authUser.id }
        : {
            OR: [
              { approverId: req.authUser.id },
              { approverId: null },
              ...(req.authUser.orgRole === "SENIOR_PARTNER" ? [{ tenantId: req.authUser.tenantId }] : []),
            ],
          }),
    };

    const approvals = await prisma.stageApproval.findMany({
      where,
      include: {
        opportunity: {
          include: {
            account: { select: { id: true, name: true, owner: { select: { firstName: true, lastName: true } } } },
            contact: { select: { id: true, firstName: true, lastName: true } },
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
        fromStage: true,
        toStage: true,
        attachments: {
          include: {
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { data: approvals };
  });

  // POST /api/v1/opportunities/approvals/:id/approve (Partner / Senior Partner only)
  app.post("/api/v1/opportunities/approvals/:id/approve", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can approve stage changes." });
    }

    const { id } = req.params as { id: string };
    const body = decisionSchema.parse(req.body || {});

    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: { opportunity: true, toStage: true, requestedBy: true },
    });

    if (!approval) {
      return reply.code(404).send({ error: "Stage approval request not found" });
    }

    if (approval.status !== "PENDING") {
      return reply.code(400).send({ error: "This approval request has already been processed." });
    }

    // STRICT RULE: User cannot approve their own request! (requesterId != reviewerId)
    if (approval.requestedById === req.authUser.id) {
      return reply.code(403).send({ error: "You cannot approve your own stage change request." });
    }

    const targetStage = approval.toStage;
    const isClosingWon = targetStage.isClosed && targetStage.isWon;
    const isClosingLost = targetStage.isClosed && !targetStage.isWon;
    const approverComment = body.approverComment || body.comments || null;

    // Execute atomic transaction to prevent concurrency issues
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify pending state inside transaction
      const current = await tx.stageApproval.findUnique({ where: { id } });
      if (!current || current.status !== "PENDING") {
        throw new Error("This approval request has already been processed by another reviewer.");
      }

      const updatedApproval = await tx.stageApproval.update({
        where: { id },
        data: {
          status: "APPROVED",
          approverId: req.authUser.id,
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
          approverComment: approverComment,
          comments: approverComment,
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
          ...(isClosingWon ? {
            loeValue: approval.loeValue ?? undefined,
            loeUnit: approval.loeUnit ?? "Hours",
            poNumber: approval.poNumber ?? undefined,
            poValue: approval.poValue ?? undefined,
            actualDealValue: approval.poValue ? approval.poValue : undefined,
          } : {}),
        },
      });

      if (isClosingWon) {
        // Link any attachments created during the approval request to the opportunity
        await tx.opportunityAttachment.updateMany({
          where: { stageApprovalId: id },
          data: { opportunityId: approval.opportunityId },
        });

        const acct = await tx.account.findUnique({ where: { id: updatedOpp.accountId } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const addRev = approval.poValue ? Number(approval.poValue) : Number(updatedOpp.amount);
          await tx.account.update({
            where: { id: updatedOpp.accountId },
            data: { annualRevenue: currentRev + addRev },
          });
        }
      }

      await tx.opportunityStageHistory.create({
        data: {
          opportunityId: approval.opportunityId,
          fromStageId: approval.fromStageId,
          toStageId: approval.toStageId,
          changedById: req.authUser.id,
        },
      });

      return { approval: updatedApproval, opportunity: updatedOpp };
    }).catch((err) => {
      return reply.code(400).send({ error: err.message });
    });

    if (!result || "error" in result) return;

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_APPROVED",
      newValues: { approvalId: id, toStage: targetStage.name, reviewerId: req.authUser.id },
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: approval.requestedById,
      message: `Your stage change request for "${approval.opportunity.name}" to "${targetStage.name}" was APPROVED by ${req.authUser.firstName} ${req.authUser.lastName}.`,
      link: `/opportunities/${approval.opportunityId}`,
    });

    return result;
  });

  // POST /api/v1/opportunities/approvals/:id/disapprove (Partner / Senior Partner only)
  app.post("/api/v1/opportunities/approvals/:id/disapprove", { preHandler: app.authenticate }, async (req, reply) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Only Partners and Senior Partners can disapprove stage changes." });
    }

    const { id } = req.params as { id: string };
    const body = decisionSchema.parse(req.body || {});
    const commentText = (body.approverComment || body.comments || body.reason || "").trim();

    // REQUIRE MANDATORY COMMENT FOR DISAPPROVAL
    if (!commentText) {
      return reply.code(400).send({ error: "Reason for disapproval is required and cannot be empty." });
    }

    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: { opportunity: true, toStage: true, fromStage: true },
    });

    if (!approval) {
      return reply.code(404).send({ error: "Stage approval request not found" });
    }

    if (approval.status !== "PENDING") {
      return reply.code(400).send({ error: "This approval request has already been processed." });
    }

    // STRICT RULE: User cannot disapprove their own request! (requesterId != reviewerId)
    if (approval.requestedById === req.authUser.id) {
      return reply.code(403).send({ error: "You cannot disapprove your own stage change request." });
    }

    const updatedApproval = await prisma.$transaction(async (tx) => {
      const current = await tx.stageApproval.findUnique({ where: { id } });
      if (!current || current.status !== "PENDING") {
        throw new Error("This approval request has already been processed.");
      }

      return tx.stageApproval.update({
        where: { id },
        data: {
          status: "DISAPPROVED",
          approverId: req.authUser.id,
          reviewedById: req.authUser.id,
          reviewedAt: new Date(),
          approverComment: commentText,
          comments: commentText,
        },
      });
    }).catch((err) => {
      return reply.code(400).send({ error: err.message });
    });

    if (!updatedApproval || "error" in updatedApproval) return;

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_DISAPPROVED",
      newValues: { approvalId: id, approverComment: commentText, reviewerId: req.authUser.id },
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: approval.requestedById,
      message: `Your stage change request for "${approval.opportunity.name}" to "${approval.toStage.name}" was DISAPPROVED. Reason: "${commentText}"`,
      link: `/opportunities/${approval.opportunityId}`,
    });

    return updatedApproval;
  });

  // Alias /reject endpoint for backwards compatibility -> calls disapprove logic
  app.post("/api/v1/opportunities/approvals/:id/reject", { preHandler: app.authenticate }, async (req, reply) => {
    const body = decisionSchema.parse(req.body || {});
    const commentText = (body.approverComment || body.comments || body.reason || "").trim();
    if (!commentText) {
      return reply.code(400).send({ error: "Reason for disapproval is required and cannot be empty." });
    }

    const { id } = req.params as { id: string };
    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: { opportunity: true, toStage: true },
    });

    if (!approval) return reply.code(404).send({ error: "Stage approval request not found" });
    if (approval.status !== "PENDING") return reply.code(400).send({ error: "This approval request has already been processed." });
    if (approval.requestedById === req.authUser.id) return reply.code(403).send({ error: "You cannot disapprove your own stage change request." });

    const updatedApproval = await prisma.stageApproval.update({
      where: { id },
      data: {
        status: "DISAPPROVED",
        approverId: req.authUser.id,
        reviewedById: req.authUser.id,
        reviewedAt: new Date(),
        approverComment: commentText,
        comments: commentText,
      },
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_DISAPPROVED",
      newValues: { approvalId: id, approverComment: commentText },
    });

    await notify({
      tenantId: req.authUser.tenantId,
      userId: approval.requestedById,
      message: `Your stage change request for "${approval.opportunity.name}" to "${approval.toStage.name}" was DISAPPROVED. Reason: "${commentText}"`,
      link: `/opportunities/${approval.opportunityId}`,
    });

    return updatedApproval;
  });

  // POST /api/v1/opportunities/approvals/:id/cancel (requester or partner)
  app.post("/api/v1/opportunities/approvals/:id/cancel", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const approval = await prisma.stageApproval.findFirst({
      where: { id, tenantId: req.authUser.tenantId, status: "PENDING" },
    });

    if (!approval) {
      return reply.code(404).send({ error: "Pending stage approval request not found" });
    }

    const isPartner = req.authUser.orgRole === "PARTNER" || req.authUser.orgRole === "SENIOR_PARTNER";
    if (approval.requestedById !== req.authUser.id && !isPartner) {
      return reply.code(403).send({ error: "Only the requester or a Partner can cancel this request." });
    }

    const cancelled = await prisma.stageApproval.update({
      where: { id },
      data: {
        status: "CANCELLED",
      },
    });

    await logAudit({
      tenantId: req.authUser.tenantId,
      userId: req.authUser.id,
      objectType: "OPPORTUNITY",
      recordId: approval.opportunityId,
      action: "STAGE_APPROVAL_CANCELLED",
      newValues: { approvalId: id },
    });

    return cancelled;
  });
}
