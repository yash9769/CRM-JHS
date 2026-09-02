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
  // Registers a brand-new tenant with its first Senior Partner user.
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
          orgRole: "SENIOR_PARTNER",
          createdById: null,
          partnerId: null,
        },
      });

      // Seed default Opportunity + Deal pipelines with canonical 10 stages.
      const canonicalStages = [
        { name: "Prospect", order: 1, probability: 10, isClosed: false, isWon: false },
        { name: "Lead", order: 2, probability: 20, isClosed: false, isWon: false },
        { name: "Marketing Qualified Lead", order: 3, probability: 30, isClosed: false, isWon: false },
        { name: "Scope Discussion", order: 4, probability: 50, isClosed: false, isWon: false },
        { name: "Proposal Sent", order: 5, probability: 65, isClosed: false, isWon: false },
        { name: "Negotiation", order: 6, probability: 80, isClosed: false, isWon: false },
        { name: "Closed Won", order: 7, probability: 100, isClosed: true, isWon: true },
        { name: "Closed Lost", order: 8, probability: 0, isClosed: true, isWon: false },
        { name: "Opportunity Dead", order: 9, probability: 0, isClosed: true, isWon: false },
      ];

      await tx.pipeline.create({
        data: {
          tenantId: tenant.id,
          name: "Standard Opportunity Pipeline",
          type: "OPPORTUNITY",
          isDefault: true,
          stages: { create: canonicalStages },
        },
      });

      return { tenant, user };
    });

    const token = app.jwt.sign({
      id: result.user.id,
      tenantId: result.tenant.id,
      orgRole: result.user.orgRole,
      email: result.user.email,
      partnerId: null,
    });

    return reply.code(201).send({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        orgRole: result.user.orgRole,
        partnerId: null,
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
      orgRole: user.orgRole,
      email: user.email,
      partnerId: user.partnerId,
    });

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        orgRole: user.orgRole,
        partnerId: user.partnerId,
      },
    });
  });

  app.get("/api/v1/auth/me", { preHandler: app.authenticate }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.authUser.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        orgRole: true,
        partnerId: true,
        createdById: true,
        partner: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: user.id.split("-")[0] ? req.authUser.tenantId : req.authUser.tenantId } });
    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        orgRole: user.orgRole,
        partnerId: user.partnerId,
        partner: user.partner,
      },
      tenant: { id: tenant.id, name: tenant.name },
    };
  });
}
