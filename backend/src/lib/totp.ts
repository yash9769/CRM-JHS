import crypto from "node:crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const ISSUER = process.env.TOTP_ISSUER || "Envista CRM";

// TOTP secrets are as sensitive as passwords (anyone with the secret can generate
// valid codes forever) so they're encrypted at rest with AES-256-GCM rather than
// stored as plaintext. Falls back to deriving a key from JWT_SECRET so this works
// out of the box in dev; set TOTP_ENC_KEY explicitly in production.
function encryptionKey(): Buffer {
  const raw = process.env.TOTP_ENC_KEY || process.env.JWT_SECRET || "dev-secret-change-in-production";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".");
}

export function decryptTotpSecret(payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(".");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

export function totpOtpauthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export async function totpQrCodeDataUrl(otpauthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  return authenticator.check(code, secret);
}

export const TOTP_REVERIFY_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export function needsTotpChallenge(totpVerifiedAt: Date | null): boolean {
  if (!totpVerifiedAt) return true;
  return Date.now() - totpVerifiedAt.getTime() > TOTP_REVERIFY_INTERVAL_MS;
}
