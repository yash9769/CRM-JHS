import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";

export interface AuthUser {
  id: string;
  tenantId: string;
  orgRole: "SENIOR_PARTNER" | "PARTNER" | "MANAGER";
  email: string;
  firstName?: string;
  lastName?: string;
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
    payload: AuthUser;
    user: AuthUser;
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
        const decoded = req.user as unknown as AuthUser;
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
        req.authUser = {
          ...decoded,
          tenantId: dbUser.tenantId,
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
