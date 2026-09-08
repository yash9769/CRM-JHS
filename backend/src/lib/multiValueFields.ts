import { z } from "zod";
import { isValidLocalNumber } from "./phoneCountries.js";

/**
 * Shared validation + sync logic for the repeatable "multiple emails" /
 * "multiple phone numbers" fields on Account and Contact. Both entities
 * keep their original single `email`/`phone` scalar column (read by
 * search, CSV export, and duplicate-detection elsewhere) as a mirror of
 * whichever entry here is marked primary -- so none of that existing code
 * had to change.
 */

export const emailEntrySchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  label: z.string().trim().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const phoneEntrySchema = z.object({
  countryCode: z.string().trim().min(1, "Select a country code"),
  number: z
    .string()
    .trim()
    .refine(isValidLocalNumber, "Phone number must be exactly 10 digits"),
  label: z.string().trim().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export const emailListSchema = z.array(emailEntrySchema).max(10).optional();
export const phoneListSchema = z.array(phoneEntrySchema).max(10).optional();

export type EmailEntry = z.infer<typeof emailEntrySchema>;
export type PhoneEntry = z.infer<typeof phoneEntrySchema>;

/** Picks the primary entry (or the first, if none flagged) for the legacy scalar mirror. */
export function primaryEmail(entries: EmailEntry[] | undefined): string | null {
  if (!entries || entries.length === 0) return null;
  return (entries.find((e) => e.isPrimary) || entries[0]).email;
}

export function primaryPhoneString(entries: PhoneEntry[] | undefined): string | null {
  if (!entries || entries.length === 0) return null;
  const p = entries.find((e) => e.isPrimary) || entries[0];
  return `${p.countryCode}${p.number}`;
}

/** Ensures exactly one entry is flagged primary (the first, if none/multiple are). */
export function normalizePrimary<T extends { isPrimary?: boolean }>(entries: T[]): T[] {
  if (entries.length === 0) return entries;
  const hasPrimary = entries.some((e) => e.isPrimary);
  return entries.map((e, i) => ({ ...e, isPrimary: hasPrimary ? !!e.isPrimary : i === 0 }));
}
