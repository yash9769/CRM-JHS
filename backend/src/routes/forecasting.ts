import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter, getVisibleUserIds } from "../lib/rbac.js";

const SetTargetSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM format"),
  targetAmount: z.number().positive(),
  ownerId: z.string().optional(),
});

export default async function forecastingRoutes(app: FastifyInstance) {
  // Get forecast for a period (or current month)
  app.get("/api/v1/forecast", { preHandler: [app.authenticate] }, async (req: any) => {
    const { period, ownerId } = req.query as any;
    const targetPeriod = period || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Period start/end
    const [year, month] = targetPeriod.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const tenantId = req.authUser.tenantId;
    const ownerFilter = ownerId ? { ownerId } : {};
    const rbacFilter = await getCreatedByFilter(req.authUser);

    // Get forecast targets
    const targets = await prisma.forecastTarget.findMany({
      where: { tenantId, period: targetPeriod, ...(ownerId ? { ownerId } : {}) },
    });

    // Get opportunities
    const [closedWonOpps, closedLostOpps, openOpps] = await Promise.all([
      prisma.opportunity.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          ...ownerFilter,
          stage: { isWon: true },
          OR: [
            { wonDate: { gte: periodStart, lte: periodEnd } },
            { actualCloseDate: { gte: periodStart, lte: periodEnd } },
            { updatedAt: { gte: periodStart, lte: periodEnd } },
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
          ...rbacFilter,
          ...ownerFilter,
          stage: { isClosed: true, isWon: false },
          OR: [
            { actualCloseDate: { gte: periodStart, lte: periodEnd } },
            { updatedAt: { gte: periodStart, lte: periodEnd } },
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
          ...rbacFilter,
          ...ownerFilter,
          stage: { isClosed: false },
          expectedCloseDate: { gte: periodStart, lte: periodEnd },
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

  // Set forecast target
  app.post("/api/v1/forecast/targets", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = SetTargetSchema.parse(req.body);
    const target = await prisma.forecastTarget.upsert({
      where: {
        tenantId_ownerId_period: {
          tenantId: req.authUser.tenantId,
          ownerId: body.ownerId || req.authUser.id,
          period: body.period,
        },
      },
      create: {
        tenantId: req.authUser.tenantId,
        ownerId: body.ownerId || req.authUser.id,
        period: body.period,
        targetAmount: body.targetAmount,
      },
      update: { targetAmount: body.targetAmount },
    });
    return reply.code(201).send(target);
  });

  // Get targets
  app.get("/api/v1/forecast/targets", { preHandler: [app.authenticate] }, async (req: any) => {
    const { period } = req.query as any;
    const targets = await prisma.forecastTarget.findMany({
      where: { tenantId: req.authUser.tenantId, ...(period ? { period } : {}) },
      orderBy: [{ period: "desc" }, { createdAt: "asc" }],
    });
    return { data: targets };
  });

  // Historical forecast trend (last 12 months)
  app.get("/api/v1/forecast/trend", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);
    const months = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = d.toISOString().slice(0, 7);
      const periodStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const periodEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const [target, closedWon] = await Promise.all([
        prisma.forecastTarget.aggregate({
          where: { tenantId, period },
          _sum: { targetAmount: true },
        }),
        prisma.opportunity.aggregate({
          where: {
            tenantId,
            ...rbacFilter,
            stage: { isWon: true },
            OR: [
              { wonDate: { gte: periodStart, lte: periodEnd } },
              { actualCloseDate: { gte: periodStart, lte: periodEnd } },
              { updatedAt: { gte: periodStart, lte: periodEnd } },
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
