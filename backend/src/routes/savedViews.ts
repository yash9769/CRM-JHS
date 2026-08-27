import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const savedViewSchema = z.object({
  objectType: z.enum(["LEAD", "ACCOUNT", "CONTACT", "OPPORTUNITY"]),
  name: z.string().min(1),
  filters: z.record(z.any()).default({}),
  sortBy: z.string().optional().nullable(),
  sortDir: z.enum(["asc", "desc"]).optional().nullable(),
  columns: z.array(z.string()).optional().nullable(),
});

export default async function savedViewRoutes(app: FastifyInstance) {
  app.get("/api/v1/saved-views", { preHandler: app.authenticate }, async (req) => {
    const { objectType } = req.query as { objectType?: string };
    const data = await prisma.savedView.findMany({
      where: { tenantId: req.authUser.tenantId, ownerId: req.authUser.id, ...(objectType ? { objectType } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return { data };
  });

  app.post("/api/v1/saved-views", { preHandler: app.authenticate }, async (req, reply) => {
    const body = savedViewSchema.parse(req.body);
    const view = await prisma.savedView.create({
      data: { ...body, columns: body.columns ?? undefined, tenantId: req.authUser.tenantId, ownerId: req.authUser.id },
    });
    return reply.code(201).send(view);
  });

  app.delete("/api/v1/saved-views/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.savedView.findFirst({ where: { id, tenantId: req.authUser.tenantId, ownerId: req.authUser.id } });
    if (!existing) return reply.code(404).send({ error: "Saved view not found" });
    await prisma.savedView.delete({ where: { id } });
    return reply.code(204).send();
  });
}
