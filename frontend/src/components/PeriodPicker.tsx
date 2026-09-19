import { useState } from "react";

export type PeriodGranularity = "MONTH" | "QUARTER" | "YEAR";

function currentMonthValue(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Shared state for a Monthly / Quarterly / Yearly period selector. Produces
 * a single `period` string in one of three formats the backend understands
 * everywhere a period query param is accepted: "YYYY-MM", "YYYY-Qn", "YYYY".
 */
export function usePeriodPicker(initialGranularity: PeriodGranularity = "MONTH") {
  const [granularity, setGranularity] = useState<PeriodGranularity>(initialGranularity);
  const [month, setMonth] = useState(currentMonthValue());
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState(() => `Q${Math.floor(new Date().getMonth() / 3) + 1}`);

  const period =
    granularity === "YEAR" ? year
    : granularity === "QUARTER" ? `${year}-${quarter}`
    : month;

  return { granularity, setGranularity, month, setMonth, year, setYear, quarter, setQuarter, period };
}

/** Human label for any of the three period formats ("YYYY-MM", "YYYY-Qn", "YYYY"). */
export function periodDisplayLabel(p: string): string {
  const quarterMatch = p.match(/^(\d{4})-Q([1-4])$/);
  if (quarterMatch) return `Q${quarterMatch[2]} ${quarterMatch[1]}`;
  if (/^\d{4}$/.test(p)) return p;
  const monthMatch = p.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const [, y, m] = monthMatch;
    return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "short", year: "numeric" });
  }
  return p;
}

const selectClass = "text-sm px-2 py-1.5 rounded-md border bg-white font-medium";
const selectStyle = { borderColor: "var(--ink-200)" };

/**
 * Renders the granularity dropdown plus whichever sub-picker matches it
 * (a month input, or quarter+year selects, or a year select). Drop this
 * next to any control that currently only supports a single month.
 */
export function PeriodPicker({ state, label }: { state: ReturnType<typeof usePeriodPicker>; label?: string }) {
  // Last 5 years ending at the current year -- a reporting/target picker has
  // no business offering years that haven't happened yet.
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 4 + i);
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && <span className="text-xs font-medium text-[var(--ink-500)]">{label}</span>}
      <select
        value={state.granularity}
        onChange={(e) => state.setGranularity(e.target.value as PeriodGranularity)}
        className={selectClass}
        style={selectStyle}
      >
        <option value="MONTH">Monthly</option>
        <option value="QUARTER">Quarterly</option>
        <option value="YEAR">Yearly</option>
      </select>
      {state.granularity === "MONTH" && (
        <input
          type="month"
          value={state.month}
          onChange={(e) => state.setMonth(e.target.value)}
          className={selectClass}
          style={selectStyle}
        />
      )}
      {state.granularity === "QUARTER" && (
        <>
          <select value={state.quarter} onChange={(e) => state.setQuarter(e.target.value)} className={selectClass} style={selectStyle}>
            {["Q1", "Q2", "Q3", "Q4"].map((q) => <option key={q} value={q}>{q}</option>)}
          </select>
          <select value={state.year} onChange={(e) => state.setYear(e.target.value)} className={selectClass} style={selectStyle}>
            {yearOptions.map((y) => <option key={y} value={y.toString()}>{y}</option>)}
          </select>
        </>
      )}
      {state.granularity === "YEAR" && (
        <select value={state.year} onChange={(e) => state.setYear(e.target.value)} className={selectClass} style={selectStyle}>
          {yearOptions.map((y) => <option key={y} value={y.toString()}>{y}</option>)}
        </select>
      )}
    </div>
  );
}
