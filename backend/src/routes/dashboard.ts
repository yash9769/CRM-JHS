import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter } from "../lib/rbac.js";
import { computeOpportunityFinancials } from "../lib/financial.js";
import { generateDashboardPdf } from "../lib/dashboardPdf.js";

async function computeDashboardData(tenantId: string, rbacFilter: any, period?: string) {
    const targetDate = period && /^\d{4}-\d{2}$/.test(period)
      ? new Date(`${period}-01T00:00:00Z`)
      : new Date();
    const cycleStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1));
    const cycleEnd = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1));

    const [openOpps, closedWonOpps, closedLostOpps] = await Promise.all([
      prisma.opportunity.findMany({ where: { tenantId, ...rbacFilter, stage: { isClosed: false } }, include: { stage: true, account: true, owner: true } }),
      prisma.opportunity.findMany({ where: { tenantId, ...rbacFilter, stage: { isClosed: true, isWon: true } }, include: { owner: { select: { id: true, firstName: true, lastName: true } } } }),
      prisma.opportunity.findMany({ where: { tenantId, ...rbacFilter, stage: { isClosed: true, isWon: false } }, select: { ownerId: true, owner: { select: { id: true, firstName: true, lastName: true } } } }),
    ]);

    // Filter Closed Won opportunities by selected cycle period.
    // Do NOT fall back to all-time data: an empty cycle should show ₹0,
    // not lifetime revenue, which would mislead the user.
    const cycleClosedWonOpps = closedWonOpps.filter((opp) => {
      const date = opp.wonDate || opp.actualCloseDate || opp.updatedAt;
      return date && date >= cycleStart && date < cycleEnd;
    });
    const activeWonOpps = cycleClosedWonOpps;

    const openOppsFinancials = openOpps.map((o) => computeOpportunityFinancials(o));
    const closedWonFinancials = activeWonOpps.map((o) => computeOpportunityFinancials(o));

    const totalPipeline = openOppsFinancials.reduce((s, f, idx) => s + (f.expectedOpportunityValue ?? Number(openOpps[idx].amount || 0)), 0);
    const weightedPipeline = openOpps.reduce((s, o, idx) => {
      const oppValue = openOppsFinancials[idx].expectedOpportunityValue ?? Number(o.amount || 0);
      const prob = (o.probability !== undefined && o.probability !== null && o.probability > 0) ? o.probability : (o.stage?.probability ?? 0);
      return s + oppValue * (prob / 100);
    }, 0);
    const closedWonRevenue = closedWonFinancials.reduce((s, f) => s + (f.actualOpportunityValue !== null ? f.actualOpportunityValue : (f.expectedOpportunityValue || 0)), 0);

    const totalExpectedMargin = openOppsFinancials.reduce((s, f) => s + (f.expectedMargin || 0), 0);
    const totalGrossMargin = closedWonFinancials.reduce((s, f) => s + (f.grossMargin || 0), 0);
    const totalMarginLoss = closedWonFinancials.reduce((s, f) => s + (f.marginLoss || 0), 0);
    const openCostIncurred = openOppsFinancials.reduce((s, f) => s + (f.bottomLineCost || 0), 0);
    const closedWonCostIncurred = closedWonFinancials.reduce((s, f) => s + (f.bottomLineCost || 0), 0);
    const totalBottomLineCost = openCostIncurred + closedWonCostIncurred;

    const winRate = closedWonOpps.length + closedLostOpps.length > 0
      ? closedWonOpps.length / (closedWonOpps.length + closedLostOpps.length)
      : 0;
    const avgOpportunitySize = activeWonOpps.length > 0 ? closedWonRevenue / activeWonOpps.length : 0;

    // Per-team-member breakdown of every KPI above
    type OwnerBreakdown = {
      ownerId: string; ownerName: string;
      totalPipeline: number; weightedPipeline: number; openOpportunities: number;
      closedWonRevenue: number; closedWonCount: number; closedLostCount: number;
      winRate: number; avgOpportunitySize: number; marginValue: number; costIncurred: number;
    };
    const ownerMap = new Map<string, OwnerBreakdown>();
    function ownerEntry(id: string, name: string): OwnerBreakdown {
      let entry = ownerMap.get(id);
      if (!entry) {
        entry = {
          ownerId: id, ownerName: name,
          totalPipeline: 0, weightedPipeline: 0, openOpportunities: 0,
          closedWonRevenue: 0, closedWonCount: 0, closedLostCount: 0,
          winRate: 0, avgOpportunitySize: 0, marginValue: 0, costIncurred: 0,
        };
        ownerMap.set(id, entry);
      }
      return entry;
    }
    for (let i = 0; i < openOpps.length; i++) {
      const o = openOpps[i];
      const f = openOppsFinancials[i];
      const oppValue = f.expectedOpportunityValue ?? Number(o.amount || 0);
      const prob = (o.probability !== undefined && o.probability !== null && o.probability > 0) ? o.probability : (o.stage?.probability ?? 0);
      const e = ownerEntry(o.ownerId, `${o.owner.firstName} ${o.owner.lastName}`);
      e.openOpportunities += 1;
      e.totalPipeline += oppValue;
      e.weightedPipeline += oppValue * (prob / 100);
      e.marginValue += f.expectedMargin || 0;
      e.costIncurred += f.bottomLineCost || 0;
    }
    for (let i = 0; i < activeWonOpps.length; i++) {
      const o = activeWonOpps[i];
      const f = closedWonFinancials[i];
      const e = ownerEntry(o.ownerId, `${o.owner.firstName} ${o.owner.lastName}`);
      e.closedWonCount += 1;
      e.closedWonRevenue += f.actualOpportunityValue !== null ? f.actualOpportunityValue : (f.expectedOpportunityValue || 0);
      e.marginValue += f.grossMargin || 0;
      e.costIncurred += f.bottomLineCost || 0;
    }
    for (const o of closedLostOpps) {
      if (!o.owner) continue;
      const e = ownerEntry(o.ownerId, `${o.owner.firstName} ${o.owner.lastName}`);
      e.closedLostCount += 1;
    }
    for (const e of ownerMap.values()) {
      e.winRate = (e.closedWonCount + e.closedLostCount) > 0 ? e.closedWonCount / (e.closedWonCount + e.closedLostCount) : 0;
      e.avgOpportunitySize = e.closedWonCount > 0 ? e.closedWonRevenue / e.closedWonCount : 0;
    }
    const byOwner = Array.from(ownerMap.values()).sort(
      (a, b) => (b.totalPipeline + b.closedWonRevenue) - (a.totalPipeline + a.closedWonRevenue)
    );

    const oppsClosingThisMonth = openOpps.filter(
      (o) => o.expectedCloseDate && o.expectedCloseDate >= cycleStart && o.expectedCloseDate < cycleEnd
    ).length;

    // Pipeline by stage (open opportunities)
    const byStageMap = new Map<string, { stageName: string; count: number; amount: number }>();
    for (let i = 0; i < openOpps.length; i++) {
      const o = openOpps[i];
      const f = openOppsFinancials[i];
      const key = o.stageId;
      const cur = byStageMap.get(key) || { stageName: o.stage.name, count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += f.expectedOpportunityValue || 0;
      byStageMap.set(key, cur);
    }

    // Revenue by month leading up to target cycle month (last 6 months)
    const revenueByMonth: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() - i, 1));
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const revenue = closedWonOpps
        .filter((opp) => {
          const date = opp.wonDate || opp.actualCloseDate || opp.updatedAt;
          return date && date >= start && date < end;
        })
        .reduce((s, opp) => {
          const f = computeOpportunityFinancials(opp);
          return s + (f.actualOpportunityValue !== null ? f.actualOpportunityValue : (f.expectedOpportunityValue || 0));
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
      cur.amount += f.expectedOpportunityValue || 0;
      byOwnerMap.set(key, cur);
    }

    // New pipeline created per month leading up to target cycle month (last 3 months)
    const pipelineVelocity: { month: string; amount: number }[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() - i, 1));
      const label = d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
      const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const amount = openOpps.reduce((s, o, idx) => {
        if (o.createdAt >= start && o.createdAt < end) return s + (openOppsFinancials[idx].expectedOpportunityValue || 0);
        return s;
      }, 0);
      pipelineVelocity.push({ month: label, amount });
    }
    const pipelineCreatedThisMonth = pipelineVelocity[2]?.amount || 0;
    const pipelineCreatedLastMonth = pipelineVelocity[1]?.amount || 0;
    const pipelineVelocityPct = pipelineCreatedLastMonth > 0
      ? ((pipelineCreatedThisMonth - pipelineCreatedLastMonth) / pipelineCreatedLastMonth) * 100
      : null;

    return {
      kpis: {
        totalPipeline,
        weightedPipeline,
        openOpportunities: openOpps.length,
        closedWonRevenue,
        closedWonCount: activeWonOpps.length,
        winRate,
        avgOpportunitySize,
        oppsClosingThisMonth,
        totalExpectedMargin,
        totalGrossMargin,
        totalMarginLoss,
        openCostIncurred,
        closedWonCostIncurred,
        totalBottomLineCost,
        pipelineVelocityPct,
      },
      charts: {
        pipelineByStage: Array.from(byStageMap.values()),
        revenueByMonth,
        oppsByOwner: Array.from(byOwnerMap.values()),
        pipelineVelocity,
      },
      byOwner,
    };
}

export default async function dashboardRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as { period?: string };
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);
    return computeDashboardData(tenantId, rbacFilter, q.period);
  });

  // Downloadable PDF summary of the dashboard KPIs and charts
  app.get("/api/v1/dashboard/pdf", { preHandler: app.authenticate }, async (req, reply) => {
    const q = req.query as { period?: string };
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);
    const data = await computeDashboardData(tenantId, rbacFilter, q.period);

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    const pdfBuffer = await generateDashboardPdf({
      tenantName: tenant?.name || "CRM",
      generatedFor: `${req.authUser.firstName} ${req.authUser.lastName}`,
      generatedAt: new Date(),
      ...data,
    });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="dashboard-report-${q.period || new Date().toISOString().slice(0, 10)}.pdf"`);
    return reply.send(pdfBuffer);
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
        const lastActivityDate = o.activities[0]?.createdAt || o.updatedAt || o.createdAt;
        const daysSince = Math.floor((now.getTime() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));
        const isInactive = daysSince > 7;
        const closeDatePassed = o.expectedCloseDate && o.expectedCloseDate < todayStart;

        if (!isInactive && !closeDatePassed) return null;

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
