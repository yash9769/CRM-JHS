// Works out which company a user belongs to from their email address, so the
// workspace can show "JHS Associates" for aditya@jhsassociates.in and
// "Envista Cyber Defence" for prajhot@envistacyberdefence.com even though both
// live in the same tenant.
//
// Domains can't be reliably split into words ("envistacyberdefence"), so the
// proper display name for each of our own domains is listed here. Any other
// domain falls back to a tidied-up version of its name ("acme-corp.com" ->
// "Acme Corp"). To add a company, add its domain to KNOWN_COMPANIES.
const KNOWN_COMPANIES: Record<string, string> = {
  "jhsassociates.in": "JHS Associates",
  "jhsconsulting.in": "JHS Consulting",
  "envistacyberdefence.com": "Envista Cyber Defence",
};

// Personal mailboxes say nothing about the user's company.
const PERSONAL_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "yahoo.co.in", "outlook.com",
  "hotmail.com", "live.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "aol.com",
  "rediffmail.com", "zoho.com",
]);

// "acme.co.in" has the company name before "co.in", not before "in".
const SECOND_LEVEL_LABELS = new Set(["co", "com", "org", "net", "gov", "ac", "edu"]);

function titleCase(label: string): string {
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function companyFromEmail(email: string | null | undefined): { name: string; domain: string } | null {
  const at = (email ?? "").lastIndexOf("@");
  if (at < 1) return null;
  const domain = (email as string).slice(at + 1).trim().toLowerCase();
  if (!domain.includes(".") || PERSONAL_MAIL_DOMAINS.has(domain)) return null;

  const known = Object.keys(KNOWN_COMPANIES).find((d) => domain === d || domain.endsWith(`.${d}`));
  if (known) return { name: KNOWN_COMPANIES[known], domain: known };

  const labels = domain.split(".");
  const tld = labels[labels.length - 1];
  const isTwoPartSuffix = labels.length >= 3 && tld.length === 2 && SECOND_LEVEL_LABELS.has(labels[labels.length - 2]);
  const nameLabel = labels[labels.length - (isTwoPartSuffix ? 3 : 2)];
  return nameLabel ? { name: titleCase(nameLabel), domain } : null;
}
