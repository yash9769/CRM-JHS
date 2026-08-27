import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getCreatedByFilter } from "../lib/rbac.js";

export default async function searchRoutes(app: FastifyInstance) {
  app.get("/api/v1/search", { preHandler: [app.authenticate] }, async (req: any) => {
    const { q, limit = "5" } = req.query as any;
    if (!q || String(q).trim().length < 2) return { results: [] };

    const tenantId = req.authUser.tenantId;
    const search = String(q).trim();
    const take = Math.min(Number(limit), 20);
    const rbacFilter = await getCreatedByFilter(req.authUser);

    const [accounts, contacts, opportunities, deals, leads] = await Promise.all([
      prisma.account.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { domain: { contains: search, mode: "insensitive" } },
            { industry: { contains: search, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, industry: true, accountType: true },
        take,
      }),
      prisma.contact.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { jobTitle: { contains: search, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, firstName: true, lastName: true, email: true, jobTitle: true,
          account: { select: { id: true, name: true } },
        },
        take,
      }),
      prisma.opportunity.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          OR: [
            { name: { contains: search, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, name: true, amount: true, isConverted: true,
          account: { select: { id: true, name: true } },
          stage: { select: { name: true } },
        },
        take,
      }),
      prisma.deal.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          OR: [
            { name: { contains: search, mode: "insensitive" } },
          ],
        },
        select: {
          id: true, name: true, amount: true,
          account: { select: { id: true, name: true } },
          stage: { select: { name: true, isClosed: true, isWon: true } },
        },
        take,
      }),
      prisma.lead.findMany({
        where: {
          tenantId,
          ...rbacFilter,
          archived: false,
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, companyName: true, status: true },
        take,
      }),
    ]);

    const results = [
      ...accounts.map(a => ({ type: "account" as const, id: a.id, title: a.name, subtitle: a.industry || a.accountType, url: `/accounts/${a.id}` })),
      ...contacts.map(c => ({ type: "contact" as const, id: c.id, title: `${c.firstName} ${c.lastName}`, subtitle: [c.jobTitle, c.account?.name].filter(Boolean).join(" · "), url: `/contacts/${c.id}` })),
      ...leads.map(l => ({ type: "lead" as const, id: l.id, title: `${l.firstName} ${l.lastName}`, subtitle: [l.companyName, l.status].filter(Boolean).join(" · "), url: `/leads/${l.id}` })),
      ...opportunities.map(o => ({ type: "opportunity" as const, id: o.id, title: o.name, subtitle: [o.stage?.name, o.account?.name].filter(Boolean).join(" · "), url: `/opportunities/${o.id}` })),
      ...deals.map(d => ({ type: "deal" as const, id: d.id, title: d.name, subtitle: [d.stage?.name, d.account?.name].filter(Boolean).join(" · "), url: `/deals/${d.id}` })),
    ];

    return { results, query: search };
  });
}
