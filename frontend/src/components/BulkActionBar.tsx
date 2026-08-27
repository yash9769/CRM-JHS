import type { ReactNode } from "react";
import { X } from "lucide-react";

export function SelectAllCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      ref={(el) => { if (el) el.indeterminate = indeterminate; }}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 rounded"
    />
  );
}

export function RowCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => { e.stopPropagation(); onChange(e.target.checked); }}
      onClick={(e) => e.stopPropagation()}
      className="w-4 h-4 rounded"
    />
  );
}

export function BulkActionBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-4 py-2.5 rounded-full shadow-xl"
      style={{ background: "var(--ink-950)", color: "white" }}
    >
      <button onClick={onClear} className="flex items-center gap-1.5 text-sm font-medium pr-3 border-r" style={{ borderColor: "var(--ink-700)" }}>
        <X size={14} /> {count} selected
      </button>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
