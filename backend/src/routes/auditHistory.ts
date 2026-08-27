import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function auditHistoryRoutes(app: FastifyInstance) {
  // History for a single record, newest first — used by the detail-page "History" panel.
  app.get("/api/v1/audit-log", { preHandler: app.authenticate }, async (req) => {
    const { objectType, recordId } = req.query as { objectType?: string; recordId?: string };
    if (!objectType || !recordId) return { data: [] };
    const data = await prisma.auditLog.findMany({
      where: { tenantId: req.authUser.tenantId, objectType, recordId },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { data };
  });
}
