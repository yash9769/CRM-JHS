import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter, getVisibleUserIds, requireExportPermission } from "../lib/rbac.js";
import { toCsv } from "../lib/csv.js";
import { PERIOD_REGEX, parsePeriodRange } from "../lib/period.js";

export default async function reportRoutes(app: FastifyInstance) {
  // Pipeline health report
  app.get("/api/v1/reports/pipeline-health", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);

    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { tenantId, type: "OPPORTUNITY" } },
      orderBy: { order: "asc" },
    });

    const stageData = await Promise.all(stages.map(async (stage) => {
      const opps = await prisma.opportunity.findMany({
        where: { tenantId, ...rbacFilter, stageId: stage.id, stage: { isClosed: false } },
        select: { amount: true, expectedCloseDate: true, createdAt: true, updatedAt: true },
      });
      const total = opps.reduce((s, o) => s + Number(o.amount), 0);
      const overdue = opps.filter(o => o.expectedCloseDate && new Date(o.expectedCloseDate) < new Date()).length;
      const avgAge = opps.length > 0
        ? opps.reduce((s, o) => s + Math.max(0, Date.now() - new Date(o.createdAt).getTime()), 0) / opps.length / 86400000
        : 0;

      return {
        stage: { id: stage.id, name: stage.name, order: stage.order },
        count: opps.length,
        amount: total,
        overdue,
        avgAgeDays: Math.round(avgAge),
      };
    }));

    return { data: stageData.filter(s => !stages.find(st => st.id === s.stage.id)?.isClosed) };
  });

  // Owner performance report (Restricted for Managers)
  app.get("/api/v1/reports/owner-performance", { preHandler: [app.authenticate] }, async (req: any, reply: any) => {
    if (req.authUser.orgRole === "MANAGER") {
      return reply.status(403).send({ error: "Forbidden: Owner performance report is restricted to leadership" });
    }
    const tenantId = req.authUser.tenantId;
    const { period } = req.query as any;

    const now = new Date();
    const targetPeriod = period || now.toISOString().slice(0, 7);
    const [year, month] = targetPeriod.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const visibleIds = await getVisibleUserIds(req.authUser);
    const users = await prisma.user.findMany({
      where: { tenantId, id: { in: visibleIds } },
      select: { id: true, firstName: true, lastName: true, orgRole: true },
    });

    const rbacFilter = await getCreatedByFilter(req.authUser);

    const data = await Promise.all(users.map(async (user) => {
      const [openOpps, wonOpps, lostOpps] = await Promise.all([
        prisma.opportunity.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: false } },
          select: { amount: true, probability: true, expectedOpportunityValue: true, stage: { select: { probability: true } } },
        }),
        prisma.opportunity.findMany({
          // `rbacFilter` and the date-window filter both use `OR`; compose them
          // with `AND` so the RBAC restriction is not silently overwritten.
          where: { tenantId, AND: [rbacFilter, { OR: [{ wonDate: { gte: periodStart, lte: periodEnd } }, { actualCloseDate: { gte: periodStart, lte: periodEnd } }, { updatedAt: { gte: periodStart, lte: periodEnd } }] }], ownerId: user.id, stage: { isClosed: true, isWon: true } },
          select: { amount: true },
        }),
        prisma.opportunity.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: true, isWon: false }, updatedAt: { gte: periodStart, lte: periodEnd } },
          select: { amount: true },
        }),
      ]);

      const pipeline = openOpps.reduce((s, o) => s + Number(o.expectedOpportunityValue ?? o.amount ?? 0), 0);
      const weighted = openOpps.reduce((s, o) => {
        const prob = (o.probability !== null && o.probability !== undefined) ? o.probability : (o.stage?.probability ?? 0);
        const amt = Number(o.expectedOpportunityValue ?? o.amount ?? 0);
        return s + amt * (prob / 100);
      }, 0);
      const closedWon = wonOpps.reduce((s, o) => s + Number(o.amount), 0);
      const closedLost = lostOpps.reduce((s, o) => s + Number(o.amount), 0);
      const winRate = (wonOpps.length + lostOpps.length) > 0
        ? wonOpps.length / (wonOpps.length + lostOpps.length)
        : null;

      return {
        user,
        metrics: {
          pipeline, weighted, closedWon, closedLost,
          openOpportunities: openOpps.length,
          wonOpportunities: wonOpps.length, lostOpportunities: lostOpps.length,
          winRate,
        },
      };
    }));

    return { period: targetPeriod, data: data.filter(d => d.metrics.pipeline > 0 || d.metrics.closedWon > 0 || d.metrics.openOpportunities > 0) };
  });

  // Owner performance export CSV
  app.get("/api/v1/reports/owner-performance/export", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    requireExportPermission(req.authUser);
    const tenantId = req.authUser.tenantId;
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, orgRole: true },
    });

    const rbacFilter = await getCreatedByFilter(req.authUser);

    const rows = await Promise.all(users.map(async (user) => {
      const [openOpps, wonOpps, lostOpps] = await Promise.all([
        prisma.opportunity.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: false } },
          select: { amount: true, probability: true, expectedOpportunityValue: true, stage: { select: { probability: true } } },
        }),
        prisma.opportunity.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: true, isWon: true } },
          select: { amount: true },
        }),
        prisma.opportunity.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: true, isWon: false } },
          select: { amount: true },
        }),
      ]);

      const pipeline = openOpps.reduce((s, o) => s + Number(o.expectedOpportunityValue ?? o.amount ?? 0), 0);
      const weighted = openOpps.reduce((s, o) => {
        const prob = (o.probability !== null && o.probability !== undefined) ? o.probability : (o.stage?.probability ?? 0);
        const amt = Number(o.expectedOpportunityValue ?? o.amount ?? 0);
        return s + amt * (prob / 100);
      }, 0);
      const closedWon = wonOpps.reduce((s, o) => s + Number(o.amount), 0);
      const winRate = (wonOpps.length + lostOpps.length) > 0
        ? `${Math.round((wonOpps.length / (wonOpps.length + lostOpps.length)) * 100)}%`
        : "—";

      return {
        rep: `${user.firstName} ${user.lastName}`,
        role: user.orgRole.replace("_", " "),
        openOpportunities: openOpps.length,
        pipeline,
        weighted,
        closedWon,
        winRate,
      };
    }));

    const csv = toCsv(rows, [
      { key: "rep", label: "Rep Name" },
      { key: "role", label: "Role" },
      { key: "openOpportunities", label: "Open Opps" },
      { key: "pipeline", label: "Pipeline Value" },
      { key: "weighted", label: "Weighted Value" },
      { key: "closedWon", label: "Closed Won Revenue" },
      { key: "winRate", label: "Win Rate" },
    ]);

    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="owner_performance.csv"');
    return reply.send(csv);
  });

  // Win/Loss analysis
  app.get("/api/v1/reports/win-loss", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const { period, months } = req.query as any;

    // A specific period ("YYYY-MM" / "YYYY-Qn" / "YYYY") scopes the summary
    // numbers to exactly that window; the legacy `months` param (trailing N
    // months from now) is kept for backward compatibility when no period is
    // given. Either way, the "Monthly trend" chart always spans a 6-month
    // window ending at the last month covered by the selection, so a single
    // month/quarter/year selection still shows a meaningful trend alongside
    // its own exact-period summary.
    let summaryStart: Date;
    let summaryEnd: Date;
    let anchorMonth: Date;
    if (period && PERIOD_REGEX.test(period)) {
      const r = parsePeriodRange(period);
      summaryStart = r.start;
      summaryEnd = r.end;
      anchorMonth = new Date(r.end);
      anchorMonth.setUTCMonth(anchorMonth.getUTCMonth() - 1);
    } else {
      const m = Number(months || 6);
      summaryEnd = new Date();
      summaryStart = new Date();
      summaryStart.setMonth(summaryStart.getMonth() - m);
      anchorMonth = new Date(Date.UTC(summaryEnd.getUTCFullYear(), summaryEnd.getUTCMonth(), 1));
    }
    const trendStart = new Date(Date.UTC(anchorMonth.getUTCFullYear(), anchorMonth.getUTCMonth() - 5, 1));
    const trendEnd = summaryEnd;

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const [wonOpps, lostOpps] = await Promise.all([
      prisma.opportunity.findMany({
        // `rbacFilter` and the date-window filter both use `OR`; compose them
        // with `AND` so the RBAC restriction is not silently overwritten.
        where: { tenantId, AND: [rbacFilter, { OR: [{ wonDate: { gte: trendStart, lt: trendEnd } }, { actualCloseDate: { gte: trendStart, lt: trendEnd } }] }], stage: { isClosed: true, isWon: true } },
        include: { stage: true, owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.opportunity.findMany({
        where: { tenantId, ...rbacFilter, updatedAt: { gte: trendStart, lt: trendEnd }, stage: { isClosed: true, isWon: false } },
        include: { stage: true, owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);

    // Group by month (always the full trend window)
    const monthlyData: Record<string, { period: string; won: number; lost: number; wonAmount: number; lostAmount: number }> = {};
    const addToMonth = (date: Date | null | undefined, amount: number, type: "won" | "lost") => {
      if (!date) return;
      const period = date.toISOString().slice(0, 7);
      if (!monthlyData[period]) monthlyData[period] = { period, won: 0, lost: 0, wonAmount: 0, lostAmount: 0 };
      monthlyData[period][type]++;
      monthlyData[period][`${type}Amount`] += amount;
    };
    wonOpps.forEach(o => addToMonth(o.wonDate || o.actualCloseDate, Number(o.amount), "won"));
    lostOpps.forEach(o => addToMonth(o.updatedAt, Number(o.amount), "lost"));

    // Summary numbers are scoped to exactly the selected period (a subset of
    // the wider trend window fetched above).
    const inSummaryWindow = (date: Date | null | undefined) => !!date && date >= summaryStart && date < summaryEnd;
    const summaryWon = wonOpps.filter(o => inSummaryWindow(o.wonDate || o.actualCloseDate));
    const summaryLost = lostOpps.filter(o => inSummaryWindow(o.updatedAt));

    return {
      summary: {
        totalWon: summaryWon.length,
        totalLost: summaryLost.length,
        wonRevenue: summaryWon.reduce((s, o) => s + Number(o.amount), 0),
        lostRevenue: summaryLost.reduce((s, o) => s + Number(o.amount), 0),
        winRate: (summaryWon.length + summaryLost.length) > 0 ? summaryWon.length / (summaryWon.length + summaryLost.length) : 0,
      },
      monthly: Object.values(monthlyData).sort((a, b) => a.period.localeCompare(b.period)),
    };
  });

  // Stage conversion (funnel)
  app.get("/api/v1/reports/conversion-funnel", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;

    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { tenantId, type: "OPPORTUNITY" } },
      orderBy: { order: "asc" },
    });

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const stageCounts = await Promise.all(stages.map(async (s) => {
      const [count, amount] = await Promise.all([
        prisma.opportunity.count({ where: { tenantId, ...rbacFilter, stageId: s.id } }),
        prisma.opportunity.aggregate({ where: { tenantId, ...rbacFilter, stageId: s.id }, _sum: { amount: true } }),
      ]);
      return { stage: s, count, amount: Number(amount._sum.amount || 0) };
    }));

    return { data: stageCounts };
  });

  // Custom properties management
  app.get("/api/v1/properties", { preHandler: [app.authenticate] }, async (req: any) => {
    const { objectType } = req.query as any;
    const props = await prisma.propertyDefinition.findMany({
      where: { tenantId: req.authUser.tenantId, ...(objectType ? { objectType } : {}) },
      orderBy: { createdAt: "asc" },
    });
    return { data: props };
  });

  app.post("/api/v1/properties", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const { objectType, name, label, type, fieldType, options, required } = req.body as any;
    const resolvedType = (type || fieldType || "TEXT").toUpperCase();
    const validTypes = ["TEXT", "NUMBER", "BOOLEAN", "DATE", "DATETIME", "SELECT", "MULTISELECT"];
    const propType = validTypes.includes(resolvedType) ? resolvedType : "TEXT";
    const prop = await prisma.propertyDefinition.create({
      data: {
        tenantId: req.authUser.tenantId,
        objectType,
        name: name.toLowerCase().replace(/\s+/g, "_"),
        label,
        type: propType as any,
        enumOptions: options || [],
        required: required || false,
      },
    });
    return reply.code(201).send(prop);
  });

  app.delete("/api/v1/properties/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const prop = await prisma.propertyDefinition.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!prop) return reply.code(404).send({ error: "Property not found" });
    await prisma.propertyDefinition.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });
}
