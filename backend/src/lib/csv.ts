// Minimal, dependency-free CSV writer — good enough for CRM record exports.
export function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const escape = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(","));
  return [header, ...lines].join("\n");
}
