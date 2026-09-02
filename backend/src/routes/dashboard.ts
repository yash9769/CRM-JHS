import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter } from "../lib/rbac.js";
import { computeOpportunityFinancials } from "../lib/financial.js";

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: app.authenticate }, async (req) => {
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);

    const [openOpps, closedWonOpps, closedLostOpps] = await Promise.all([
      prisma.opportunity.findMany({ where: { tenantId, ...rbacFilter, stage: { isClosed: false } }, include: { stage: true, account: true, owner: true } }),
      prisma.opportunity.findMany({ where: { tenantId, ...rbacFilter, stage: { isClosed: true, isWon: true } } }),
      prisma.opportunity.count({ where: { tenantId, ...rbacFilter, stage: { isClosed: true, isWon: false } } }),
    ]);

    const openOppsFinancials = openOpps.map((o) => computeOpportunityFinancials(o));
    const closedWonFinancials = closedWonOpps.map((o) => computeOpportunityFinancials(o));

    const totalPipeline = openOppsFinancials.reduce((s, f) => s + (f.expectedDealValue || 0), 0);
    const weightedPipeline = openOpps.reduce((s, o, idx) => s + (openOppsFinancials[idx].expectedDealValue || 0) * (o.probability / 100), 0);
    const closedWonRevenue = closedWonFinancials.reduce((s, f) => s + (f.actualDealValue !== null ? f.actualDealValue : (f.expectedDealValue || 0)), 0);
    
    const totalExpectedMargin = openOppsFinancials.reduce((s, f) => s + (f.expectedMargin || 0), 0);
    const totalGrossMargin = closedWonFinancials.reduce((s, f) => s + (f.grossMargin || 0), 0);
    const totalMarginLoss = closedWonFinancials.reduce((s, f) => s + (f.marginLoss || 0), 0);
    const totalBottomLineCost = [...openOppsFinancials, ...closedWonFinancials].reduce((s, f) => s + (f.bottomLineCost || 0), 0);

    const winRate = closedWonOpps.length + closedLostOpps > 0
      ? closedWonOpps.length / (closedWonOpps.length + closedLostOpps)
      : 0;
    const avgOpportunitySize = closedWonOpps.length > 0 ? closedWonRevenue / closedWonOpps.length : 0;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const oppsClosingThisMonth = openOpps.filter(
      (o) => o.expectedCloseDate && o.expectedCloseDate >= monthStart && o.expectedCloseDate < monthEnd
    ).length;

    // Pipeline by stage (open opportunities)
    const byStageMap = new Map<string, { stageName: string; count: number; amount: number }>();
    for (let i = 0; i < openOpps.length; i++) {
      const o = openOpps[i];
      const f = openOppsFinancials[i];
      const key = o.stageId;
      const cur = byStageMap.get(key) || { stageName: o.stage.name, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += f.expectedDealValue || 0;
      byStageMap.set(key, cur);
    }

    // Revenue by month (closed won, last 6 months)
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const revenue = closedWonOpps
        .filter((opp) => {
          const date = opp.wonDate || opp.actualCloseDate || opp.updatedAt;
          return date && date >= start && date < end;
        })
        .reduce((s, opp) => {
          const f = computeOpportunityFinancials(opp);
          return s + (f.actualDealValue !== null ? f.actualDealValue : (f.expectedDealValue || 0));
        }, 0);
      revenueByMonth.push({ month: label, revenue });
    }

    // Opportunities by owner
    const byOwnerMap = new Map<string, { owner: string; count: number; amount: number }>();
    for (let i = 0; i < openOpps.length; i++) {
      const o = openOpps[i];
      const f = openOppsFinancials[i];
      const key = o.ownerId;
      const cur = byOwnerMap.get(key) || { owner: `${o.owner.firstName} ${o.owner.lastName}`, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += f.expectedDealValue || 0;
      byOwnerMap.set(key, cur);
    }

    return {
      kpis: {
        totalPipeline,
        weightedPipeline,
        openOpportunities: openOpps.length,
        closedWonRevenue,
        winRate,
        avgOpportunitySize,
        oppsClosingThisMonth,
        totalExpectedMargin,
        totalGrossMargin,
        totalMarginLoss,
        totalBottomLineCost,
      },
      charts: {
        pipelineByStage: Array.from(byStageMap.values()),
        revenueByMonth,
        oppsByOwner: Array.from(byOwnerMap.values()),
      },
    };
  });

  // Action center
  app.get("/api/v1/dashboard/action-center", { preHandler: app.authenticate }, async (req) => {
    const tenantId = req.authUser.tenantId;
    const userId = req.authUser.id;
    const rbacFilter = await getCreatedByFilter(req.authUser);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const staleThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      overdueTasks, tasksDueToday, newLeads, uncontactedLeads, oppsClosingThisWeek, quotesAwaiting,
      recentLeads, upcomingTasks, recentActivity, openOppsForRisk,
    ] = await Promise.all([
      prisma.activity.count({ where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { lt: todayStart } } }),
      prisma.activity.count({ where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { gte: todayStart, lte: todayEnd } } }),
      prisma.lead.count({ where: { tenantId, ...rbacFilter, archived: false, createdAt: { gte: sevenDaysAgo } } }),
      prisma.lead.count({ where: { tenantId, ...rbacFilter, archived: false, status: "NEW" } }),
      prisma.opportunity.count({ where: { tenantId, ...rbacFilter, archived: false, stage: { isClosed: false }, expectedCloseDate: { gte: todayStart, lte: weekEnd } } }),
      prisma.quote.count({ where: { tenantId, ...rbacFilter, status: { in: ["SENT", "VIEWED", "DRAFT"] } } }),
      prisma.lead.findMany({ where: { tenantId, ...rbacFilter, archived: false }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, firstName: true, lastName: true, companyName: true, status: true, createdAt: true } }),
      prisma.activity.findMany({
        where: { tenantId, ownerId: userId, type: "TASK", status: "PENDING", dueDate: { gte: todayStart } },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: {
          account: { select: { id: true, name: true } },
          opportunity: { select: { id: true, name: true } },
          lead: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.activity.findMany({ where: { tenantId, ...rbacFilter }, orderBy: { createdAt: "desc" }, take: 8, include: { owner: { select: { firstName: true, lastName: true } }, account: { select: { id: true, name: true } }, opportunity: { select: { id: true, name: true } }, lead: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.opportunity.findMany({
        where: { tenantId, ...rbacFilter, archived: false, stage: { isClosed: false } },
        include: { account: { select: { id: true, name: true } }, activities: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
    ]);

    const opportunitiesAtRisk = openOppsForRisk
      .map((o) => {
        const lastActivity = o.activities[0]?.createdAt;
        const noRecentActivity = !lastActivity || lastActivity < staleThreshold;
        const closeDatePassed = o.expectedCloseDate && o.expectedCloseDate < todayStart;
        if (!noRecentActivity && !closeDatePassed) return null;
        const daysSince = lastActivity
          ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((now.getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        return {
          id: o.id,
          name: o.name,
          amount: o.amount,
          account: o.account,
          reason: closeDatePassed ? "Expected close date passed" : `No activity for ${daysSince} days`,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(0, 8);

    return {
      todaysWork: { overdueTasks, tasksDueToday, newLeads, uncontactedLeads, oppsClosingThisWeek, quotesAwaiting },
      recentLeads,
      upcomingTasks,
      recentActivity,
      opportunitiesAtRisk,
    };
  });
}
