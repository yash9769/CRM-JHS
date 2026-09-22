// Minimal, dependency-free CSV writer — good enough for CRM record exports.
export function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    let s = String(val);
    // Neutralize CSV formula injection: a value starting with =, +, -, @, or a tab/CR
    // is interpreted as a formula by Excel/Sheets when the file is opened. User-entered
    // fields (opportunity/quote names, descriptions, etc.) flow into these exports, so
    // prefix with a leading apostrophe to force plain-text interpretation.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  // Excel opens a .csv with no encoding marker as Windows-1252, not UTF-8, and
  // garbles any non-ASCII byte sequence into mojibake (e.g. an em dash "—"
  // becomes "â€"") -- a leading UTF-8 BOM tells it to read the file correctly.
  // Every other consumer (other spreadsheet apps, csv-parsers, a browser
  // fetch) either recognizes and strips the BOM or ignores it harmlessly.
  return "﻿" + [header, ...lines].join("\n");
}
