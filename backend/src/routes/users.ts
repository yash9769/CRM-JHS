import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.enum(["ADMIN", "SALES_MANAGER", "SALES_REP", "VIEWER"]).optional(),
});

const InviteUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(["ADMIN", "SALES_MANAGER", "SALES_REP", "VIEWER"]).default("SALES_REP"),
  password: z.string().min(8),
});

export default async function userRoutes(app: FastifyInstance) {
  // List users in tenant
  app.get("/api/v1/users", { preHandler: [app.authenticate] }, async (req: any) => {
    const users = await prisma.user.findMany({
      where: { tenantId: req.authUser.tenantId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return { data: users };
  });

  // Invite/create new team member (Admin only)
  app.post("/api/v1/users/invite", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    if (req.authUser.role !== "ADMIN" && req.authUser.role !== "SALES_MANAGER") {
      return reply.code(403).send({ error: "Only admins and managers can invite users" });
    }
    const body = InviteUserSchema.parse(req.body);
    const argon2 = await import("argon2");
    const passwordHash = await argon2.hash(body.password);

    const existing = await prisma.user.findFirst({ where: { email: body.email, tenantId: req.authUser.tenantId } });
    if (existing) return reply.code(409).send({ error: "User with this email already exists" });

    const user = await prisma.user.create({
      data: {
        tenantId: req.authUser.tenantId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        passwordHash,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
    });
    return reply.code(201).send(user);
  });

  // Update user role/profile (Admin only for role changes)
  app.patch("/api/v1/users/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = UpdateUserSchema.parse(req.body);

    // Only admins can change roles
    if (body.role && req.authUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "Only admins can change roles" });
    }

    // Users can only update themselves unless admin
    if (req.params.id !== req.authUser.id && req.authUser.role !== "ADMIN") {
      return reply.code(403).send({ error: "You can only update your own profile" });
    }

    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    return updated;
  });

  // Deactivate user (Admin only)
  app.delete("/api/v1/users/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    if (req.authUser.role !== "ADMIN") return reply.code(403).send({ error: "Only admins can remove users" });
    if (req.params.id === req.authUser.id) return reply.code(400).send({ error: "Cannot remove yourself" });

    const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!user) return reply.code(404).send({ error: "User not found" });

    // Reassign owned records to current admin before deleting
    const adminId = req.authUser.id;
    const targetUserId = req.params.id;

    await prisma.$transaction([
      prisma.account.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.contact.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.opportunity.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.deal.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.quote.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.product.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.activity.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.note.updateMany({ where: { authorId: targetUserId }, data: { authorId: adminId } }),
      prisma.sequence.updateMany({ where: { ownerId: targetUserId }, data: { ownerId: adminId } }),
      prisma.user.delete({ where: { id: targetUserId } }),
    ]);

    return reply.code(204).send();
  });

  // Team stats
  app.get("/api/v1/users/stats", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    const stats = await Promise.all(users.map(async (u) => {
      const [openDeals, closedWon, openOpps] = await Promise.all([
        prisma.deal.count({ where: { tenantId, ownerId: u.id, stage: { isClosed: false } } }),
        prisma.deal.aggregate({ where: { tenantId, ownerId: u.id, stage: { isClosed: true, isWon: true } }, _sum: { amount: true } }),
        prisma.opportunity.count({ where: { tenantId, ownerId: u.id, isConverted: false } }),
      ]);
      return { ...u, openDeals, closedWonRevenue: Number(closedWon._sum.amount || 0), openOpportunities: openOpps };
    }));

    return { data: stats };
  });
}
