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
          select: { tenantId: true, orgRole: true, partnerId: true, firstName: true, lastName: true, email: true },
        });
        req.authUser = {
          ...decoded,
          tenantId: dbUser?.tenantId || decoded.tenantId,
          orgRole: dbUser?.orgRole || decoded.orgRole,
          partnerId: dbUser?.partnerId ?? null,
          firstName: dbUser?.firstName || decoded.firstName || "Manager",
          lastName: dbUser?.lastName || decoded.lastName || "",
          email: dbUser?.email || decoded.email,
        };
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
}
