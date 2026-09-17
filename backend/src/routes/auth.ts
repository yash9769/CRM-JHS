import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  needsTotpChallenge,
  totpOtpauthUrl,
  totpQrCodeDataUrl,
  verifyTotpCode,
} from "../lib/totp.js";
import { signFlowToken, verifyFlowToken } from "../lib/authFlowToken.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const totpCodeSchema = z.object({
  token: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

export default async function authRoutes(app: FastifyInstance) {
  // Accounts are created exclusively by an admin running `backend/scripts/createUser.ts`
  // (credentials are emailed to the new user) — there is no public self-registration
  // or workspace-creation endpoint. See that script for how new users are provisioned.

  function issueSessionToken(user: { id: string; tenantId: string; orgRole: string; email: string; partnerId: string | null }) {
    return app.jwt.sign(
      {
        id: user.id,
        tenantId: user.tenantId,
        orgRole: user.orgRole as any,
        email: user.email,
        partnerId: user.partnerId,
      },
      { expiresIn: "8h" }
    );
  }

  app.post(
    "/api/v1/auth/login",
    { preHandler: app.rateLimit() },
    async (req, reply) => {
      const body = loginSchema.parse(req.body);
      const user = await prisma.user.findFirst({ where: { email: body.email } });
      if (!user || !user.active) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      const valid = await argon2.verify(user.passwordHash, body.password);
      if (!valid) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }

      if (!user.totpEnabled) {
        // First login (or a previously abandoned enrollment) — reuse the pending
        // secret if one is already pending so a QR the user already scanned stays valid.
        let secret = user.totpSecret ? decryptTotpSecret(user.totpSecret) : null;
        if (!secret) {
          secret = generateTotpSecret();
          await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptTotpSecret(secret) } });
        }
        const otpauthUrl = totpOtpauthUrl(user.email, secret);
        return reply.send({
          requiresTotpSetup: true,
          setupToken: signFlowToken("totp_setup", user.id),
          secret,
          otpauthUrl,
          qrCodeDataUrl: await totpQrCodeDataUrl(otpauthUrl),
        });
      }

      if (needsTotpChallenge(user.totpVerifiedAt)) {
        return reply.send({
          requiresTotpChallenge: true,
          challengeToken: signFlowToken("totp_challenge", user.id),
        });
      }

      return reply.send({
        token: issueSessionToken(user),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgRole: user.orgRole,
          partnerId: user.partnerId,
        },
      });
    }
  );

  app.post(
    "/api/v1/auth/totp/setup-verify",
    { preHandler: app.rateLimit({ max: 8, timeWindow: "1 minute" }) },
    async (req, reply) => {
      const body = totpCodeSchema.parse(req.body);
      const flow = verifyFlowToken(body.token, "totp_setup");
      if (!flow) return reply.code(401).send({ error: "This setup link has expired — please sign in again." });

      const user = await prisma.user.findUnique({ where: { id: flow.userId } });
      if (!user || !user.active || user.totpEnabled || !user.totpSecret) {
        return reply.code(401).send({ error: "This setup link has expired — please sign in again." });
      }

      const secret = decryptTotpSecret(user.totpSecret);
      if (!verifyTotpCode(secret, body.code)) {
        return reply.code(401).send({ error: "Incorrect code — check your authenticator app and try again." });
      }

      const now = new Date();
      await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpVerifiedAt: now } });

      return reply.send({
        token: issueSessionToken(user),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgRole: user.orgRole,
          partnerId: user.partnerId,
        },
      });
    }
  );

  app.post(
    "/api/v1/auth/totp/challenge-verify",
    { preHandler: app.rateLimit({ max: 8, timeWindow: "1 minute" }) },
    async (req, reply) => {
      const body = totpCodeSchema.parse(req.body);
      const flow = verifyFlowToken(body.token, "totp_challenge");
      if (!flow) return reply.code(401).send({ error: "This session has expired — please sign in again." });

      const user = await prisma.user.findUnique({ where: { id: flow.userId } });
      if (!user || !user.active || !user.totpEnabled || !user.totpSecret) {
        return reply.code(401).send({ error: "This session has expired — please sign in again." });
      }

      const secret = decryptTotpSecret(user.totpSecret);
      if (!verifyTotpCode(secret, body.code)) {
        return reply.code(401).send({ error: "Incorrect code — check your authenticator app and try again." });
      }

      await prisma.user.update({ where: { id: user.id }, data: { totpVerifiedAt: new Date() } });

      return reply.send({
        token: issueSessionToken(user),
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          orgRole: user.orgRole,
          partnerId: user.partnerId,
        },
      });
    }
  );

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
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: req.authUser.tenantId },
    });
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
