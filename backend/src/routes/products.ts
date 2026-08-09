import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative(),
  currency: z.string().optional(),
  active: z.boolean().optional(),
  ownerId: z.string().uuid().optional().nullable(),
});

export default async function productRoutes(app: FastifyInstance) {
  app.get("/api/v1/products", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { search?: string; category?: string; active?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.category ? { category: q.category } : {}),
      ...(q.active !== undefined ? { active: q.active === "true" } : {}),
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: "insensitive" as const } }, { sku: { contains: q.search, mode: "insensitive" as const } }] }
        : {}),
    };
    const data = await prisma.product.findMany({ where, orderBy: { name: "asc" } });
    return { data };
  });

  app.post("/api/v1/products", { preHandler: app.authenticate }, async (req, reply) => {
    const body = productSchema.parse(req.body);
    const product = await prisma.product.create({ data: { ...body, tenantId: req.authUser.tenantId } });
    return reply.code(201).send(product);
  });

  app.patch("/api/v1/products/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = productSchema.partial().parse(req.body);
    const existing = await prisma.product.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Product not found" });
    return prisma.product.update({ where: { id }, data: body });
  });
}
