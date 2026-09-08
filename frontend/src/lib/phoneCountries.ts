/**
 * Curated list of country dial codes for the phone-number dropdown.
 * Kept in sync with backend/src/lib/phoneCountries.ts -- not exhaustive
 * (195 countries), just the markets this CRM's tenants actually operate in,
 * with India first as the default.
 */
export interface PhoneCountry {
  code: string; // dial code, e.g. "+91"
  iso: string;
  name: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "+91", iso: "IN", name: "India" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+62", iso: "ID", name: "Indonesia" },
];

export const DEFAULT_COUNTRY_CODE = "+91";

export function isValidLocalNumber(number: string): boolean {
  return /^\d{7,12}$/.test(number);
}
