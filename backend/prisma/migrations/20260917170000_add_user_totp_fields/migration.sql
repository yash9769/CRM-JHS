-- Adds mandatory TOTP (RFC 6238) two-factor auth fields to users. All three columns
-- are nullable/defaulted so this is a pure additive change: every existing row gets
-- totpEnabled = false and totpSecret/totpVerifiedAt = NULL, which the new login flow
-- treats as "must enroll on next login" — no data loss, no backfill required.

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "totpVerifiedAt" TIMESTAMP(3);
