import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const registerSchema = z.object({
  companyName: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {
  // Registers a brand-new tenant with its first Admin user.
  app.post("/api/v1/auth/register", async (req, reply) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findFirst({ where: { email: body.email } });
    if (existing) {
      return reply.code(409).send({ error: "Email already in use" });
    }

    const passwordHash = await argon2.hash(body.password);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: { name: body.companyName } });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: body.email,
          passwordHash,
          firstName: body.firstName,
          lastName: body.lastName,
          role: "ADMIN",
        },
      });

      // Seed default Opportunity + Deal pipelines with canonical 8 stages.
      const canonicalStages = [
        { name: "Lead Qualified", order: 1, probability: 10, isClosed: false, isWon: false },
        { name: "Scope Discussion", order: 2, probability: 25, isClosed: false, isWon: false },
        { name: "Demo", order: 3, probability: 40, isClosed: false, isWon: false },
        { name: "Proposal", order: 4, probability: 60, isClosed: false, isWon: false },
        { name: "Quote", order: 5, probability: 75, isClosed: false, isWon: false },
        { name: "Negotiation", order: 6, probability: 90, isClosed: false, isWon: false },
        { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
        { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
      ];

      const oppPipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: "Standard Opportunity Pipeline",
          type: "OPPORTUNITY",
          isDefault: true,
          stages: { create: canonicalStages },
        },
      });

      const dealPipeline = await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: "Standard Deal Pipeline",
          type: "DEAL",
          isDefault: true,
          stages: { create: canonicalStages },
        },
      });

      return { tenant, user, oppPipeline, dealPipeline };
    });

    const token = app.jwt.sign({
      id: result.user.id,
      tenantId: result.tenant.id,
      role: result.user.role,
      email: result.user.email,
    });

    return reply.code(201).send({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
      },
      tenant: { id: result.tenant.id, name: result.tenant.name },
    });
  });

  app.post("/api/v1/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: body.email } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }
    const valid = await argon2.verify(user.passwordHash, body.password);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  });

  app.get("/api/v1/auth/me", { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.authUser.id } });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: user.tenantId } });
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tenant: { id: tenant.id, name: tenant.name },
    };
  });

}
