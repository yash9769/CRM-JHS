import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getVisibleUserIds, requireCanAccess } from "../lib/rbac.js";

export default async function auditHistoryRoutes(app: FastifyInstance) {
  // Audit log endpoint with RBAC hierarchy filtering:
  // Senior Partner -> Sees all logs
  // Partner -> Sees logs for self + managers/users reporting under them
  // Manager -> Sees logs for self + users reporting under them
  app.get("/api/v1/audit-log", { preHandler: [app.authenticate] }, async (req: any, reply: any) => {
    const { objectType, recordId, limit } = req.query as { objectType?: string; recordId?: string; limit?: string };

    const tenantId = req.authUser.tenantId;

    // Single opportunity / record check
    if (objectType === "OPPORTUNITY" && recordId) {
      const opp = await prisma.opportunity.findUnique({
        where: { id: recordId },
        select: { createdById: true, ownerId: true },
      });
      if (opp) {
        try {
          await requireCanAccess(req.authUser, opp, "read");
        } catch (err: any) {
          return reply.code(403).send({ error: "Access denied to opportunity logs" });
        }
      }
    }

    const where: any = {
      tenantId,
      ...(objectType ? { objectType } : {}),
      ...(recordId ? { recordId } : {}),
    };

    // If not Senior Partner AND not requesting logs for a specific recordId, restrict logs to visible users in team hierarchy
    if (req.authUser.orgRole !== "SENIOR_PARTNER" && !recordId) {
      const visibleUserIds = await getVisibleUserIds(req.authUser);
      where.userId = { in: visibleUserIds };
    }

    const data = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, orgRole: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ? Math.min(Number(limit), 200) : 100,
    });

    return { data };
  });
}
