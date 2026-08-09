import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

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

    // Get forecast targets
    const targets = await prisma.forecastTarget.findMany({
      where: { tenantId, period: targetPeriod, ...(ownerId ? { ownerId } : {}) },
    });

    // Get actual closed won
    const closedWonDeals = await prisma.deal.findMany({
      where: {
        tenantId,
        ...ownerFilter,
        wonDate: { gte: periodStart, lte: periodEnd },
        stage: { isClosed: true, isWon: true },
      },
      include: {
        stage: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Get open pipeline by forecast category
    const openDeals = await prisma.deal.findMany({
      where: {
        tenantId,
        ...ownerFilter,
        stage: { isClosed: false },
        closeDate: { gte: periodStart, lte: periodEnd },
      },
      include: {
        stage: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    const closedWonRevenue = closedWonDeals.reduce((s, d) => s + Number(d.amount), 0);
    const commitRevenue = openDeals.filter(d => d.forecastCategory === "COMMIT").reduce((s, d) => s + Number(d.amount), 0);
    const bestCaseRevenue = openDeals.filter(d => ["COMMIT", "BEST_CASE"].includes(d.forecastCategory)).reduce((s, d) => s + Number(d.amount), 0);
    const pipelineRevenue = openDeals.reduce((s, d) => s + Number(d.amount), 0);
    const weightedRevenue = openDeals.reduce((s, d) => s + Number(d.amount) * (d.probability / 100), 0);
    const totalTarget = targets.reduce((s, t) => s + Number(t.targetAmount), 0);

    // By owner breakdown
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true },
    });

    const byOwner = users.map(user => {
      const userTarget = targets.find(t => t.ownerId === user.id);
      const userClosed = closedWonDeals.filter(d => d.ownerId === user.id).reduce((s, d) => s + Number(d.amount), 0);
      const userPipeline = openDeals.filter(d => d.ownerId === user.id).reduce((s, d) => s + Number(d.amount), 0);
      const userWeighted = openDeals.filter(d => d.ownerId === user.id).reduce((s, d) => s + Number(d.amount) * (d.probability / 100), 0);
      return {
        owner: user,
        target: userTarget ? Number(userTarget.targetAmount) : 0,
        closedWon: userClosed,
        pipeline: userPipeline,
        weighted: userWeighted,
        attainment: userTarget ? (userClosed / Number(userTarget.targetAmount)) * 100 : null,
      };
    }).filter(u => u.target > 0 || u.closedWon > 0 || u.pipeline > 0);

    return {
      period: targetPeriod,
      summary: {
        target: totalTarget,
        closedWon: closedWonRevenue,
        commit: commitRevenue,
        bestCase: bestCaseRevenue,
        pipeline: pipelineRevenue,
        weighted: weightedRevenue,
        attainment: totalTarget > 0 ? (closedWonRevenue / totalTarget) * 100 : null,
        gap: Math.max(0, totalTarget - closedWonRevenue),
      },
      byOwner,
      deals: {
        closedWon: closedWonDeals.map(d => ({ id: d.id, name: d.name, amount: Number(d.amount), owner: d.owner, wonDate: d.wonDate })),
        open: openDeals.map(d => ({ id: d.id, name: d.name, amount: Number(d.amount), probability: d.probability, forecastCategory: d.forecastCategory, closeDate: d.closeDate, owner: d.owner })),
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
        prisma.deal.aggregate({
          where: { tenantId, wonDate: { gte: periodStart, lte: periodEnd }, stage: { isClosed: true, isWon: true } },
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
