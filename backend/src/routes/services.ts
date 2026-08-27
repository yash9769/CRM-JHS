import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const serviceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export default async function serviceRoutes(app: FastifyInstance) {
  // List services
  app.get("/api/v1/services", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { search?: string; active?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.active !== undefined ? { active: q.active === "true" } : {}),
      ...(q.search
        ? { name: { contains: q.search, mode: "insensitive" as const } }
        : {}),
    };
    const data = await prisma.service.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true } },
      },
    });
    return { data };
  });

  // Get single service
  app.get("/api/v1/services/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const service = await prisma.service.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        products: true,
        _count: { select: { products: true } },
      },
    });
    if (!service) return reply.code(404).send({ error: "Service not found" });
    return service;
  });

  // Create service
  app.post("/api/v1/services", { preHandler: app.authenticate }, async (req, reply) => {
    const body = serviceSchema.parse(req.body);
    const service = await prisma.service.create({
      data: {
        ...body,
        tenantId: req.authUser.tenantId,
      },
    });
    return reply.code(201).send(service);
  });

  // Update service
  app.patch("/api/v1/services/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = serviceSchema.partial().parse(req.body);
    const existing = await prisma.service.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
    });
    if (!existing) return reply.code(404).send({ error: "Service not found" });

    const updated = await prisma.service.update({
      where: { id },
      data: body,
    });
    return updated;
  });

  // Delete service
  app.delete("/api/v1/services/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.service.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: { _count: { select: { products: true } } },
    });
    if (!existing) return reply.code(404).send({ error: "Service not found" });

    if (existing._count.products > 0) {
      return reply.code(400).send({
        error: `Cannot delete service because ${existing._count.products} product(s) are linked to it.`,
      });
    }

    await prisma.service.delete({ where: { id } });
    return { success: true };
  });
}
