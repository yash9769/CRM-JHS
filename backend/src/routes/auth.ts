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
import { logAudit } from "../lib/audit.js";
import { companyFromEmail } from "../lib/company.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const totpCodeSchema = z.object({
  token: z.string().min(1),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).optional(),
    totpCode: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app").optional(),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(128, "New password must be at most 128 characters"),
  })
  .refine((b) => !!b.currentPassword !== !!b.totpCode, {
    message: "Provide either your current password or an authenticator code",
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
      // Email is only unique per-tenant (@@unique([tenantId, email])), not
      // globally -- the same address can exist in more than one tenant. Try
      // every matching row's password rather than trusting findFirst's
      // arbitrary pick, so a shared email never misresolves into the wrong
      // tenant's account (or locks a legitimate user out of their own).
      const candidates = await prisma.user.findMany({ where: { email: body.email, active: true } });
      let user: (typeof candidates)[number] | null = null;
      for (const candidate of candidates) {
        if (await argon2.verify(candidate.passwordHash, body.password)) {
          user = candidate;
          break;
        }
      }
      if (!user) {
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

  // A signed-in user changes their own password, proving it's them with either
  // their current password or -- if they've forgotten it -- a code from the
  // authenticator app enrolled at first login. Wrong answers return 400, not
  // 401: the frontend treats any 401 as "session expired" and logs the user out.
  // Rate-limited per user (not per IP) so a hijacked session can't brute-force
  // the 6-digit code.
  app.post(
    "/api/v1/auth/change-password",
    {
      preHandler: [
        app.authenticate,
        app.rateLimit({ max: 5, timeWindow: "15 minutes", keyGenerator: (req) => req.authUser?.id ?? req.ip }),
      ],
    },
    async (req, reply) => {
      const body = changePasswordSchema.parse(req.body);
      const user = await prisma.user.findFirst({
        where: { id: req.authUser.id, tenantId: req.authUser.homeTenantId, active: true },
      });
      if (!user) return reply.code(401).send({ error: "Unauthorized" });

      if (body.currentPassword) {
        if (!(await argon2.verify(user.passwordHash, body.currentPassword))) {
          return reply.code(400).send({ error: "Current password is incorrect" });
        }
      } else {
        if (!user.totpEnabled || !user.totpSecret) {
          return reply.code(400).send({ error: "Two-factor authentication isn't set up on this account — use your current password instead." });
        }
        if (!verifyTotpCode(decryptTotpSecret(user.totpSecret), body.totpCode!)) {
          return reply.code(400).send({ error: "Incorrect code — check your authenticator app and try again." });
        }
      }

      if (await argon2.verify(user.passwordHash, body.newPassword)) {
        return reply.code(400).send({ error: "New password must be different from your current password" });
      }

      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(body.newPassword) } });
      await logAudit({
        tenantId: user.tenantId,
        userId: user.id,
        objectType: "USER",
        recordId: user.id,
        action: "PASSWORD_CHANGED",
        newValues: { method: body.currentPassword ? "current_password" : "authenticator_code" },
      });

      return { success: true };
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
        company: companyFromEmail(user.email)?.name ?? null,
      },
      tenant: { id: tenant.id, name: tenant.name },
    };
  });
}
