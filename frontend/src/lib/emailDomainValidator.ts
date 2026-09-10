/**
 * Email & Domain Validation and Typo Suggestion Utility
 */

const COMMON_TYPOS: Record<string, string> = {
  "gnail.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmil.com": "gmail.com",
  "gmal.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoocom": "yahoo.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmali.com": "hotmail.com",
  "icould.com": "icloud.com",
};

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
}

export interface DomainValidationResult {
  isValid: boolean;
  error?: string;
  cleanedDomain?: string;
}

/**
 * Validates an email address and checks for common domain typos.
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || !email.trim()) {
    return { isValid: true };
  }

  const trimmed = email.trim();

  // Basic RFC 5322 pattern check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    if (!trimmed.includes("@")) {
      return { isValid: false, error: "Missing '@' in email address" };
    }
    const parts = trimmed.split("@");
    if (parts.length > 2) {
      return { isValid: false, error: "Multiple '@' symbols detected" };
    }
    if (!parts[1] || !parts[1].includes(".")) {
      return { isValid: false, error: "Email domain is missing extension (e.g. .com)" };
    }
    return { isValid: false, error: "Invalid email format" };
  }

  // Check for common typos
  const [user, domain] = trimmed.split("@");
  const lowerDomain = domain.toLowerCase();

  if (COMMON_TYPOS[lowerDomain]) {
    const suggestedDomain = COMMON_TYPOS[lowerDomain];
    return {
      isValid: true,
      suggestion: `${user}@${suggestedDomain}`,
    };
  }

  return { isValid: true };
}

/**
 * Cleans a domain string (strips http/https/www/path) and validates format.
 */
export function cleanDomain(domain: string): string {
  if (!domain) return "";
  let cleaned = domain.trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^www\./i, "");
  cleaned = cleaned.split("/")[0];
  cleaned = cleaned.split("?")[0];
  cleaned = cleaned.split("#")[0];
  return cleaned;
}

/**
 * Validates a domain name.
 */
export function validateDomain(domain: string): DomainValidationResult {
  if (!domain || !domain.trim()) {
    return { isValid: true };
  }

  const cleaned = cleanDomain(domain);
  const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!domainRegex.test(cleaned)) {
    if (!cleaned.includes(".")) {
      return { isValid: false, error: "Domain requires an extension (e.g. company.com)", cleanedDomain: cleaned };
    }
    if (cleaned.includes("..")) {
      return { isValid: false, error: "Domain contains consecutive dots ('..')", cleanedDomain: cleaned };
    }
    return { isValid: false, error: "Invalid domain format", cleanedDomain: cleaned };
  }

  return { isValid: true, cleanedDomain: cleaned };
}
