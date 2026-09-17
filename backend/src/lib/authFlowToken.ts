import crypto from "node:crypto";

// Short-lived tokens for the two intermediate steps of login (TOTP setup and TOTP
// challenge) between "password verified" and "session issued". Deliberately NOT
// signed with the same secret/mechanism as the real session JWT (@fastify/jwt in
// plugins/auth.ts): these tokens must never be usable as a bearer session token,
// even by accident, so they're a completely separate HMAC scheme that the
// `authenticate` decorator has no path to accept.
export type FlowTokenPurpose = "totp_setup" | "totp_challenge";

interface FlowTokenPayload {
  purpose: FlowTokenPurpose;
  userId: string;
  exp: number;
}

function flowSecret(): string {
  return process.env.TOTP_FLOW_SECRET || `${process.env.JWT_SECRET || "dev-secret-change-in-production"}::totp-flow`;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", flowSecret()).update(data).digest("base64url");
}

export function signFlowToken(purpose: FlowTokenPurpose, userId: string, ttlSeconds = 600): string {
  const payload: FlowTokenPayload = { purpose, userId, exp: Date.now() + ttlSeconds * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyFlowToken(token: string, expectedPurpose: FlowTokenPurpose): { userId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expectedSig = sign(body);
  if (signature.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  let payload: FlowTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.purpose !== expectedPurpose) return null;
  if (Date.now() > payload.exp) return null;
  return { userId: payload.userId };
}
