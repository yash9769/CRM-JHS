import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, StageBadge, Button, EmptyState, inputClass, inputStyle } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { NewDealModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { BulkActionBar, SelectAllCheckbox, RowCheckbox } from "../components/BulkActionBar";
import { fetchOwnerOptions } from "../lib/pickers";
import { formatCurrency, formatDate } from "../lib/format";
import type { Deal, Pipeline, Paginated } from "../lib/types";
import { LayoutGrid, List, Plus, Search, Archive, Download, UploadCloud } from "lucide-react";

const FORECAST_CATEGORIES = ["ALL", "PIPELINE", "BEST_CASE", "COMMIT", "CLOSED_WON", "CLOSED_LOST"] as const;

export default function DealsPage() {
  const [params] = useSearchParams();
  const wonOnly = params.get("won") === "true";
  const qc = useQueryClient();
  const [view, setView] = useState<"table" | "kanban">(wonOnly ? "table" : "kanban");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [forecastCategory, setForecastCategory] = useState<(typeof FORECAST_CATEGORIES)[number]>("ALL");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwnerPicker, setBulkOwnerPicker] = useState(false);
  const [bulkOwnerId, setBulkOwnerId] = useState<string | null>(null);
  const [bulkOwnerLabel, setBulkOwnerLabel] = useState<string | null>(null);
  const [bulkStagePicker, setBulkStagePicker] = useState(false);

  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({ queryKey: ["pipelines", "DEAL"], queryFn: async () => (await api.get("/pipelines", { params: { type: "DEAL" } })).data });
  const pipeline = pipelines?.data[0];

  const { data: deals, isLoading } = useQuery<Paginated<Deal>>({
    queryKey: ["deals", "list", pipeline?.id, search, forecastCategory, ownerId, wonOnly],
    queryFn: async () => (await api.get("/deals", {
      params: {
        pipelineId: pipeline?.id, pageSize: 100, search,
        ...(wonOnly ? { won: "true" } : {}),
        ...(forecastCategory !== "ALL" ? { forecastCategory } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
    })).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => api.patch(`/deals/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: any) => api.post("/deals/bulk", { ids: Array.from(selected), ...payload }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deals"] }); setSelected(new Set()); setBulkOwnerPicker(false); setBulkStagePicker(false); },
  });

  async function exportCsv() {
    await downloadCsvExport(
      "/deals/export",
      {
        pipelineId: pipeline?.id,
        search,
        ...(wonOnly ? { won: "true" } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      wonOnly ? "won_deals.csv" : "deals.csv"
    );
  }

  const displayed = wonOnly ? deals?.data.filter((d) => d.stage?.isClosed && d.stage.isWon) : deals?.data;

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(displayed?.map((d) => d.id) || []) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }
  const allChecked = !!displayed?.length && displayed.every((d) => selected.has(d.id));
  const someChecked = displayed?.some((d) => selected.has(d.id)) && !allChecked;

  return (
    <div>
      <PageHeader
        title={wonOnly ? "Won Deals" : "Deals"}
        subtitle={wonOnly ? "Everything your team has closed." : "Concrete sales commitments in progress."}
        action={
          <div className="flex items-center gap-2">
            {!wonOnly && (
              <div className="flex gap-1 rounded-md p-0.5" style={{ background: "var(--ink-100)" }}>
                <button onClick={() => setView("kanban")} className="p-1.5 rounded" style={{ background: view === "kanban" ? "white" : "transparent" }}><LayoutGrid size={15} /></button>
                <button onClick={() => setView("table")} className="p-1.5 rounded" style={{ background: view === "table" ? "white" : "transparent" }}><List size={15} /></button>
              </div>
            )}
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Deal
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="deals" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8">
        {!wonOnly && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search deals…" className={`${inputClass} pl-8`} style={inputStyle} />
            </div>
            <select value={forecastCategory} onChange={(e) => setForecastCategory(e.target.value as any)} className={inputClass} style={{ ...inputStyle, width: 190 }}>
              {FORECAST_CATEGORIES.map((c) => <option key={c} value={c}>{c === "ALL" ? "All forecast categories" : c.replace("_", " ")}</option>)}
            </select>
            <div className="w-52">
              <RelationshipSelector
                value={ownerId} valueLabel={ownerLabel}
                onChange={(id, opt) => { setOwnerId(id); setOwnerLabel(opt?.label || null); }}
                fetchOptions={fetchOwnerOptions}
                placeholder="Filter by owner…"
              />
            </div>
          </div>
        )}
        {isLoading || !pipeline ? (
          <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
        ) : !displayed?.length ? (
          <Card>
            <EmptyState
              title={wonOnly ? "No won deals yet" : "No deals yet"}
              subtitle={wonOnly ? undefined : "Start tracking a deal — with or without a prior opportunity."}
              action={!wonOnly ? <Button onClick={() => setShowNew(true)}><Plus size={15} /> Create Deal</Button> : undefined}
            />
          </Card>
        ) : view === "kanban" && !wonOnly ? (
          <KanbanBoard stages={pipeline.stages} items={deals!.data} basePath="/deals" onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })} />
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {!wonOnly && <th className="px-4 py-2.5 w-8"><SelectAllCheckbox checked={allChecked} indeterminate={!!someChecked} onChange={toggleAll} /></th>}
                {["Name", "Account", "Amount", "Stage", "Owner", "Close Date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {displayed.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    {!wonOnly && <td className="px-4 py-3"><RowCheckbox checked={selected.has(d.id)} onChange={(v) => toggleOne(d.id, v)} /></td>}
                    <td className="px-4 py-3"><Link to={`/deals/${d.id}`} className="font-medium">{d.name}</Link></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{d.account?.name}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(d.amount)}</td>
                    <td className="px-4 py-3"><StageBadge stage={d.stage as any} /></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{formatDate(d.closeDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
      {showNew && <NewDealModal onClose={() => setShowNew(false)} />}

      {!wonOnly && (
        <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
          <Button size="sm" variant="secondary" onClick={() => setBulkOwnerPicker(true)}>Assign Owner</Button>
          <Button size="sm" variant="secondary" onClick={() => setBulkStagePicker(true)}>Change Stage</Button>
          <Button size="sm" variant="danger" onClick={() => bulkMutation.mutate({ action: "archive" })} disabled={bulkMutation.isPending}><Archive size={13} /> Archive</Button>
        </BulkActionBar>
      )}

      {bulkOwnerPicker && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white" style={{ borderColor: "var(--ink-100)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>Assign {selected.size} deal(s) to</div>
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

      {bulkStagePicker && pipeline && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-64 p-3 rounded-lg border shadow-xl bg-white" style={{ borderColor: "var(--ink-100)" }}>
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>Move {selected.size} to stage</div>
          <div className="flex flex-wrap gap-1.5">
            {pipeline.stages.map((s) => (
              <button
                key={s.id}
                onClick={() => bulkMutation.mutate({ action: "changeStage", stageId: s.id })}
                disabled={bulkMutation.isPending}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ background: "var(--ink-50)", color: "var(--ink-700)" }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
