/**
 * Curated list of country dial codes for the phone-number dropdown.
 * Not exhaustive (195 countries) -- covers the markets this CRM's tenants
 * actually operate in, with India first as the default. Add more here as
 * needed; nothing else needs to change.
 */
export interface PhoneCountry {
  code: string; // dial code, e.g. "+91"
  iso: string; // ISO 3166-1 alpha-2
  name: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "+93", iso: "AF", name: "Afghanistan" },
  { code: "+355", iso: "AL", name: "Albania" },
  { code: "+213", iso: "DZ", name: "Algeria" },
  { code: "+54", iso: "AR", name: "Argentina" },
  { code: "+374", iso: "AM", name: "Armenia" },
  { code: "+61", iso: "AU", name: "Australia" },
  { code: "+43", iso: "AT", name: "Austria" },
  { code: "+973", iso: "BH", name: "Bahrain" },
  { code: "+880", iso: "BD", name: "Bangladesh" },
  { code: "+32", iso: "BE", name: "Belgium" },
  { code: "+55", iso: "BR", name: "Brazil" },
  { code: "+1", iso: "CA", name: "Canada" },
  { code: "+56", iso: "CL", name: "Chile" },
  { code: "+86", iso: "CN", name: "China" },
  { code: "+57", iso: "CO", name: "Colombia" },
  { code: "+420", iso: "CZ", name: "Czech Republic" },
  { code: "+45", iso: "DK", name: "Denmark" },
  { code: "+20", iso: "EG", name: "Egypt" },
  { code: "+358", iso: "FI", name: "Finland" },
  { code: "+33", iso: "FR", name: "France" },
  { code: "+49", iso: "DE", name: "Germany" },
  { code: "+30", iso: "GR", name: "Greece" },
  { code: "+852", iso: "HK", name: "Hong Kong" },
  { code: "+36", iso: "HU", name: "Hungary" },
  { code: "+91", iso: "IN", name: "India" },
  { code: "+62", iso: "ID", name: "Indonesia" },
  { code: "+353", iso: "IE", name: "Ireland" },
  { code: "+972", iso: "IL", name: "Israel" },
  { code: "+39", iso: "IT", name: "Italy" },
  { code: "+81", iso: "JP", name: "Japan" },
  { code: "+254", iso: "KE", name: "Kenya" },
  { code: "+965", iso: "KW", name: "Kuwait" },
  { code: "+60", iso: "MY", name: "Malaysia" },
  { code: "+52", iso: "MX", name: "Mexico" },
  { code: "+31", iso: "NL", name: "Netherlands" },
  { code: "+64", iso: "NZ", name: "New Zealand" },
  { code: "+234", iso: "NG", name: "Nigeria" },
  { code: "+47", iso: "NO", name: "Norway" },
  { code: "+968", iso: "OM", name: "Oman" },
  { code: "+92", iso: "PK", name: "Pakistan" },
  { code: "+507", iso: "PA", name: "Panama" },
  { code: "+51", iso: "PE", name: "Peru" },
  { code: "+63", iso: "PH", name: "Philippines" },
  { code: "+48", iso: "PL", name: "Poland" },
  { code: "+351", iso: "PT", name: "Portugal" },
  { code: "+974", iso: "QA", name: "Qatar" },
  { code: "+40", iso: "RO", name: "Romania" },
  { code: "+7", iso: "RU", name: "Russia" },
  { code: "+966", iso: "SA", name: "Saudi Arabia" },
  { code: "+65", iso: "SG", name: "Singapore" },
  { code: "+27", iso: "ZA", name: "South Africa" },
  { code: "+82", iso: "KR", name: "South Korea" },
  { code: "+34", iso: "ES", name: "Spain" },
  { code: "+94", iso: "LK", name: "Sri Lanka" },
  { code: "+46", iso: "SE", name: "Sweden" },
  { code: "+41", iso: "CH", name: "Switzerland" },
  { code: "+886", iso: "TW", name: "Taiwan" },
  { code: "+66", iso: "TH", name: "Thailand" },
  { code: "+90", iso: "TR", name: "Turkey" },
  { code: "+971", iso: "AE", name: "UAE" },
  { code: "+44", iso: "GB", name: "United Kingdom" },
  { code: "+1", iso: "US", name: "United States" },
  { code: "+84", iso: "VN", name: "Vietnam" },
];

export const DEFAULT_COUNTRY_CODE = "+91";

/** Mobile numbers must be exactly 10 digits. */
export function isValidMobileNumber(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  return digits.length === 10;
}

/** Landline numbers accept 7 to 12 digits. */
export function isValidLandlineNumber(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 12;
}

/** A local phone or landline number validation based on type/label. */
export function isValidLocalNumber(number: string, isLandline: boolean = false): boolean {
  return isLandline ? isValidLandlineNumber(number) : isValidMobileNumber(number);
}

