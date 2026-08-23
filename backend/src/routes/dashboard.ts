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

  // Phase 20/21 — "Today's Work" action center + light sales-intelligence signals
  app.get("/api/v1/dashboard/action-center", { preHandler: app.authenticate }, async (req) => {
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      overdueTasks, tasksDueToday, newLeads, uncontactedLeads, dealsClosingThisWeek, quotesAwaiting,
      recentLeads, upcomingTasks, recentActivity, openDealsForRisk,
    ] = await Promise.all([
      prisma.activity.count({ where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { lt: todayStart } } }),
      prisma.activity.count({ where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.lead.count({ where: { tenantId, archived: false, createdAt: { gte: sevenDaysAgo } } }),
      prisma.lead.count({ where: { tenantId, archived: false, status: "NEW" } }),
      prisma.deal.count({ where: { tenantId, archived: false, stage: { isClosed: false }, closeDate: { gte: todayStart, lte: weekEnd } } }),
      prisma.quote.count({ where: { tenantId, status: { in: ["SENT", "VIEWED"] } } }),
      prisma.lead.findMany({ where: { tenantId, archived: false }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, firstName: true, lastName: true, companyName: true, status: true, createdAt: true } }),
      prisma.activity.findMany({ where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { gte: todayStart } }, orderBy: { dueDate: "asc" }, take: 5, select: { id: true, subject: true, dueDate: true, accountId: true, contactId: true, opportunityId: true, dealId: true, leadId: true } }),
      prisma.activity.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 8, include: { owner: { select: { firstName: true, lastName: true } }, account: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, lead: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.deal.findMany({
        where: { tenantId, archived: false, stage: { isClosed: false } },
        include: { account: { select: { id: true, name: true } }, activities: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

    const dealsAtRisk = openDealsForRisk
      .map((d) => {
        const lastActivity = d.activities[0]?.createdAt;
        const noRecentActivity = !lastActivity || lastActivity < staleThreshold;
        const closeDatePassed = d.closeDate && d.closeDate < todayStart;
        if (!noRecentActivity && !closeDatePassed) return null;
        const daysSinceActivity = lastActivity ? Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          id: d.id, name: d.name, amount: d.amount, account: d.account,
          reason: closeDatePassed ? "Expected close date passed" : `No activity for ${daysSinceActivity} days`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, 8);

    return {
      todaysWork: { overdueTasks, tasksDueToday, newLeads, uncontactedLeads, dealsClosingThisWeek, quotesAwaiting },
      recentLeads,
      upcomingTasks,
      recentActivity,
      dealsAtRisk,
    };
  });
}
