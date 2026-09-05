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
  return [header, ...lines].join("\n");
}
