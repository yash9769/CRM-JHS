import { useState, useEffect, useRef } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Button } from "./ui";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
  permanent?: boolean; // Cannot be hidden (e.g. primary Name column or checkboxes)
}

export function useColumnVisibility(pageKey: string, columns: ColumnDef[]) {
  const storageKey = `crm_cols_${pageKey}`;

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validKeys = parsed.filter((k: string) => columns.some((c) => c.key === k));
          if (validKeys.length > 0) {
            return new Set(validKeys);
          }
        }
      }
    } catch {
      // ignore
    }
    return new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key));
  });

  useEffect(() => {
    if (columns.length > 0) {
      setVisibleKeys((prev) => {
        const next = new Set<string>();
        let changed = false;
        // Keep valid previous keys
        prev.forEach((k) => {
          if (columns.some((c) => c.key === k)) {
            next.add(k);
          } else {
            changed = true;
          }
        });
        // Add default visible keys
        columns.forEach((c) => {
          if (!next.has(c.key) && c.defaultVisible !== false) {
            next.add(c.key);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(visibleKeys)));
    } catch {
      // ignore
    }
  }, [storageKey, visibleKeys]);

  function toggle(key: string) {
    const col = columns.find((c) => c.key === key);
    if (col?.permanent) return; // cannot hide permanent column
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        // Keep at least 1 column visible
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function showAll() {
    setVisibleKeys(new Set(columns.map((c) => c.key)));
  }

  function reset() {
    setVisibleKeys(new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key)));
  }

  function isVisible(key: string): boolean {
    const col = columns.find((c) => c.key === key);
    if (col?.permanent) return true;
    return visibleKeys.has(key);
  }

  return {
    visibleKeys,
    toggle,
    showAll,
    reset,
    isVisible,
  };
}

export function ColumnFilterDropdown({
  columns,
  visibleKeys,
  onToggle,
  onShowAll,
  onReset,
  label = "Columns",
}: {
  columns: ColumnDef[];
  visibleKeys: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
  onReset: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const configurableCols = columns.filter((c) => !c.permanent);
  const visibleCount = columns.filter((c) => c.permanent || visibleKeys.has(c.key)).length;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <Button
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs"
      >
        <SlidersHorizontal size={13} style={{ color: "var(--ink-500)" }} />
        <span>{label}</span>
        <span
          className="ml-0.5 px-1.5 py-0.2 text-[10px] font-semibold rounded-full"
          style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}
        >
          {visibleCount}/{columns.length}
        </span>
      </Button>

      {open && (
        <div
          className="absolute right-0 mt-1.5 w-60 rounded-xl border shadow-xl bg-white z-50 p-2 text-xs"
          style={{ borderColor: "var(--ink-100)" }}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b mb-1" style={{ borderColor: "var(--ink-100)" }}>
            <span className="font-semibold" style={{ color: "var(--ink-800)" }}>
              Visible Columns
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onShowAll}
                className="text-[11px] hover:underline"
                style={{ color: "var(--ledger-600)" }}
              >
                All
              </button>
              <span style={{ color: "var(--ink-300)" }}>·</span>
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] flex items-center gap-0.5 hover:underline"
                style={{ color: "var(--ink-500)" }}
                title="Reset to default"
              >
                <RotateCcw size={10} /> Reset
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5 py-1">
            {configurableCols.map((col) => {
              const active = visibleKeys.has(col.key);
              return (
                <label
                  key={col.key}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-[var(--ink-50)] cursor-pointer select-none"
                  style={{ color: "var(--ink-700)" }}
                >
                  <span className="font-medium">{col.label}</span>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => onToggle(col.key)}
                    className="rounded border-gray-300 text-[var(--ledger-600)] focus:ring-0 cursor-pointer w-3.5 h-3.5"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
