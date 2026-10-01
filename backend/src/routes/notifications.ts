import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const ListQuerySchema = z.object({
  unreadOnly: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
});

export default async function notificationRoutes(app: FastifyInstance) {
  // List notifications for current user
  app.get("/api/v1/notifications", { preHandler: [app.authenticate] }, async (req: any) => {
    const { unreadOnly, page, pageSize } = ListQuerySchema.parse(req.query);
    const where: any = { tenantId: req.authUser.tenantId, userId: req.authUser.id };
    if (unreadOnly === "true") where.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { tenantId: req.authUser.tenantId, userId: req.authUser.id, read: false } }),
    ]);

    return {
      data: notifications,
      unreadCount,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });

  // Mark single notification as read
  app.patch("/api/v1/notifications/:id/read", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const n = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.authUser.id, tenantId: req.authUser.tenantId } });
    if (!n) return reply.code(404).send({ error: "Notification not found" });
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    return updated;
  });

  // Mark all as read
  app.post("/api/v1/notifications/read-all", { preHandler: [app.authenticate] }, async (req: any) => {
    await prisma.notification.updateMany({
      where: { tenantId: req.authUser.tenantId, userId: req.authUser.id, read: false },
      data: { read: true },
    });
    return { success: true };
  });

  // Delete a notification
  app.delete("/api/v1/notifications/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const n = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.authUser.id, tenantId: req.authUser.tenantId } });
    if (!n) return reply.code(404).send({ error: "Notification not found" });
    await prisma.notification.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  // Unread count (lightweight endpoint for polling)
  app.get("/api/v1/notifications/unread-count", { preHandler: [app.authenticate] }, async (req: any) => {
    const count = await prisma.notification.count({
      where: { tenantId: req.authUser.tenantId, userId: req.authUser.id, read: false },
    });
    return { count };
  });
}
