import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";

export interface AuthUser {
  id: string;
  tenantId: string;
  homeTenantId: string;
  orgRole: "SUPER_ADMIN" | "SENIOR_PARTNER" | "PARTNER" | "MANAGER";
  email: string;
  firstName?: string;
  lastName?: string;
  partnerId?: string | null;
}

// What actually gets signed into the JWT -- a narrower shape than AuthUser,
// which also carries fields (homeTenantId, the "as-tenant" effective
// tenantId, firstName/lastName) that are re-derived from the DB on every
// request in `authenticate` below rather than trusted from the token.
export interface JwtPayload {
  id: string;
  tenantId: string;
  orgRole: "SUPER_ADMIN" | "SENIOR_PARTNER" | "PARTNER" | "MANAGER";
  email: string;
  partnerId?: string | null;
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

import { prisma } from "../lib/prisma.js";

export async function registerAuth(app: FastifyInstance) {
  if (!process.env.JWT_SECRET) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set in production — refusing to start with an insecure default secret.");
    }
    // eslint-disable-next-line no-console
    console.warn("[auth] JWT_SECRET is not set — using an insecure development-only default. Set JWT_SECRET before deploying.");
  }

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  });

  app.decorate(
    "authenticate",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        const decoded = req.user as unknown as JwtPayload;
        const dbUser = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { tenantId: true, orgRole: true, partnerId: true, firstName: true, lastName: true, email: true, active: true },
        });
        // A missing or deactivated user means the account was removed/disabled after
        // this token was issued — reject rather than falling back to the token's own
        // (now stale) claims, which would let a deleted/deactivated user keep access
        // until the token naturally expires.
        if (!dbUser || dbUser.active === false) {
          reply.code(401).send({ error: "Unauthorized" });
          return;
        }

        // SUPER_ADMIN is a cross-tenant platform role: every other role is
        // permanently scoped to the tenant row they belong to (dbUser.tenantId),
        // but a Super Admin can operate "as" any tenant by sending the
        // x-active-tenant-id header (set by the frontend's tenant switcher).
        // Every route in the app filters by req.authUser.tenantId already, so
        // resolving it here -- rather than touching every route -- is what
        // makes the switch take effect everywhere without a wider rewrite.
        let effectiveTenantId = dbUser.tenantId;
        if (dbUser.orgRole === "SUPER_ADMIN") {
          const requestedTenantId = req.headers["x-active-tenant-id"];
          if (typeof requestedTenantId === "string" && requestedTenantId) {
            const targetTenant = await prisma.tenant.findUnique({ where: { id: requestedTenantId }, select: { id: true } });
            if (targetTenant) {
              effectiveTenantId = targetTenant.id;
            }
          }
        }

        req.authUser = {
          ...decoded,
          tenantId: effectiveTenantId,
          homeTenantId: dbUser.tenantId,
          orgRole: dbUser.orgRole,
          partnerId: dbUser.partnerId ?? null,
          firstName: dbUser.firstName || "Manager",
          lastName: dbUser.lastName || "",
          email: dbUser.email,
        };
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
}
