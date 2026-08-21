import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Bookmark, Plus, X } from "lucide-react";

interface SavedView {
  id: string;
  name: string;
  filters: Record<string, any>;
}

export function SavedViewsBar<F extends Record<string, any>>({
  objectType,
  currentFilters,
  onApply,
}: {
  objectType: "LEAD" | "ACCOUNT" | "CONTACT" | "OPPORTUNITY" | "DEAL";
  currentFilters: F;
  onApply: (filters: F) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const { data } = useQuery<{ data: SavedView[] }>({
    queryKey: ["saved-views", objectType],
    queryFn: async () => (await api.get("/saved-views", { params: { objectType } })).data,
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/saved-views", { objectType, name, filters: currentFilters }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saved-views", objectType] }); setSaving(false); setName(""); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/saved-views/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["saved-views", objectType] }),
  });

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {data?.data.map((v) => (
        <div key={v.id} className="group flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full text-xs font-medium" style={{ background: "var(--ink-50)", color: "var(--ink-600)" }}>
          <button onClick={() => onApply(v.filters as F)} className="flex items-center gap-1">
            <Bookmark size={11} /> {v.name}
          </button>
          <button onClick={() => deleteMutation.mutate(v.id)} className="opacity-0 group-hover:opacity-100 p-0.5">
            <X size={11} />
          </button>
        </div>
      ))}
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
