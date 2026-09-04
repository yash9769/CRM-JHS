import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, EmptyState, inputClass, inputStyle } from "../components/ui";
import { NewLeadModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { BulkActionBar, SelectAllCheckbox, RowCheckbox } from "../components/BulkActionBar";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { SavedViewsBar } from "../components/SavedViewsBar";
import { fetchOwnerOptions } from "../lib/pickers";
import { initials, relativeTime } from "../lib/format";
import type { Lead, Paginated, LeadStatus } from "../lib/types";
import { Plus, Search, Archive, UploadCloud, Download } from "lucide-react";

const STATUSES: (LeadStatus | "ALL")[] = ["ALL", "NEW", "CONTACTED", "QUALIFIED", "NURTURING", "UNQUALIFIED", "CONVERTED"];

const statusTone: Record<string, "neutral" | "green" | "amber" | "rose"> = {
  NEW: "neutral", CONTACTED: "amber", QUALIFIED: "green", NURTURING: "amber", UNQUALIFIED: "rose", CONVERTED: "green",
};

export default function LeadsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(LeadStatus | "ALL")>("ALL");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwnerPicker, setBulkOwnerPicker] = useState(false);
  const [bulkOwnerId, setBulkOwnerId] = useState<string | null>(null);
  const [bulkOwnerLabel, setBulkOwnerLabel] = useState<string | null>(null);
  const [bulkStatusPicker, setBulkStatusPicker] = useState(false);

  const { data, isLoading } = useQuery<Paginated<Lead>>({
    queryKey: ["leads", search, status],
    queryFn: async () => (await api.get("/leads", { params: { search, pageSize: 50, ...(status !== "ALL" ? { status } : {}) } })).data,
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: any) => api.post("/leads/bulk", { ids: Array.from(selected), ...payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setSelected(new Set()); setBulkOwnerPicker(false); setBulkStatusPicker(false); },
  });

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(data?.data.map((l) => l.id) || []) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  const allChecked = !!data?.data.length && data.data.every((l) => selected.has(l.id));
  const someChecked = data?.data.some((l) => selected.has(l.id)) && !allChecked;

  async function exportCsv() {
    await downloadCsvExport(
      "/leads/export",
      { search, ...(status !== "ALL" ? { status } : {}) },
      "leads.csv"
    );
  }

  return (
    <div>
      <PageHeader
        title="Leads"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Lead
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="leads" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads…" className={`${inputClass} pl-8`} style={inputStyle} />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap"
                style={{ background: status === s ? "var(--ledger-700)" : "var(--ink-50)", color: status === s ? "white" : "var(--ink-600)" }}
              >
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase().replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <SavedViewsBar
            objectType="LEAD"
            currentFilters={{ search, status }}
            onApply={(f) => { setSearch(f.search || ""); setStatus(f.status || "ALL"); }}
          />
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No leads yet"
              subtitle="Capture a new prospect even if all you have is a name and a phone number."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> Create Lead</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                <th className="px-4 py-2.5 w-8"><SelectAllCheckbox checked={allChecked} indeterminate={!!someChecked} onChange={toggleAll} /></th>
                {["Name", "Company", "Phone / Email", "Source", "Score", "Owner", "Status", "Created"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.data.map((l) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3"><RowCheckbox checked={selected.has(l.id)} onChange={(v) => toggleOne(l.id, v)} /></td>
                    <td className="px-4 py-3">
                      <Link to={`/leads/${l.id}`} className="flex items-center gap-2.5 font-medium">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: "var(--ink-600)" }}>{initials(l.firstName, l.lastName)}</div>
                        {l.firstName} {l.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{l.companyName || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{l.phone || l.email || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{l.source || "—"}</td>
                    <td className="px-4 py-3 font-mono-num">{l.score}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{l.owner ? `${l.owner.firstName} ${l.owner.lastName}` : "—"}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone[l.status]}>{l.status.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{relativeTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewLeadModal onClose={() => setShowNew(false)} />}
      {showImport && <CsvImportModal entity="leads" onClose={() => setShowImport(false)} />}

      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="secondary" onClick={() => setBulkOwnerPicker(true)}>Assign Owner</Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkStatusPicker(true)}>Change Status</Button>
        <Button size="sm" variant="danger" onClick={() => bulkMutation.mutate({ action: "archive" })} disabled={bulkMutation.isPending}><Archive size={13} /> Archive</Button>
      </BulkActionBar>

      {bulkOwnerPicker && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white" style={{ borderColor: "var(--ink-100)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>Assign {selected.size} lead(s) to</div>
          <RelationshipSelector
            value={bulkOwnerId} valueLabel={bulkOwnerLabel}
            onChange={(id, opt) => { setBulkOwnerId(id); setBulkOwnerLabel(opt?.label || null); }}
            fetchOptions={fetchOwnerOptions}
            placeholder="Search owner…"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkOwnerPicker(false)}>Cancel</Button>
            <Button size="sm" disabled={!bulkOwnerId || bulkMutation.isPending} onClick={() => bulkMutation.mutate({ action: "assignOwner", ownerId: bulkOwnerId })}>Apply</Button>
          </div>
        </div>
      )}

      {bulkStatusPicker && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-64 p-3 rounded-lg border shadow-xl bg-white" style={{ borderColor: "var(--ink-100)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>Change status for {selected.size} lead(s)</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.filter((s) => s !== "ALL").map((s) => (
              <button
                key={s}
                onClick={() => bulkMutation.mutate({ action: "changeStatus", status: s })}
                disabled={bulkMutation.isPending}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ background: "var(--ink-50)", color: "var(--ink-700)" }}
              >
                {s.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
