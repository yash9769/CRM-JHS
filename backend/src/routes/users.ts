import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { canManageUser, getVisibleUserIds } from "../lib/rbac.js";
import { computeOpportunityFinancials } from "../lib/financial.js";
import { formatOppWithFinancials } from "./opportunities.js";

/** Same "Proposal Value" resolver used by the dashboard, pipeline, and
 * forecast/report pages: prefers expectedOpportunityValue, falling back to
 * the legacy amount column. */
function oppValue(o: { amount: any; expectedOpportunityValue?: any }): number {
  const f = computeOpportunityFinancials(o);
  return f.expectedOpportunityValue ?? Number(o.amount || 0);
}

const CreateUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  // SENIOR_PARTNER/SUPER_ADMIN are accepted here but only a SUPER_ADMIN actor
  // can actually create one -- enforced below via canManageUser, not by this
  // schema (a SENIOR_PARTNER/PARTNER actor sending one still gets a 403).
  orgRole: z.enum(["SUPER_ADMIN", "SENIOR_PARTNER", "PARTNER", "MANAGER"]),
  partnerId: z.string().uuid().optional().nullable(),
  password: z.string().min(8),
});

const UpdateUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  orgRole: z.enum(["SUPER_ADMIN", "SENIOR_PARTNER", "PARTNER", "MANAGER"]).optional(),
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

    const visibleIds = await getVisibleUserIds(actor);
    const where: any = { tenantId: actor.tenantId, id: { in: visibleIds } };

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

    if (actor.orgRole === "PARTNER") {
      const actorUser = allUsers.find((u) => u.id === actor.id);
      const parentSpId = actorUser?.createdById || actorUser?.partnerId;
      const parentSp = parentSpId ? allUsers.find((u) => u.id === parentSpId && u.orgRole === "SENIOR_PARTNER") : null;
      const myManagers = allUsers.filter((u) => u.orgRole === "MANAGER" && u.partnerId === actor.id);

      return {
        seniorPartner: parentSp,
        seniorPartners: parentSp ? [parentSp] : [],
        partners: actorUser ? [actorUser] : [],
        managers: myManagers,
      };
    }

    if (actor.orgRole === "SENIOR_PARTNER") {
      const myPartners = allUsers.filter((u) => u.orgRole === "PARTNER" && (u.createdById === actor.id || u.partnerId === actor.id));
      const myPartnerIds = new Set(myPartners.map((p) => p.id));
      const myManagers = allUsers.filter((u) => u.orgRole === "MANAGER" && u.partnerId && myPartnerIds.has(u.partnerId));
      const currentSp = allUsers.find((u) => u.id === actor.id) || null;

      return {
        seniorPartner: currentSp,
        seniorPartners: currentSp ? [currentSp] : [],
        partners: myPartners,
        managers: myManagers,
      };
    }

    const superAdmins = allUsers.filter((u) => u.orgRole === "SUPER_ADMIN");
    const seniorPartners = allUsers.filter((u) => u.orgRole === "SENIOR_PARTNER");
    const partners = allUsers.filter((u) => u.orgRole === "PARTNER");
    const managers = allUsers.filter((u) => u.orgRole === "MANAGER");

    return { seniorPartner: seniorPartners[0] || null, superAdmins, seniorPartners, partners, managers };
  });

  // POST /users — create a new user
  app.post("/api/v1/users", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const actor = req.authUser;

    if (actor.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Managers cannot create team members" });
    }

    const body = CreateUserSchema.parse(req.body);

    if (actor.orgRole === "SENIOR_PARTNER" && body.orgRole !== "PARTNER") {
      return reply.code(403).send({ error: "Senior Partners can only create Partners" });
    }

    if (actor.orgRole === "PARTNER" && body.orgRole !== "MANAGER") {
      return reply.code(403).send({ error: "Partners can only create Managers" });
    }

    let partnerId: string | null;
    if (actor.orgRole === "PARTNER") {
      partnerId = actor.id;
    } else if (body.orgRole === "PARTNER") {
      // Reports to a Senior Partner: an explicit partnerId if given, else the
      // creating Senior Partner themselves, else (a Super Admin creating a
      // Partner in someone else's tenant) that tenant's own Senior Partner.
      partnerId = body.partnerId ?? (actor.orgRole === "SENIOR_PARTNER" ? actor.id : null);
      if (!partnerId) {
        const tenantSp = await prisma.user.findFirst({ where: { tenantId: actor.tenantId, orgRole: "SENIOR_PARTNER" } });
        partnerId = tenantSp?.id ?? null;
      }
    } else if (body.orgRole === "MANAGER") {
      partnerId = body.partnerId ?? null;
    } else {
      partnerId = null; // SENIOR_PARTNER / SUPER_ADMIN have no partnerId
    }

    if (!canManageUser(actor, body.orgRole, partnerId)) {
      return reply.code(403).send({ error: "You are not allowed to create this user type" });
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
        partnerId,
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

    // A SENIOR_PARTNER may manage Partners/Managers but never another
    // SENIOR_PARTNER or a SUPER_ADMIN (canManageUser already encodes this for
    // user creation -- apply the same rule here so edit/deactivate can't be
    // used to bypass it).
    if (actor.orgRole === "SENIOR_PARTNER" && targetId !== actor.id && !canManageUser(actor, target.orgRole, target.partnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }

    const updated = await prisma.user.update({
      where: { id: targetId },
      data: {
        ...(body.firstName ? { firstName: body.firstName } : {}),
        ...(body.lastName ? { lastName: body.lastName } : {}),
        ...(body.email ? { email: body.email } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...((actor.orgRole === "SUPER_ADMIN" || actor.orgRole === "SENIOR_PARTNER") && body.orgRole ? { orgRole: body.orgRole } : {}),
        ...((actor.orgRole === "SUPER_ADMIN" || actor.orgRole === "SENIOR_PARTNER") && body.partnerId !== undefined ? { partnerId: body.partnerId } : {}),
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

    if (target.orgRole === "SENIOR_PARTNER" && actor.orgRole !== "SUPER_ADMIN") {
      return reply.code(403).send({ error: "Cannot remove the Senior Partner" });
    }

    // A SENIOR_PARTNER may remove Partners/Managers but never a SUPER_ADMIN --
    // the check above only covers a SENIOR_PARTNER target, not a SUPER_ADMIN one.
    if (actor.orgRole === "SENIOR_PARTNER" && !canManageUser(actor, target.orgRole, target.partnerId)) {
      return reply.code(403).send({ error: "Access denied" });
    }

    const actorId = actor.id;
    // Deleting a user requires clearing EVERY foreign key across the schema
    // that can point at users.id -- Postgres has no ON DELETE rule on any of
    // them, so prisma.user.delete() at the end fails with an opaque 500 on
    // whichever reference is left dangling (this has bitten notifications
    // and stage_approvals in production already; Lead was previously missing
    // from this list entirely). Three handling strategies, by field meaning:
    //  - Ownership/attribution on CRM records -> reassign to the actor,
    //    matching the "records will be reassigned to you" warning shown
    //    before this delete is confirmed.
    //  - Records personal to the deleted user (their notifications, sticky
    //    notes, saved views, forecast target) -> delete outright; reassigning
    //    them to the actor would misattribute or spam someone else's data.
    //  - Historical "who did this" references (audit log, approval/review
    //    trail) -> null the nullable ones (matches the "unassigned" state
    //    those workflows already support) and reassign only the non-nullable
    //    ones (requestedById), since audit_logs.userId must NOT become the
    //    actor -- that would misattribute the deleted user's past actions.
    await prisma.$transaction([
      prisma.account.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.account.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.contact.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.contact.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.lead.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.lead.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.opportunity.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.opportunity.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.quote.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.quote.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.product.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.product.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.activity.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.activity.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.note.updateMany({ where: { authorId: targetId }, data: { authorId: actorId } }),
      prisma.sequence.updateMany({ where: { ownerId: targetId }, data: { ownerId: actorId } }),
      prisma.sequence.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),
      prisma.opportunityAttachment.updateMany({ where: { uploadedById: targetId }, data: { uploadedById: actorId } }),

      prisma.notification.deleteMany({ where: { userId: targetId } }),
      prisma.stickyNote.deleteMany({ where: { userId: targetId } }),
      prisma.savedView.deleteMany({ where: { ownerId: targetId } }),
      prisma.forecastTarget.deleteMany({ where: { ownerId: targetId } }),

      prisma.auditLog.updateMany({ where: { userId: targetId }, data: { userId: null } }),

      prisma.stageApproval.updateMany({ where: { requestedById: targetId }, data: { requestedById: actorId } }),
      prisma.stageApproval.updateMany({ where: { approverId: targetId }, data: { approverId: null } }),
      prisma.stageApproval.updateMany({ where: { reviewedById: targetId }, data: { reviewedById: null } }),
      prisma.accountDeletionRequest.updateMany({ where: { requestedById: targetId }, data: { requestedById: actorId } }),
      prisma.accountDeletionRequest.updateMany({ where: { approverId: targetId }, data: { approverId: null } }),
      prisma.accountDeletionRequest.updateMany({ where: { reviewedById: targetId }, data: { reviewedById: null } }),
      prisma.contactDeletionRequest.updateMany({ where: { requestedById: targetId }, data: { requestedById: actorId } }),
      prisma.contactDeletionRequest.updateMany({ where: { approverId: targetId }, data: { approverId: null } }),
      prisma.contactDeletionRequest.updateMany({ where: { reviewedById: targetId }, data: { reviewedById: null } }),
      prisma.opportunityDeletionRequest.updateMany({ where: { requestedById: targetId }, data: { requestedById: actorId } }),
      prisma.opportunityDeletionRequest.updateMany({ where: { approverId: targetId }, data: { approverId: null } }),
      prisma.opportunityDeletionRequest.updateMany({ where: { reviewedById: targetId }, data: { reviewedById: null } }),

      // Other users can reference this one via partnerId (their "reports to")
      // or createdById.
      prisma.user.updateMany({ where: { partnerId: targetId }, data: { partnerId: null } }),
      prisma.user.updateMany({ where: { createdById: targetId }, data: { createdById: actorId } }),

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
        const [openOpps, closedWonOpps] = await Promise.all([
          prisma.opportunity.count({ where: { tenantId, ownerId: u.id, stage: { isClosed: false } } }),
          prisma.opportunity.findMany({
            where: { tenantId, ownerId: u.id, stage: { isClosed: true, isWon: true } },
            select: { amount: true, expectedOpportunityValue: true },
          }),
        ]);
        return {
          ...u,
          closedWonRevenue: closedWonOpps.reduce((sum, o) => sum + oppValue(o), 0),
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
        select: { id: true, amount: true, expectedOpportunityValue: true },
      }),
      prisma.opportunity.findMany({
        where: { tenantId, ownerId: { in: teamUserIds }, stage: { isClosed: false } },
        select: { id: true, amount: true, expectedOpportunityValue: true },
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

    const closedWonRevenue = closedWonOpps.reduce((sum, o) => sum + oppValue(o), 0);
    const openPipelineRevenue = openOpps.reduce((sum, o) => sum + oppValue(o), 0);

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
      recentOpps: recentOpps.map(formatOppWithFinancials),
      accounts,
    };
  });
}
