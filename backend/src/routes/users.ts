import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { canManageUser, getVisibleUserIds } from "../lib/rbac.js";

const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  orgRole: z.enum(["PARTNER", "MANAGER"]),
  partnerId: z.string().uuid().optional().nullable(),
  password: z.string().min(8),
});

const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  orgRole: z.enum(["PARTNER", "MANAGER"]).optional(),
  partnerId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  orgRole: true,
  partnerId: true,
  createdById: true,
  active: true,
  createdAt: true,
  partner: { select: { id: true, firstName: true, lastName: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export default async function userRoutes(app: FastifyInstance) {
  // GET /users — list users visible to the authenticated user
  app.get("/api/v1/users", { preHandler: [app.authenticate] }, async (req: any) => {
    const actor = req.authUser;

    let where: any = { tenantId: actor.tenantId };

    if (actor.orgRole === "PARTNER") {
      where = { tenantId: actor.tenantId, OR: [{ id: actor.id }, { partnerId: actor.id }] };
    } else if (actor.orgRole === "MANAGER") {
      where = { tenantId: actor.tenantId, id: actor.id };
    }

    const users = await prisma.user.findMany({
      where,
      select: userSelect,
      orderBy: [{ orgRole: "asc" }, { createdAt: "asc" }],
    });
    return { data: users };
  });

  // GET /users/org-chart — full hierarchy tree
  app.get("/api/v1/users/org-chart", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;
    if (actor.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot view the org chart" });
    }

    const allUsers = await prisma.user.findMany({
      where: { tenantId: actor.tenantId },
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });

    const seniorPartner = allUsers.find((u) => u.orgRole === "SENIOR_PARTNER");
    const partners = allUsers.filter((u) => u.orgRole === "PARTNER");
    const managers = allUsers.filter((u) => u.orgRole === "MANAGER");

    if (actor.orgRole === "PARTNER") {
      const myManagers = managers.filter((m) => m.partnerId === actor.id);
      return {
        seniorPartner,
        partners: partners.filter((p) => p.id === actor.id),
        managers: myManagers,
      };
    }

    return { seniorPartner, partners, managers };
  });

  // POST /users — create a new user
  app.post("/api/v1/users", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;

    if (actor.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot create users" });
    }

    const body = CreateUserSchema.parse(req.body);

    const partnerId =
      actor.orgRole === "PARTNER" ? actor.id : (body.partnerId ?? null);

    if (!canManageUser(actor, body.orgRole, partnerId)) {
      return reply.code(403).send({ error: "You are not allowed to create this user type" });
    }

    if (actor.orgRole === "PARTNER" && body.orgRole !== "MANAGER") {
      return reply.code(403).send({ error: "Partners can only create Managers" });
    }

    if (body.orgRole === "MANAGER") {
      if (!partnerId) {
        return reply.code(400).send({ error: "partnerId is required when creating a Manager" });
      }
      const partnerUser = await prisma.user.findFirst({
        where: { id: partnerId, tenantId: actor.tenantId, orgRole: "PARTNER" },
      });
      if (!partnerUser) {
        return reply.code(400).send({ error: "Invalid partnerId — user must be an existing Partner in this tenant" });
      }
    }

    const existing = await prisma.user.findFirst({
      where: { email: body.email, tenantId: actor.tenantId },
    });
    if (existing) return reply.code(409).send({ error: "User with this email already exists" });

    const argon2 = await import("argon2");
    const passwordHash = await argon2.hash(body.password);

    const user = await prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        orgRole: body.orgRole,
        partnerId: body.orgRole === "MANAGER" ? partnerId : null,
        createdById: actor.id,
        passwordHash,
      },
      select: userSelect,
    });

    return reply.code(201).send(user);
  });

  // PATCH /users/:id — edit user name/email/role
  app.patch("/api/v1/users/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;
    const targetId = req.params.id;
    const body = UpdateUserSchema.parse(req.body);

    const target = await prisma.user.findFirst({
      where: { id: targetId, tenantId: actor.tenantId },
    });
    if (!target) return reply.code(404).send({ error: "User not found" });

    if (actor.orgRole === "MANAGER") {
      if (targetId !== actor.id) return reply.code(403).send({ error: "Access denied" });
      if (body.orgRole) return reply.code(403).send({ error: "Managers cannot change roles" });
    }

    if (actor.orgRole === "PARTNER") {
      const isSelf = targetId === actor.id;
      const isOwnManager = target.orgRole === "MANAGER" && target.partnerId === actor.id;
      if (!isSelf && !isOwnManager) return reply.code(403).send({ error: "Access denied" });
      if (body.orgRole) return reply.code(403).send({ error: "Partners cannot change roles" });
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(body.firstName ? { firstName: body.firstName } : {}),
        ...(body.lastName ? { lastName: body.lastName } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(actor.orgRole === "SENIOR_PARTNER" && body.orgRole ? { orgRole: body.orgRole } : {}),
        ...(actor.orgRole === "SENIOR_PARTNER" && body.partnerId !== undefined ? { partnerId: body.partnerId } : {}),
      },
      select: userSelect,
    });
    return updated;
  });

  // DELETE /users/:id — remove user
  app.delete("/api/v1/users/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;
    const targetId = req.params.id;

    if (actor.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot remove users" });
    }
    if (targetId === actor.id) {
      return reply.code(400).send({ error: "Cannot remove yourself" });
    }

    const target = await prisma.user.findFirst({
      where: { id: targetId, tenantId: actor.tenantId },
    });
    if (!target) return reply.code(404).send({ error: "User not found" });

    if (actor.orgRole === "PARTNER") {
      if (target.orgRole !== "MANAGER" || target.partnerId !== actor.id) {
        return reply.code(403).send({ error: "Partners can only remove their own Managers" });
      }
    }

    if (target.orgRole === "SENIOR_PARTNER") {
      return reply.code(403).send({ error: "Cannot remove the Senior Partner" });
    }

    const actorId = actor.id;
    await prisma.$transaction([
      prisma.account.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.contact.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.opportunity.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.quote.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.product.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.activity.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.note.updateMany({ where: { authorId: targetId }, data: { authorId: actorId } }),
      prisma.sequence.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.user.delete({ where: { id: targetId } }),
    ]);

    return reply.code(204).send();
  });

  // GET /users/stats — scoped to visible users
  app.get("/api/v1/users/stats", { preHandler: [app.authenticate] }, async (req: any) => {
    const actor = req.authUser;
    const tenantId = actor.tenantId;

    const visibleIds = await getVisibleUserIds(actor);

    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: visibleIds } },
      select: { id: true, firstName: true, lastName: true, orgRole: true },
    });

    const stats = await Promise.all(
      users.map(async (u) => {
        const [openOpps, closedWon] = await Promise.all([
          prisma.opportunity.count({ where: { tenantId, ownerId: u.id, stage: { isClosed: false } } }),
          prisma.opportunity.aggregate({
            where: { tenantId, ownerId: u.id, stage: { isClosed: true, isWon: true } },
            _sum: { amount: true },
          }),
        ]);
        return {
          ...u,
          closedWonRevenue: Number(closedWon._sum.amount || 0),
          openOpportunities: openOpps,
        };
      })
    );

    return { data: stats };
  });

  // GET /users/:id/bird-eye — detailed bird's-eye view for a user (P or M)
  app.get("/api/v1/users/:id/bird-eye", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;
    const tenantId = actor.tenantId;
    const { id: targetId } = req.params;

    const targetUser = await prisma.user.findFirst({
      where: { id: targetId, tenantId },
      select: userSelect,
    });
    if (!targetUser) return reply.code(404).send({ error: "User not found" });

    if (actor.orgRole === "MANAGER" && actor.id !== targetId) {
      return reply.code(403).send({ error: "Access denied" });
    }
    if (actor.orgRole === "PARTNER") {
      const isSelf = actor.id === targetId;
      const isOwnManager = targetUser.orgRole === "MANAGER" && targetUser.partnerId === actor.id;
      if (!isSelf && !isOwnManager) return reply.code(403).send({ error: "Access denied" });
    }

    let teamUserIds = [targetId];
    let teamMembers: any[] = [];

    if (targetUser.orgRole === "PARTNER") {
      teamMembers = await prisma.user.findMany({
        where: { tenantId, partnerId: targetId },
        select: userSelect,
      });
      teamUserIds = [targetId, ...teamMembers.map((m) => m.id)];
    }

    const [
      closedWonOpps,
      openOpps,
      recentOpps,
      accounts,
      accountsCount,
      contactsCount,
      activitiesCount,
      recentActivities,
    ] = await Promise.all([
      prisma.opportunity.findMany({
        where: { tenantId, ownerId: { in: teamUserIds }, stage: { isWon: true } },
        select: { id: true, amount: true },
      }),
      prisma.opportunity.findMany({
        where: { tenantId, ownerId: { in: teamUserIds }, stage: { isClosed: false } },
        select: { id: true, amount: true },
      }),
      prisma.opportunity.findMany({
        where: { tenantId, ownerId: { in: teamUserIds } },
        include: {
          stage: true,
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
      }),
      prisma.account.findMany({
        where: { tenantId, ownerId: { in: teamUserIds }, archived: false },
        include: { owner: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.account.count({ where: { tenantId, ownerId: { in: teamUserIds }, archived: false } }),
      prisma.contact.count({ where: { tenantId, ownerId: { in: teamUserIds }, archived: false } }),
      prisma.activity.count({ where: { tenantId, ownerId: { in: teamUserIds } } }),
      prisma.activity.findMany({
        where: { tenantId, ownerId: { in: teamUserIds } },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true } },
          account: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    ]);

    const closedWonRevenue = closedWonOpps.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const openPipelineRevenue = openOpps.reduce((sum, o) => sum + Number(o.amount || 0), 0);

    return {
      user: targetUser,
      teamMembers,
      kpis: {
        closedWonRevenue,
        closedWonCount: closedWonOpps.length,
        openPipelineRevenue,
        openOpportunitiesCount: openOpps.length,
        accountsCount,
        contactsCount,
        activitiesCount,
      },
      recentActivities,
      recentOpps,
      accounts,
    };
  });
}
