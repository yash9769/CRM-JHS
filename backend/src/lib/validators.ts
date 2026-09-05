import { z } from "zod";

/**
 * Permissive international phone format: optional leading +, 7-15 digits,
 * with spaces/hyphens/parens allowed as separators. Rejects letters and
 * other symbols while not forcing a single country's format.
 */
const PHONE_REGEX = /^\+?[0-9](?:[0-9\s\-().]{5,17})?[0-9]$/;

export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE_REGEX, "Enter a valid phone number (digits only, optional + country code)")
  .refine((v) => v.replace(/\D/g, "").length >= 7 && v.replace(/\D/g, "").length <= 15, {
    message: "Phone number must have between 7 and 15 digits",
  })
  .optional()
  .nullable()
  .or(z.literal(""));

/** Real names: letters (incl. accented), spaces, hyphens, apostrophes; at least 2 letters. */
const NAME_REGEX = /^[\p{L}][\p{L}\s'-]*[\p{L}]$|^[\p{L}]{2,}$/u;

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .regex(NAME_REGEX, "Must contain only letters, spaces, hyphens or apostrophes");

/** Monetary/numeric value that must never be negative. */
export const nonNegativeAmountSchema = (label: string) =>
  z.number({ invalid_type_error: `${label} must be a number` }).nonnegative(`${label} must be non-negative`);
