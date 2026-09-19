import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

// SUPER_ADMIN-only: powers the tenant switcher that lets a platform admin
// pick which tenant's data req.authUser.tenantId should resolve to (see
// plugins/auth.ts's x-active-tenant-id handling).
export default async function tenantRoutes(app: FastifyInstance) {
  app.get("/api/v1/tenants", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    if (req.authUser.orgRole !== "SUPER_ADMIN") {
      return reply.code(403).send({ error: "Only Super Admins can list tenants" });
    }

    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });

    return { data: tenants };
  });
}
