import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function pipelineRoutes(app: FastifyInstance) {
  app.get("/api/v1/pipelines", { preHandler: app.authenticate }, async (req) => {
    const { type } = req.query as { type?: "OPPORTUNITY" };
    const pipelines = await prisma.pipeline.findMany({
      where: { tenantId: req.authUser.tenantId, ...(type ? { type } : {}) },
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: { name: "asc" },
    });
    return { data: pipelines };
  });
}
