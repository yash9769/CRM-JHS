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
import { computeOpportunityFinancials } from "../lib/financial";
import { useAuth } from "../hooks/useAuth";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { Plus, Search, Archive, Download, UploadCloud, Building2, User, FileSpreadsheet } from "lucide-react";

const OPPORTUNITY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Opportunity Name", permanent: true },
  { key: "owner", label: "Assigned To" },
  { key: "account", label: "Account Name" },
  { key: "contact", label: "Contact Person" },
  { key: "stage", label: "Stage" },
  { key: "actualOpportunityValue", label: "Proposal Sent Value" },
  { key: "bottomLineCost", label: "Cost Incurred to Company" },
  { key: "marginValue", label: "Margin Value" },
  { key: "marginPercentage", label: "Margin Percentage" },
  { key: "createdAt", label: "Created Date" },
  { key: "closeDate", label: "Close Date" },
  { key: "remarks", label: "Remarks", defaultVisible: false },
];

/** Stages shown in the "Open" tab — mid-pipeline only, per product decision. */
const OPEN_TAB_STAGE_NAMES = new Set(["Scope Discussion", "Proposal Sent", "Negotiation"]);

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"all" | "open" | "won" | "lost">("all");
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
    queryKey: ["opportunities", "list", activeTab, search, stageId, ownerId],
    queryFn: async () =>
      (
        await api.get("/opportunities", {
          params: {
            search,
            pageSize: 100,
            ...(stageId ? { stageId } : {}),
            ...(ownerId ? { ownerId } : {}),
            ...(activeTab === "won" ? { won: "true" } : {}),
            ...(activeTab === "lost" ? { forecastCategory: "CLOSED_LOST" } : {}),
          },
        })
      ).data,
  });

  const opportunitiesList = data?.data || [];
  const filteredData = opportunitiesList.filter(o => {
    if (activeTab === "open") return !!o.stage?.name && OPEN_TAB_STAGE_NAMES.has(o.stage.name);
    return true;
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
      {
        search,
        ...(stageId ? { stageId } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(activeTab === "won" ? { won: "true" } : {}),
      },
      "opportunities.csv"
    );
  }

  async function downloadSampleTemplate() {
    await downloadCsvExport(
      "/opportunities/sample-template",
      {},
      "opportunity_sample_template.csv"
    );
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filteredData.map((o) => o.id)) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  const allChecked = !!filteredData.length && filteredData.every((o) => selected.has(o.id));
  const someChecked = filteredData.some((o) => selected.has(o.id)) && !allChecked;

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Opportunities"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnFilterDropdown
              columns={OPPORTUNITY_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={downloadSampleTemplate}>
              <FileSpreadsheet size={14} /> Download Sample Format
            </Button>
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            {user?.orgRole !== "MANAGER" && (
              <Button variant="secondary" onClick={exportCsv}>
                <Download size={14} /> Export CSV
              </Button>
            )}
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> Create Opportunity
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="opportunities" onClose={() => setShowImport(false)} />}
      <div className="px-4 md:px-8 pb-8 space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 border-b border-[var(--ink-200)] pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "all"
                ? "bg-white border border-b-0 border-[var(--ink-200)] text-[var(--ledger-700)] font-semibold"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            All Opportunities
          </button>
          <button
            onClick={() => setActiveTab("open")}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "open"
                ? "bg-white border border-b-0 border-[var(--ink-200)] text-[var(--ledger-700)] font-semibold"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            Open
          </button>
          <button
            onClick={() => setActiveTab("won")}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "won"
                ? "bg-white border border-b-0 border-[var(--ink-200)] text-[var(--ledger-700)] font-semibold"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            Won
          </button>
          <button
            onClick={() => setActiveTab("lost")}
            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "lost"
                ? "bg-white border border-b-0 border-[var(--ink-200)] text-[var(--ledger-700)] font-semibold"
                : "text-[var(--ink-500)] hover:text-[var(--ink-900)]"
            }`}
          >
            Lost
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search opportunities…"
              className={`${inputClass} pl-8 min-h-[44px] sm:min-h-[38px]`}
              style={inputStyle}
            />
          </div>
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className={`${inputClass} min-h-[44px] sm:min-h-[38px]`}
            style={{ ...inputStyle, width: "auto" }}
          >
            <option value="">All stages</option>
            {pipeline?.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <div className="w-full sm:w-52">
            {user?.orgRole !== "MANAGER" && (
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
            )}
          </div>
        </div>

        <div>
          <SavedViewsBar
            objectType="OPPORTUNITY"
            currentFilters={{ search, stageId, ownerId, activeTab }}
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
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading…</div>
          ) : !filteredData.length ? (
            <EmptyState
              title="No opportunities found"
              subtitle="Try adjusting filters or create a new opportunity."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> Create Opportunity</Button>}
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto max-h-[calc(100vh-250px)]">
                <table className="w-full text-sm border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="text-left border-b border-[var(--ink-100)] bg-white">
                      <th className="px-4 py-2.5 w-8 border-b border-[var(--ink-100)] bg-white">
                        <SelectAllCheckbox checked={allChecked} indeterminate={!!someChecked} onChange={toggleAll} />
                      </th>
                      {isVisible("name") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Opportunity Name
                        </th>
                      )}
                      {isVisible("owner") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Assigned To
                        </th>
                      )}
                      {isVisible("account") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Account Name
                        </th>
                      )}
                      {isVisible("contact") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Contact Person
                        </th>
                      )}
                      {isVisible("stage") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Stage
                        </th>
                      )}
                      {isVisible("actualOpportunityValue") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Proposal Sent Value
                        </th>
                      )}
                      {isVisible("bottomLineCost") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Cost Incurred to Company
                        </th>
                      )}
                      {isVisible("marginValue") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Margin Value
                        </th>
                      )}
                      {isVisible("marginPercentage") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Margin Percentage
                        </th>
                      )}
                      {isVisible("createdAt") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Created Date
                        </th>
                      )}
                      {isVisible("closeDate") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Close Date
                        </th>
                      )}
                      {isVisible("remarks") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap text-[var(--ink-400)] border-b border-[var(--ink-100)] bg-white">
                          Remarks
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((o) => {
                      const financials = computeOpportunityFinancials(o);
                      const contactName = o.contact
                        ? `${o.contact.firstName} ${o.contact.lastName}`
                        : o.contacts && o.contacts[0]?.contact
                        ? `${o.contacts[0].contact.firstName} ${o.contacts[0].contact.lastName}`
                        : "—";

                      const mv = financials.marginValue;
                      const mp = financials.marginPercentage;
                      const marginColorClass = mv !== null
                        ? (mv > 0 ? "text-emerald-600 font-bold" : mv < 0 ? "text-rose-600 font-bold" : "text-slate-600 font-medium")
                        : "text-slate-400";

                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                          <td className="px-4 py-3">
                            <RowCheckbox checked={selected.has(o.id)} onChange={(v) => toggleOne(o.id, v)} />
                          </td>
                          {isVisible("name") && (
                            <td className="px-4 py-3">
                              <Link to={`/opportunities/${o.id}`} className="font-semibold hover:underline text-[var(--ledger-700)]">
                                {o.name}
                              </Link>
                            </td>
                          )}
                          {isVisible("owner") && (
                            <td className="px-4 py-3 text-[var(--ink-600)]">
                              {o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}
                            </td>
                          )}
                          {isVisible("account") && (
                            <td className="px-4 py-3 font-medium text-[var(--ink-700)]">
                              {o.account?.name || "—"}
                            </td>
                          )}
                          {isVisible("contact") && (
                            <td className="px-4 py-3 text-[var(--ink-600)]">
                              {contactName}
                            </td>
                          )}
                          {isVisible("stage") && (
                            <td className="px-4 py-3">
                              <StageBadge stage={o.stage as any} />
                            </td>
                          )}
                          {isVisible("actualOpportunityValue") && (
                            <td className="px-4 py-3 font-mono-num font-semibold text-slate-900">
                              {financials.actualOpportunityValue !== null ? formatCurrency(financials.actualOpportunityValue) : "—"}
                            </td>
                          )}
                          {isVisible("bottomLineCost") && (
                            <td className="px-4 py-3 font-mono-num font-medium text-slate-600">
                              {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
                            </td>
                          )}
                          {isVisible("marginValue") && (
                            <td className={`px-4 py-3 font-mono-num ${marginColorClass}`}>
                              {mv !== null ? formatCurrency(mv) : "—"}
                            </td>
                          )}
                          {isVisible("marginPercentage") && (
                            <td className={`px-4 py-3 font-mono-num ${marginColorClass}`}>
                              {mp !== null ? `${mp.toFixed(1)}%` : "—"}
                            </td>
                          )}
                          {isVisible("createdAt") && (
                            <td className="px-4 py-3 font-mono-num text-xs text-[var(--ink-500)]">
                              {formatDate(o.createdAt)}
                            </td>
                          )}
                          {isVisible("closeDate") && (
                            <td className="px-4 py-3 font-mono-num text-xs text-[var(--ink-500)]">
                              {formatDate(o.expectedCloseDate)}
                            </td>
                          )}
                          {isVisible("remarks") && (
                            <td className="px-4 py-3 text-xs max-w-xs truncate text-[var(--ink-500)]">
                              {o.description || "—"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="block md:hidden divide-y divide-[var(--ink-100)]">
                {filteredData.map((o) => (
                  <div key={o.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/opportunities/${o.id}`} className="font-semibold text-base text-[var(--ledger-700)]">
                        {o.name}
                      </Link>
                      <span className="font-mono-num font-bold text-sm text-[var(--ledger-800)]">
                        {formatCurrency(o.amount)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ink-500)]">
                      {o.account && (
                        <span className="flex items-center gap-1 font-medium text-[var(--ink-700)]">
                          <Building2 size={12} /> {o.account.name}
                        </span>
                      )}
                      {o.contact && (
                        <span className="flex items-center gap-1">
                          <User size={12} /> {o.contact.firstName} {o.contact.lastName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <StageBadge stage={o.stage as any} />
                      <span className="text-xs text-[var(--ink-500)]">
                        Owner: {o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white border-[var(--ink-100)]">
          <div className="text-xs font-medium mb-2 text-[var(--ink-500)]">
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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 p-3 rounded-lg border shadow-xl bg-white border-[var(--ink-100)]">
          <div className="text-xs font-medium mb-2 text-[var(--ink-500)]">
            Move {selected.size} opportunit{selected.size === 1 ? "y" : "ies"} to
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {pipeline.stages.map((s) => (
              <button
                key={s.id}
                onClick={() => bulkMutation.mutate({ action: "changeStage", stageId: s.id })}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-[var(--ink-50)] flex items-center justify-between font-medium text-[var(--ink-800)]"
              >
                <span>{s.name}</span>
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
