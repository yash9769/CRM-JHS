// Admin-only way to provision a new user. There is no public sign-up — this script
// is the only path onto the platform. It generates a random password, creates the
// user (TOTP not yet enrolled — they'll set it up on first login), and emails them
// their credentials and the sign-in link.
//
// Usage:
//   npx tsx scripts/createUser.ts \
//     --email jane@company.com --firstName Jane --lastName Doe \
//     --role PARTNER --tenant "Envista Cyber Defence"
//
// --role is one of SENIOR_PARTNER | PARTNER | MANAGER (default MANAGER).
// --partnerEmail is required when --role MANAGER and the tenant has more than one
// Partner, to say which Partner this Manager reports to.
// --tenant selects a tenant by name; omit it if the database only has one tenant.
import crypto from "node:crypto";
import argon2 from "argon2";
import { PrismaClient, type OrgRole } from "@prisma/client";
import { sendMail } from "../src/lib/mailer.js";

const prisma = new PrismaClient();

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

function generatePassword(): string {
  // 20 random bytes -> base64url is comfortably long, avoids ambiguous characters
  // better than most "readable password" generators, and needs no wordlist.
  return crypto.randomBytes(20).toString("base64url");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email?.trim().toLowerCase();
  const firstName = args.firstName?.trim();
  const lastName = args.lastName?.trim();
  const role = (args.role?.trim().toUpperCase() || "MANAGER") as OrgRole;

  if (!email || !firstName || !lastName) {
    console.error("Usage: npx tsx scripts/createUser.ts --email <email> --firstName <first> --lastName <last> [--role SENIOR_PARTNER|PARTNER|MANAGER] [--tenant <name>] [--partnerEmail <email>]");
    process.exitCode = 1;
    return;
  }
  if (!["SENIOR_PARTNER", "PARTNER", "MANAGER"].includes(role)) {
    console.error(`Invalid --role "${role}". Must be SENIOR_PARTNER, PARTNER, or MANAGER.`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.error(`A user with email ${email} already exists.`);
    process.exitCode = 1;
    return;
  }

  let tenant;
  if (args.tenant) {
    tenant = await prisma.tenant.findFirst({ where: { name: args.tenant } });
    if (!tenant) {
      console.error(`No tenant named "${args.tenant}" found.`);
      process.exitCode = 1;
      return;
    }
  } else {
    const tenants = await prisma.tenant.findMany();
    if (tenants.length === 0) {
      console.error("No tenant exists yet. Create one first (e.g. via prisma/seed.ts) before provisioning users.");
      process.exitCode = 1;
      return;
    }
    if (tenants.length > 1) {
      console.error(`Multiple tenants exist — pass --tenant "<name>" to pick one:\n${tenants.map((t) => `  - ${t.name}`).join("\n")}`);
      process.exitCode = 1;
      return;
    }
    tenant = tenants[0];
  }

  let partnerId: string | null = null;
  if (role === "MANAGER") {
    if (args.partnerEmail) {
      const partner = await prisma.user.findFirst({
        where: { email: args.partnerEmail.trim().toLowerCase(), tenantId: tenant.id, orgRole: "PARTNER" },
      });
      if (!partner) {
        console.error(`No Partner with email ${args.partnerEmail} found in tenant "${tenant.name}".`);
        process.exitCode = 1;
        return;
      }
      partnerId = partner.id;
    } else {
      const partners = await prisma.user.findMany({ where: { tenantId: tenant.id, orgRole: "PARTNER" } });
      if (partners.length === 1) {
        partnerId = partners[0].id;
      } else if (partners.length > 1) {
        console.error(`Multiple Partners exist in this tenant — pass --partnerEmail to pick which one this Manager reports to:\n${partners.map((p) => `  - ${p.email}`).join("\n")}`);
        process.exitCode = 1;
        return;
      }
      // Zero partners: leave partnerId null — same as an unassigned Manager created via the UI.
    }
  }

  const password = generatePassword();
  const passwordHash = await argon2.hash(password);

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email,
      firstName,
      lastName,
      orgRole: role,
      partnerId: role === "MANAGER" ? partnerId : null,
      passwordHash,
      // totpEnabled defaults to false — the user enrolls their authenticator app
      // on first login, per the flow in src/routes/auth.ts.
    },
  });

  const loginUrl = process.env.APP_LOGIN_URL || "http://localhost:5173/login";
  const subject = `Your ${tenant.name} CRM account`;
  const text = [
    `Hi ${firstName},`,
    ``,
    `An account has been created for you on the ${tenant.name} CRM.`,
    ``,
    `Email: ${email}`,
    `Temporary password: ${password}`,
    ``,
    `Sign in here: ${loginUrl}`,
    ``,
    `On your first sign-in you'll be asked to set up an authenticator app (Google Authenticator, Authy, 1Password, etc.) — scan the QR code shown and enter the 6-digit code it gives you. You'll need to do this again every 7 days.`,
    ``,
    `Please sign in and change your password soon.`,
  ].join("\n");

  await sendMail({ to: email, subject, text });

  console.log(`Created ${role} ${firstName} ${lastName} <${email}> in tenant "${tenant.name}".`);
  console.log(`Credentials email sent (or printed above, if SMTP isn't configured).`);
  console.log(`User id: ${user.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
