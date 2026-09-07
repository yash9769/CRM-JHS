import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Bookmark, Plus, X } from "lucide-react";

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, any>;
  columns?: string[] | null;
}

export function SavedViewsBar<F extends Record<string, any>>({
  objectType,
  currentFilters,
  onApply,
  currentColumns,
  onApplyColumns,
}: {
  objectType: "LEAD" | "ACCOUNT" | "CONTACT" | "OPPORTUNITY";
  currentFilters: F;
  onApply: (filters: F) => void;
  /** Current column order (visible + hidden keys, in display order) -- saved/restored alongside filters when provided. */
  currentColumns?: string[];
  onApplyColumns?: (columns: string[]) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const { data } = useQuery<{ data: SavedView[] }>({
    queryKey: ["saved-views", objectType],
    queryFn: async () => (await api.get("/saved-views", { params: { objectType } })).data,
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/saved-views", { objectType, name, filters: currentFilters, columns: currentColumns }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-views", objectType] }); setSaving(false); setName(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/saved-views/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views", objectType] }),
  });

  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {data?.data.map((v) => {
        const isActive = activeViewId === v.id;
        return (
          <div
            key={v.id}
            onClick={() => {
              setActiveViewId(v.id);
              onApply(v.filters as F);
              if (v.columns && v.columns.length > 0) onApplyColumns?.(v.columns);
            }}
            className={`group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium cursor-pointer transition-all border select-none ${
              isActive
                ? "bg-[var(--ledger-50)] text-[var(--ledger-800)] border-[var(--ledger-400)] shadow-xs"
                : "bg-white text-[var(--ink-700)] border-[var(--ink-200)] hover:bg-[var(--ink-50)] hover:border-[var(--ink-300)]"
            }`}
          >
            <Bookmark
              size={12}
              className={isActive ? "fill-[var(--ledger-600)] text-[var(--ledger-600)]" : "text-[var(--ink-400)]"}
            />
            <span>{v.name}</span>
            <button
              type="button"
              title="Delete saved view"
              onClick={(e) => {
                e.stopPropagation();
                if (activeViewId === v.id) setActiveViewId(null);
                deleteMutation.mutate(v.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-600 p-0.5 rounded transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {saving ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) saveMutation.mutate(); if (e.key === "Escape") setSaving(false); }}
            placeholder="View name…"
            className="px-2 py-1 rounded-full text-xs border"
            style={{ borderColor: "var(--ink-200)", width: 120 }}
          />
          <button onClick={() => name.trim() && saveMutation.mutate()} className="text-xs font-medium" style={{ color: "var(--ledger-700)" }}>Save</button>
        </div>
      ) : (
        <button onClick={() => setSaving(true)} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style={{ color: "var(--ink-500)" }}>
          <Plus size={11} /> Save view
        </button>
      )}
    </div>
  );
}
