import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import jwt from "@fastify/jwt";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: "ADMIN" | "SALES_MANAGER" | "SALES_REP" | "VIEWER";
  email: string;
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

export async function registerAuth(app: FastifyInstance) {
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  });

  app.decorate(
    "authenticate",
    async function (req: FastifyRequest, reply: FastifyReply) {
      try {
        await req.jwtVerify();
        req.authUser = req.user as unknown as AuthUser;
      } catch {
        reply.code(401).send({ error: "Unauthorized" });
      }
    }
  );
}
