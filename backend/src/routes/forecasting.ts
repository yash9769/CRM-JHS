import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter, getVisibleUserIds } from "../lib/rbac.js";

/** Accepts "YYYY-MM" (monthly), "YYYY-Qn" (quarterly), or "YYYY" (yearly). */
const PERIOD_REGEX = /^(\d{4})(?:-(\d{2})|-Q([1-4]))?$/;

const SetTargetSchema = z.object({
  period: z.string().regex(PERIOD_REGEX, "Period must be YYYY-MM, YYYY-Qn, or YYYY format"),
  targetAmount: z.number().positive(),
  ownerId: z.string().optional(),
  // Multi-select: a Partner can assign the same target amount to several
  // Managers at once. Mutually exclusive with `ownerId` in practice -- if
  // both are sent, `ownerIds` wins.
  ownerIds: z.array(z.string()).max(50).optional(),
});

/** Parses any of the three period formats into a concrete date range. */
function parsePeriodRange(period: string): { start: Date; end: Date; granularity: "MONTH" | "QUARTER" | "YEAR" } {
  const match = period.match(PERIOD_REGEX);
  if (!match) throw new Error(`Invalid period: ${period}`);
  const year = Number(match[1]);
  if (match[2]) {
    const month = Number(match[2]);
    return {
      start: new Date(year, month - 1, 1),
      end: new Date(year, month, 0, 23, 59, 59, 999),
      granularity: "MONTH",
    };
  }
  if (match[3]) {
    const quarter = Number(match[3]);
    const startMonth = (quarter - 1) * 3;
    return {
      start: new Date(year, startMonth, 1),
      end: new Date(year, startMonth + 3, 0, 23, 59, 59, 999),
      granularity: "QUARTER",
    };
  }
  return {
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
    granularity: "YEAR",
  };
}

/** True if `period` is a bare year, e.g. "2026" (not "2026-01" or "2026-Q1"). */
function isYearOnly(period: string): boolean {
  return /^\d{4}$/.test(period);
}

/** True if `period` is a quarter, e.g. "2026-Q1". */
function isQuarter(period: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(period);
}

export default async function forecastingRoutes(app: FastifyInstance) {
  // Get forecast for a period (or current month)
  app.get("/api/v1/forecast", { preHandler: [app.authenticate] }, async (req: any) => {
    const { period, ownerId } = req.query as any;
    const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    const { start: periodStart, end: periodEnd } = parsePeriodRange(targetPeriod);
    // A bare-year request rolls up any monthly targets set for that year (but
    // never quarter-granularity targets, which would double-count against a
    // monthly total for the same months). Anything else matches its own
    // period string exactly.
    const targetPeriodFilter: any = isYearOnly(targetPeriod) ? { startsWith: targetPeriod } : targetPeriod;

    const tenantId = req.authUser.tenantId;
    const ownerFilter = ownerId ? { ownerId } : {};
    const rbacFilter = await getCreatedByFilter(req.authUser);

    // Get forecast targets.
    // ForecastTarget has no createdById field (only ownerId), so getCreatedByFilter's
    // createdById/ownerId OR clause would throw a Prisma "unknown argument" error here.
    // Scope by ownerId directly using the same visibility rules as GET /forecast/targets.
    const targetRbacFilter = { ownerId: { in: await getVisibleUserIds(req.authUser) } };
    let targets = await prisma.forecastTarget.findMany({
      where: {
        tenantId,
        period: targetPeriodFilter,
        AND: [targetRbacFilter, ...(ownerId ? [{ ownerId }] : [])],
      },
    });
    // Exclude quarter-format rows from a yearly roll-up (see comment above).
    if (isYearOnly(targetPeriod)) {
      targets = targets.filter((t) => !isQuarter(t.period));
    }

    // Get opportunities.
    // `rbacFilter` contains an `OR` clause, and so do the period-window filters
    // below. Spreading both into one object literal would let the period `OR`
    // silently overwrite the RBAC `OR`, so compose them under `AND` instead.
    const [closedWonOpps, closedLostOpps, openOpps] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          tenantId,
          ...ownerFilter,
          stage: { isWon: true },
          AND: [
            rbacFilter,
            {
              OR: [
                { wonDate: { gte: periodStart, lte: periodEnd } },
                { actualCloseDate: { gte: periodStart, lte: periodEnd } },
                { updatedAt: { gte: periodStart, lte: periodEnd } },
              ],
            },
          ],
        },
        include: {
          stage: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.opportunity.findMany({
        where: {
          tenantId,
          ...ownerFilter,
          stage: { isClosed: true, isWon: false },
          AND: [
            rbacFilter,
            {
              OR: [
                { actualCloseDate: { gte: periodStart, lte: periodEnd } },
                { updatedAt: { gte: periodStart, lte: periodEnd } },
              ],
            },
          ],
        },
        include: {
          stage: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.opportunity.findMany({
        where: {
          tenantId,
          ...ownerFilter,
          stage: { isClosed: false },
          expectedCloseDate: { gte: periodStart, lte: periodEnd },
          AND: [rbacFilter],
        },
        include: {
          stage: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
    ]);

    const closedWonRevenue = closedWonOpps.reduce((s, o) => s + Number(o.amount), 0);
    const closedLostRevenue = closedLostOpps.reduce((s, o) => s + Number(o.amount), 0);
    const commitRevenue = openOpps.filter(o => o.forecastCategory === "COMMIT").reduce((s, o) => s + Number(o.amount), 0);
    const bestCaseRevenue = openOpps.filter(o => ["COMMIT", "BEST_CASE"].includes(o.forecastCategory)).reduce((s, o) => s + Number(o.amount), 0);
    const pipelineRevenue = openOpps.reduce((s, o) => s + Number(o.amount), 0);
    const weightedRevenue = openOpps.reduce((s, o) => s + Number(o.amount) * (o.probability / 100), 0);
    const totalTarget = targets.reduce((s, t) => s + Number(t.targetAmount), 0);

    // By owner breakdown
    const visibleUserIds = await getVisibleUserIds(req.authUser);
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: visibleUserIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const byOwner = users.map(user => {
      const userTarget = targets.find(t => t.ownerId === user.id);
      const userClosed = closedWonOpps.filter(o => o.ownerId === user.id).reduce((s, o) => s + Number(o.amount), 0);
      const userLost = closedLostOpps.filter(o => o.ownerId === user.id).reduce((s, o) => s + Number(o.amount), 0);
      const userPipeline = openOpps.filter(o => o.ownerId === user.id).reduce((s, o) => s + Number(o.amount), 0);
      const userWeighted = openOpps.filter(o => o.ownerId === user.id).reduce((s, o) => s + Number(o.amount) * (o.probability / 100), 0);
      return {
        owner: user,
        target: userTarget ? Number(userTarget.targetAmount) : 0,
        closedWon: userClosed,
        lostOpportunity: userLost,
        pipeline: userPipeline,
        weighted: userWeighted,
      };
    }).filter(u => u.target > 0 || u.closedWon > 0 || u.pipeline > 0 || u.lostOpportunity > 0);

    return {
      period: targetPeriod,
      summary: {
        target: totalTarget,
        closedWon: closedWonRevenue,
        lostOpportunity: closedLostRevenue,
        commit: commitRevenue,
        bestCase: bestCaseRevenue,
        pipeline: pipelineRevenue,
        weighted: weightedRevenue,
        gap: Math.max(0, totalTarget - closedWonRevenue),
      },
      byOwner,
      opportunities: {
        closedWon: closedWonOpps.map(o => ({ id: o.id, name: o.name, amount: Number(o.amount), owner: o.owner, wonDate: o.wonDate })),
        open: openOpps.map(o => ({ id: o.id, name: o.name, amount: Number(o.amount), probability: o.probability, forecastCategory: o.forecastCategory, closeDate: o.expectedCloseDate, owner: o.owner })),
      },
    };
  });

  // Set forecast target(s)
  app.post("/api/v1/forecast/targets", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = SetTargetSchema.parse(req.body);
    const actor = req.authUser;

    // Targets are assigned top-down only: a Senior Partner sets targets for
    // the Partners under them, a Partner sets targets for the Managers under
    // them. Managers cannot set targets for anyone (including themselves).
    if (actor.orgRole === "MANAGER") {
      return reply.code(403).send({ error: "Access denied: Managers cannot set forecast targets." });
    }

    const requestedOwnerIds = body.ownerIds && body.ownerIds.length > 0 ? body.ownerIds : (body.ownerId ? [body.ownerId] : []);

    // No owner specified -> a "team total" target owned by the actor themself
    // (the existing behaviour), which needs no extra role check.
    if (requestedOwnerIds.length === 0) {
      const target = await prisma.forecastTarget.upsert({
        where: { tenantId_ownerId_period: { tenantId: actor.tenantId, ownerId: actor.id, period: body.period } },
        create: { tenantId: actor.tenantId, ownerId: actor.id, period: body.period, targetAmount: body.targetAmount },
        update: { targetAmount: body.targetAmount },
      });
      return reply.code(201).send(target);
    }

    if (actor.orgRole === "SENIOR_PARTNER" && requestedOwnerIds.length > 1) {
      return reply.code(400).send({ error: "A Senior Partner sets a target for one Partner at a time." });
    }

    // Verify every requested owner is actually within this actor's role-based
    // hierarchy (never trust the client-supplied id list at face value).
    const owners = await prisma.user.findMany({
      where: { tenantId: actor.tenantId, id: { in: requestedOwnerIds } },
      select: { id: true, orgRole: true, partnerId: true },
    });
    if (owners.length !== requestedOwnerIds.length) {
      return reply.code(400).send({ error: "One or more selected team members were not found." });
    }
    const invalid =
      actor.orgRole === "SUPER_ADMIN"
        ? undefined
        : owners.find((o) => {
            if (actor.orgRole === "SENIOR_PARTNER") return o.orgRole !== "PARTNER";
            // actor.orgRole === "PARTNER"
            return o.orgRole !== "MANAGER" || o.partnerId !== actor.id;
          });
    if (invalid) {
      const allowed = actor.orgRole === "SENIOR_PARTNER" ? "Partners" : "Managers who report to you";
      return reply.code(403).send({ error: `Access denied: you can only set targets for ${allowed}.` });
    }

    const targets = await prisma.$transaction(
      requestedOwnerIds.map((ownerId) =>
        prisma.forecastTarget.upsert({
          where: { tenantId_ownerId_period: { tenantId: actor.tenantId, ownerId, period: body.period } },
          create: { tenantId: actor.tenantId, ownerId, period: body.period, targetAmount: body.targetAmount },
          update: { targetAmount: body.targetAmount },
        })
      )
    );
    return reply.code(201).send(requestedOwnerIds.length === 1 ? targets[0] : { data: targets });
  });

  // Get targets
  app.get("/api/v1/forecast/targets", { preHandler: [app.authenticate] }, async (req: any) => {
    const { period } = req.query as any;
    // ForecastTarget has no createdById field (only ownerId), so getCreatedByFilter's
    // createdById/ownerId OR clause would throw a Prisma "unknown argument" error here.
    // Scope by ownerId directly using the same visibility rules instead.
    const targetRbacFilter = { ownerId: { in: await getVisibleUserIds(req.authUser) } };
    const targets = await prisma.forecastTarget.findMany({
      where: { tenantId: req.authUser.tenantId, ...targetRbacFilter, ...(period ? { period } : {}) },
      orderBy: [{ period: "desc" }, { createdAt: "asc" }],
    });
    return { data: targets };
  });

  // Historical forecast trend (last 12 months)
  app.get("/api/v1/forecast/trend", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);
    // ForecastTarget has no createdById field (only ownerId); reuse the same
    // ownerId-based scoping as the /forecast/targets endpoint above.
    const targetRbacFilter =
      req.authUser.orgRole === "SENIOR_PARTNER" || req.authUser.orgRole === "SUPER_ADMIN"
        ? {}
        : { ownerId: { in: await getVisibleUserIds(req.authUser) } };
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = d.toISOString().slice(0, 7);
      const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const [target, closedWon] = await Promise.all([
        prisma.forecastTarget.aggregate({
          where: { tenantId, period, ...targetRbacFilter },
          _sum: { targetAmount: true },
        }),
        // `rbacFilter` and the period window both use `OR`; compose them under
        // `AND` so the period filter cannot silently overwrite the RBAC filter.
        // Without this the ACTUAL series was tenant-wide while the TARGET series
        // was correctly scoped, inflating every non-Senior-Partner's trend chart.
        prisma.opportunity.aggregate({
          where: {
            tenantId,
            stage: { isWon: true },
            AND: [
              rbacFilter,
              {
                OR: [
                  { wonDate: { gte: periodStart, lte: periodEnd } },
                  { actualCloseDate: { gte: periodStart, lte: periodEnd } },
                  { updatedAt: { gte: periodStart, lte: periodEnd } },
                ],
              },
            ],
          },
          _sum: { amount: true },
        }),
      ]);

      months.push({
        period,
        label: d.toLocaleString("default", { month: "short", year: "2-digit" }),
        target: Number(target._sum.targetAmount || 0),
        actual: Number(closedWon._sum.amount || 0),
      });
    }

    return { data: months };
  });
}
