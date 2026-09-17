import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let transporterInitAttempted = false;

function getTransporter() {
  if (transporterInitAttempted) return transporter;
  transporterInitAttempted = true;

  if (!process.env.SMTP_HOST) {
    // eslint-disable-next-line no-console
    console.warn("[mailer] SMTP_HOST is not set — emails will be logged to the console instead of sent.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return transporter;
}

export async function sendMail(params: { to: string; subject: string; text: string; html?: string }) {
  const t = getTransporter();
  if (!t) {
    // eslint-disable-next-line no-console
    console.log(`\n[mailer] SMTP not configured — printing email instead:\nTo: ${params.to}\nSubject: ${params.subject}\n\n${params.text}\n`);
    return;
  }

  await t.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
  });
}
