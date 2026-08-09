import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: app.authenticate }, async (req) => {
    const tenantId = req.authUser.tenantId;

    const [openDeals, closedWonDeals, closedLostDeals, openOpportunities] = await Promise.all([
      prisma.deal.findMany({ where: { tenantId, stage: { isClosed: false } }, include: { stage: true, account: true, owner: true } }),
      prisma.deal.findMany({ where: { tenantId, stage: { isClosed: true, isWon: true } } }),
      prisma.deal.count({ where: { tenantId, stage: { isClosed: true, isWon: false } } }),
      prisma.opportunity.findMany({ where: { tenantId, isConverted: false }, include: { stage: true } }),
    ]);

    const totalPipeline = openDeals.reduce((s, d) => s + Number(d.amount), 0);
    const weightedPipeline = openDeals.reduce((s, d) => s + Number(d.amount) * (d.probability / 100), 0);
    const closedWonRevenue = closedWonDeals.reduce((s, d) => s + Number(d.amount), 0);
    const winRate = closedWonDeals.length + closedLostDeals > 0
      ? closedWonDeals.length / (closedWonDeals.length + closedLostDeals)
      : 0;
    const avgDealSize = closedWonDeals.length > 0 ? closedWonRevenue / closedWonDeals.length : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const dealsClosingThisMonth = openDeals.filter(
      (d) => d.closeDate && d.closeDate >= monthStart && d.closeDate < monthEnd
    ).length;

    // Pipeline by stage (open deals)
    const byStageMap = new Map<string, { stageName: string; count: number; amount: number }>();
    for (const d of openDeals) {
      const key = d.stageId;
      const cur = byStageMap.get(key) || { stageName: d.stage.name, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(d.amount);
      byStageMap.set(key, cur);
    }

    // Revenue by month (closed won, last 6 months)
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const revenue = closedWonDeals
        .filter((deal) => deal.wonDate && deal.wonDate >= start && deal.wonDate < end)
        .reduce((s, deal) => s + Number(deal.amount), 0);
      revenueByMonth.push({ month: label, revenue });
    }

    // Deals by owner
    const byOwnerMap = new Map<string, { owner: string; count: number; amount: number }>();
    for (const d of openDeals) {
      const key = d.ownerId;
      const cur = byOwnerMap.get(key) || { owner: `${d.owner.firstName} ${d.owner.lastName}`, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(d.amount);
      byOwnerMap.set(key, cur);
    }

    return {
      kpis: {
        totalPipeline,
        weightedPipeline,
        openOpportunities: openOpportunities.length,
        openDeals: openDeals.length,
        closedWonRevenue,
        winRate,
        avgDealSize,
        dealsClosingThisMonth,
      },
      charts: {
        pipelineByStage: Array.from(byStageMap.values()),
        revenueByMonth,
        dealsByOwner: Array.from(byOwnerMap.values()),
      },
    };
  });
}
