import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter } from "../lib/rbac.js";

export default async function reportRoutes(app: FastifyInstance) {
  // Pipeline health report
  app.get("/api/v1/reports/pipeline-health", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const rbacFilter = await getCreatedByFilter(req.authUser);

    const stages = await prisma.pipelineStage.findMany({
      where: { pipeline: { tenantId, type: "DEAL" } },
      orderBy: { order: "asc" },
    });

    const stageData = await Promise.all(stages.map(async (stage) => {
      const deals = await prisma.deal.findMany({
        where: { tenantId, ...rbacFilter, stageId: stage.id, stage: { isClosed: false } },
        select: { amount: true, closeDate: true, createdAt: true, updatedAt: true },
      });
      const total = deals.reduce((s, d) => s + Number(d.amount), 0);
      const overdue = deals.filter(d => d.closeDate && new Date(d.closeDate) < new Date()).length;
      const avgAge = deals.length > 0
        ? deals.reduce((s, d) => s + (Date.now() - new Date(d.createdAt).getTime()), 0) / deals.length / 86400000
        : 0;

      return {
        stage: { id: stage.id, name: stage.name, order: stage.order },
        count: deals.length,
        amount: total,
        overdue,
        avgAgeDays: Math.round(avgAge),
      };
    }));

    return { data: stageData.filter(s => !stages.find(st => st.id === s.stage.id)?.isClosed) };
  });

  // Owner performance report
  app.get("/api/v1/reports/owner-performance", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const { period } = req.query as any;

    const now = new Date();
    const targetPeriod = period || now.toISOString().slice(0, 7);
    const [year, month] = targetPeriod.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, firstName: true, lastName: true, orgRole: true },
    });

    const rbacFilter = await getCreatedByFilter(req.authUser);

    const data = await Promise.all(users.map(async (user) => {
      const [openDeals, wonDeals, lostDeals, openOpps] = await Promise.all([
        prisma.deal.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: false } },
          select: { amount: true, probability: true },
        }),
        prisma.deal.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, wonDate: { gte: periodStart, lte: periodEnd } },
          select: { amount: true },
        }),
        prisma.deal.findMany({
          where: { tenantId, ...rbacFilter, ownerId: user.id, stage: { isClosed: true, isWon: false }, updatedAt: { gte: periodStart, lte: periodEnd } },
          select: { amount: true },
        }),
        prisma.opportunity.count({ where: { tenantId, ...rbacFilter, ownerId: user.id, isConverted: false } }),
      ]);

      const pipeline = openDeals.reduce((s, d) => s + Number(d.amount), 0);
      const weighted = openDeals.reduce((s, d) => s + Number(d.amount) * (d.probability / 100), 0);
      const closedWon = wonDeals.reduce((s, d) => s + Number(d.amount), 0);
      const closedLost = lostDeals.reduce((s, d) => s + Number(d.amount), 0);
      const winRate = (wonDeals.length + lostDeals.length) > 0
        ? wonDeals.length / (wonDeals.length + lostDeals.length)
        : null;

      return {
        user,
        metrics: {
          pipeline, weighted, closedWon, closedLost,
          openDeals: openDeals.length, openOpportunities: openOpps,
          wonDeals: wonDeals.length, lostDeals: lostDeals.length,
          winRate,
        },
      };
    }));

    return { period: targetPeriod, data: data.filter(d => d.metrics.pipeline > 0 || d.metrics.closedWon > 0 || d.metrics.openDeals > 0) };
  });

  // Win/Loss analysis
  app.get("/api/v1/reports/win-loss", { preHandler: [app.authenticate] }, async (req: any) => {
    const tenantId = req.authUser.tenantId;
    const { months = "6" } = req.query as any;
    const since = new Date();
    since.setMonth(since.getMonth() - Number(months));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const [wonDeals, lostDeals] = await Promise.all([
      prisma.deal.findMany({
        where: { tenantId, ...rbacFilter, wonDate: { gte: since }, stage: { isClosed: true, isWon: true } },
        include: { stage: true, owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.deal.findMany({
        where: { tenantId, ...rbacFilter, updatedAt: { gte: since }, stage: { isClosed: true, isWon: false } },
        include: { stage: true, owner: { select: { id: true, firstName: true, lastName: true } } },
      }),
    ]);

    // Group by month
    const monthlyData: Record<string, { period: string; won: number; lost: number; wonAmount: number; lostAmount: number }> = {};
    const addToMonth = (date: Date | null | undefined, amount: number, type: "won" | "lost") => {
      if (!date) return;
      const period = date.toISOString().slice(0, 7);
      if (!monthlyData[period]) monthlyData[period] = { period, won: 0, lost: 0, wonAmount: 0, lostAmount: 0 };
      monthlyData[period][type]++;
      monthlyData[period][`${type}Amount`] += amount;
    };

    wonDeals.forEach(d => addToMonth(d.wonDate, Number(d.amount), "won"));
    lostDeals.forEach(d => addToMonth(d.updatedAt, Number(d.amount), "lost"));

    return {
      summary: {
        totalWon: wonDeals.length,
        totalLost: lostDeals.length,
        wonRevenue: wonDeals.reduce((s, d) => s + Number(d.amount), 0),
        lostRevenue: lostDeals.reduce((s, d) => s + Number(d.amount), 0),
        winRate: (wonDeals.length + lostDeals.length) > 0 ? wonDeals.length / (wonDeals.length + lostDeals.length) : 0,
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
    // Accept either 'type' or 'fieldType', default to TEXT
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
