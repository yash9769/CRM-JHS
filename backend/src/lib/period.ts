/** Accepts "YYYY-MM" (monthly), "YYYY-Qn" (quarterly), or "YYYY" (yearly). */
export const PERIOD_REGEX = /^(\d{4})(?:-(\d{2})|-Q([1-4]))?$/;

export type PeriodGranularity = "MONTH" | "QUARTER" | "YEAR";

/** Parses any of the three period formats into a concrete UTC date range. */
export function parsePeriodRange(period: string): { start: Date; end: Date; granularity: PeriodGranularity } {
  const match = period.match(PERIOD_REGEX);
  if (!match) throw new Error(`Invalid period: ${period}`);
  const year = Number(match[1]);
  if (match[2]) {
    const month = Number(match[2]);
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
      granularity: "MONTH",
    };
  }
  if (match[3]) {
    const quarter = Number(match[3]);
    const startMonth = (quarter - 1) * 3;
    return {
      start: new Date(Date.UTC(year, startMonth, 1)),
      end: new Date(Date.UTC(year, startMonth + 3, 1)),
      granularity: "QUARTER",
    };
  }
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year + 1, 0, 1)),
    granularity: "YEAR",
  };
}

/** True if `period` is a bare year, e.g. "2026" (not "2026-01" or "2026-Q1"). */
export function isYearOnly(period: string): boolean {
  return /^\d{4}$/.test(period);
}

/** True if `period` is a quarter, e.g. "2026-Q1". */
export function isQuarter(period: string): boolean {
  return /^\d{4}-Q[1-4]$/.test(period);
}

/** Human label for any of the three period formats. */
export function periodDisplayLabel(period: string): string {
  const quarterMatch = period.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  if (isYearOnly(period)) return period;
  const monthMatch = period.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const [, y, m] = monthMatch;
    return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString("default", { month: "short", year: "numeric", timeZone: "UTC" });
  }
  return period;
}
