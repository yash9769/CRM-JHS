import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, StageBadge, Button, EmptyState, inputClass, inputStyle } from "../components/ui";
import { NewOpportunityModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { BulkActionBar, SelectAllCheckbox, RowCheckbox } from "../components/BulkActionBar";
import { SavedViewsBar } from "../components/SavedViewsBar";
import { fetchOwnerOptions } from "../lib/pickers";
import { formatCurrency, formatDate } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { Plus, Search, Archive, Download, UploadCloud } from "lucide-react";

const OPPORTUNITY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Opportunity Name", permanent: true },
  { key: "account", label: "Account" },
  { key: "contact", label: "Contact Person" },
  { key: "stage", label: "Opportunity Stage" },
  { key: "amount", label: "Opportunity Value" },
  { key: "owner", label: "Assigned To" },
  { key: "createdAt", label: "Created Date" },
  { key: "closeDate", label: "Close Date" },
  { key: "remarks", label: "Remarks", defaultVisible: false },
];

export default function OpportunitiesPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOwnerPicker, setBulkOwnerPicker] = useState(false);
  const [bulkOwnerId, setBulkOwnerId] = useState<string | null>(null);
  const [bulkOwnerLabel, setBulkOwnerLabel] = useState<string | null>(null);
  const [bulkStagePicker, setBulkStagePicker] = useState(false);

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "opportunities-table",
    OPPORTUNITY_COLUMNS
  );

  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
  });
  const pipeline = pipelines?.data[0];

  const { data, isLoading } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "list", search, stageId, ownerId],
    queryFn: async () =>
      (
        await api.get("/opportunities", {
          params: {
            search,
            pageSize: 100,
            ...(stageId ? { stageId } : {}),
            ...(ownerId ? { ownerId } : {}),
          },
        })
      ).data,
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: any) => api.post("/opportunities/bulk", { ids: Array.from(selected), ...payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      setSelected(new Set());
      setBulkOwnerPicker(false);
      setBulkStagePicker(false);
    },
  });

  async function exportCsv() {
    await downloadCsvExport(
      "/opportunities/export",
      { search, ...(stageId ? { stageId } : {}), ...(ownerId ? { ownerId } : {}) },
      "opportunities.csv"
    );
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(data?.data.map((o) => o.id) || []) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  const allChecked = !!data?.data.length && data.data.every((o) => selected.has(o.id));
  const someChecked = data?.data.some((o) => selected.has(o.id)) && !allChecked;

  return (
    <div>
      <PageHeader
        title="Opportunities"
        subtitle="Qualified potential business, before they become deals."
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={OPPORTUNITY_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Opportunity
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="opportunities" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities…"
              className={`${inputClass} pl-8`}
              style={inputStyle}
            />
          </div>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className={inputClass}
            style={{ ...inputStyle, width: 180 }}
          >
            <option value="">All stages</option>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="w-52">
            <RelationshipSelector
              value={ownerId}
              valueLabel={ownerLabel}
              onChange={(id, opt) => {
                setOwnerId(id);
                setOwnerLabel(opt?.label || null);
              }}
              fetchOptions={fetchOwnerOptions}
              placeholder="Filter by owner…"
            />
          </div>
        </div>
        <div className="mb-4">
          <SavedViewsBar
            objectType="OPPORTUNITY"
            currentFilters={{ search, stageId, ownerId }}
            onApply={(f) => {
              setSearch(f.search || "");
              setStageId(f.stageId || "");
              setOwnerId(f.ownerId || null);
              setOwnerLabel(null);
            }}
          />
        </div>
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No opportunities yet"
              subtitle="Start tracking potential business."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> Create Opportunity</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  <th className="px-4 py-2.5 w-8">
                    <SelectAllCheckbox checked={allChecked} indeterminate={!!someChecked} onChange={toggleAll} />
                  </th>
                  {isVisible("name") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Opportunity Name
                    </th>
                  )}
                  {isVisible("account") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Account
                    </th>
                  )}
                  {isVisible("contact") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Contact Person
                    </th>
                  )}
                  {isVisible("stage") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Opportunity Stage
                    </th>
                  )}
                  {isVisible("amount") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Opportunity Value
                    </th>
                  )}
                  {isVisible("owner") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Assigned To
                    </th>
                  )}
                  {isVisible("createdAt") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Created Date
                    </th>
                  )}
                  {isVisible("closeDate") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Close Date
                    </th>
                  )}
                  {isVisible("remarks") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Remarks
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((o) => {
                  const contactName = o.contact
                    ? `${o.contact.firstName} ${o.contact.lastName}`
                    : o.contacts && o.contacts[0]?.contact
                    ? `${o.contacts[0].contact.firstName} ${o.contacts[0].contact.lastName}`
                    : "—";

                  return (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                      <td className="px-4 py-3">
                        <RowCheckbox checked={selected.has(o.id)} onChange={(v) => toggleOne(o.id, v)} />
                      </td>
                      {isVisible("name") && (
                        <td className="px-4 py-3">
                          <Link to={`/opportunities/${o.id}`} className="font-semibold hover:underline" style={{ color: "var(--ledger-700)" }}>
                            {o.name}
                          </Link>
                        </td>
                      )}
                      {isVisible("account") && (
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--ink-700)" }}>
                          {o.account?.name || "—"}
                        </td>
                      )}
                      {isVisible("contact") && (
                        <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                          {contactName}
                        </td>
                      )}
                      {isVisible("stage") && (
                        <td className="px-4 py-3">
                          <StageBadge stage={o.stage as any} />
                        </td>
                      )}
                      {isVisible("amount") && (
                        <td className="px-4 py-3 font-mono-num font-semibold">{formatCurrency(o.amount)}</td>
                      )}
                      {isVisible("owner") && (
                        <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                          {o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}
                        </td>
                      )}
                      {isVisible("createdAt") && (
                        <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-500)" }}>
                          {formatDate(o.createdAt)}
                        </td>
                      )}
                      {isVisible("closeDate") && (
                        <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-500)" }}>
                          {formatDate(o.expectedCloseDate)}
                        </td>
                      )}
                      {isVisible("remarks") && (
                        <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "var(--ink-500)" }}>
                          {o.description || "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewOpportunityModal onClose={() => setShowNew(false)} />}

      <BulkActionBar count={selected.size} onClear={() => setSelected(new Set())}>
        <Button size="sm" variant="secondary" onClick={() => setBulkOwnerPicker(true)}>
          Assign Owner
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkStagePicker(true)}>
          Change Stage
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => bulkMutation.mutate({ action: "archive" })}
          disabled={bulkMutation.isPending}
        >
          <Archive size={13} /> Archive
        </Button>
      </BulkActionBar>

      {bulkOwnerPicker && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white"
          style={{ borderColor: "var(--ink-100)" }}
        >
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>
            Assign {selected.size} opportunit{selected.size === 1 ? "y" : "ies"} to
          </div>
          <RelationshipSelector
            value={bulkOwnerId}
            valueLabel={bulkOwnerLabel}
            onChange={(id, opt) => {
              setBulkOwnerId(id);
              setBulkOwnerLabel(opt?.label || null);
            }}
            fetchOptions={fetchOwnerOptions}
            placeholder="Search owner…"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkOwnerPicker(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!bulkOwnerId || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({ action: "assignOwner", ownerId: bulkOwnerId })}
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {bulkStagePicker && pipeline && (
        <div
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white"
          style={{ borderColor: "var(--ink-100)" }}
        >
          <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-500)" }}>
            Move {selected.size} opportunit{selected.size === 1 ? "y" : "ies"} to
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {pipeline.stages.map((s) => (
              <button
                key={s.id}
                onClick={() => bulkMutation.mutate({ action: "changeStage", stageId: s.id })}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-[var(--ink-50)] flex items-center justify-between"
              >
                <span>{s.name}</span>
                <span className="text-[10px]" style={{ color: "var(--ink-400)" }}>
                  {s.probability}%
                </span>
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-2">
            <Button size="sm" variant="secondary" onClick={() => setBulkStagePicker(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
