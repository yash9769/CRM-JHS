import { useEffect, useRef, useState } from "react";
import { Search, Check, Plus, Loader2, X } from "lucide-react";
import { inputClass, inputStyle } from "./ui";

export interface RelationshipOption {
  id: string;
  label: string;
  sublabel?: string;
  ownerId?: string | null;
  ownerLabel?: string | null;
  accountId?: string | null;
  accountLabel?: string | null;
}

/**
 * Generic, tenant-safe, debounced async-search relationship picker.
 * Used for Account / Contact / Owner / Opportunity / Deal / Product pickers
 * everywhere in the app so we never load hundreds of rows into a <select>.
 */
export function RelationshipSelector({
  value,
  valueLabel,
  onChange,
  fetchOptions,
  placeholder = "Search…",
  createLabel,
  onCreateNew,
  disabled,
}: {
  value?: string | null;
  valueLabel?: string | null;
  onChange: (id: string | null, option?: RelationshipOption) => void;
  fetchOptions: (search: string) => Promise<RelationshipOption[]>;
  placeholder?: string;
  createLabel?: string;
  onCreateNew?: (searchTerm: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<RelationshipOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchOptions(query);
        setOptions(results);
        setHighlight(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, open]);

  function selectOption(opt: RelationshipOption) {
    onChange(opt.id, opt);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    const total = options.length + (onCreateNew ? 1 : 0);
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight < options.length) selectOption(options[highlight]);
      else if (onCreateNew) { onCreateNew(query); setOpen(false); }
    } else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="relative" ref={containerRef}>
      {value && valueLabel && !open ? (
        <div
          className={`${inputClass} flex items-center justify-between cursor-pointer`}
          style={inputStyle}
          onClick={() => !disabled && setOpen(true)}
        >
          <span className="flex items-center gap-1.5 truncate"><Check size={13} style={{ color: "var(--ledger-600)" }} /> {valueLabel}</span>
          {!disabled && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); }} className="shrink-0">
              <X size={13} style={{ color: "var(--ink-400)" }} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
          <input
            disabled={disabled}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`${inputClass} pl-8`}
            style={inputStyle}
          />
        </div>
      )}

      {open && (
        <div className="absolute z-40 mt-1 w-full rounded-md border shadow-lg bg-white max-h-64 overflow-y-auto" style={{ borderColor: "var(--ink-200)" }}>
          {loading ? (
            <div className="px-3 py-3 text-sm flex items-center gap-2" style={{ color: "var(--ink-400)" }}>
              <Loader2 size={13} className="animate-spin" /> Searching…
            </div>
          ) : options.length === 0 && !onCreateNew ? (
            <div className="px-3 py-3 text-sm" style={{ color: "var(--ink-400)" }}>No results</div>
          ) : (
            <>
              {options.length === 0 && (
                <div className="px-3 py-2.5 text-sm" style={{ color: "var(--ink-400)" }}>No matches{query ? ` for "${query}"` : ""}</div>
              )}
              {options.map((opt, i) => (
                <button
                  type="button"
                  key={opt.id}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => selectOption(opt)}
                  className="w-full text-left px-3 py-2 text-sm flex flex-col"
                  style={{ background: highlight === i ? "var(--ink-50)" : "transparent" }}
                >
                  <span className="font-medium">{opt.label}</span>
                  {opt.sublabel && <span className="text-xs" style={{ color: "var(--ink-400)" }}>{opt.sublabel}</span>}
                </button>
              ))}
              {onCreateNew && (
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(options.length)}
                  onClick={() => { onCreateNew(query); setOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-1.5 border-t font-medium"
                  style={{ borderColor: "var(--ink-100)", color: "var(--ledger-700)", background: highlight === options.length ? "var(--ink-50)" : "transparent" }}
                >
                  <Plus size={13} /> {createLabel || `Create new${query ? ` "${query}"` : ""}`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
