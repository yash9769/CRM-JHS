import { useState, Fragment, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, StageBadge, Button, EmptyState, inputClass, inputStyle, Modal, MetricCard, MetricStrip } from "../components/ui";
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
import { SortableTh } from "../components/SortableTh";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { OpportunityDeletionModal } from "../components/OpportunityDeletionModal";
import { Plus, Search, Download, UploadCloud, Building2, User, FileSpreadsheet, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Trash2, Layers, IndianRupee, Gauge, TrendingUp } from "lucide-react";

const OPPORTUNITY_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Opportunity Name", permanent: true },
  { key: "owner", label: "Assigned To" },
  { key: "account", label: "Account Name" },
  { key: "contact", label: "Contact Person" },
  { key: "stage", label: "Stage" },
  { key: "actualOpportunityValue", label: "Proposal Value" },
  { key: "bottomLineCost", label: "Cost Incurred to Company" },
  { key: "marginValue", label: "Margin Value" },
  { key: "marginPercentage", label: "Margin Percentage" },
  { key: "weightedPipeline", label: "Weighted Pipeline" },
  { key: "createdAt", label: "Created Date" },
  { key: "closeDate", label: "Close Date" },
  { key: "remarks", label: "Remarks", defaultVisible: false },
];

/** Stages shown in the "Open" tab — mid-pipeline only, per product decision. */
const OPEN_TAB_STAGE_NAMES = new Set(["Scope Discussion", "Proposal Sent", "Negotiation"]);

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const isManager = user?.orgRole === "MANAGER";
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
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [deletionTarget, setDeletionTarget] = useState<{ id: string; name: string } | null>(null);

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/opportunities/bulk-delete", { ids }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      setSelected(new Set());
      setShowBulkDeleteConfirm(false);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.error || "Failed to delete selected opportunities");
    },
  });

  const [sortBy, setSortBy] = useState<string>("created_desc");

  const { visibleKeys, toggle, showAll, reset, isVisible, orderedColumns, reorder, applyColumns } = useColumnVisibility(
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

  const sortedData = [...filteredData].sort((a, b) => {
    const finA = computeOpportunityFinancials(a);
    const finB = computeOpportunityFinancials(b);

    if (sortBy === "name_asc") return a.name.localeCompare(b.name);
    if (sortBy === "name_desc") return b.name.localeCompare(a.name);
    if (sortBy === "owner_asc") return `${a.owner?.firstName || ""} ${a.owner?.lastName || ""}`.localeCompare(`${b.owner?.firstName || ""} ${b.owner?.lastName || ""}`);
    if (sortBy === "owner_desc") return `${b.owner?.firstName || ""} ${b.owner?.lastName || ""}`.localeCompare(`${a.owner?.firstName || ""} ${a.owner?.lastName || ""}`);
    if (sortBy === "account_asc") return (a.account?.name || "").localeCompare(b.account?.name || "");
    if (sortBy === "account_desc") return (b.account?.name || "").localeCompare(a.account?.name || "");
    if (sortBy === "stage_asc") return (a.stage?.name || "").localeCompare(b.stage?.name || "");
    if (sortBy === "stage_desc") return (b.stage?.name || "").localeCompare(a.stage?.name || "");
    if (sortBy === "amount_desc") return (Number(finB.actualOpportunityValue ?? b.amount ?? 0)) - (Number(finA.actualOpportunityValue ?? a.amount ?? 0));
    if (sortBy === "amount_asc") return (Number(finA.actualOpportunityValue ?? a.amount ?? 0)) - (Number(finB.actualOpportunityValue ?? b.amount ?? 0));
    if (sortBy === "cost_desc") return (Number(finB.bottomLineCost ?? 0)) - (Number(finA.bottomLineCost ?? 0));
    if (sortBy === "cost_asc") return (Number(finA.bottomLineCost ?? 0)) - (Number(finB.bottomLineCost ?? 0));
    if (sortBy === "margin_desc") return (Number(finB.marginValue ?? -Infinity)) - (Number(finA.marginValue ?? -Infinity));
    if (sortBy === "margin_asc") return (Number(finA.marginValue ?? Infinity)) - (Number(finB.marginValue ?? Infinity));
    if (sortBy === "margin_pct_desc") return (Number(finB.marginPercentage ?? -Infinity)) - (Number(finA.marginPercentage ?? -Infinity));
    if (sortBy === "margin_pct_asc") return (Number(finA.marginPercentage ?? Infinity)) - (Number(finB.marginPercentage ?? Infinity));
    if (sortBy === "weighted_desc") {
      const wA = computeOpportunityFinancials(a).expectedOpportunityValue !== null ? computeOpportunityFinancials(a).expectedOpportunityValue! * (a.probability || 0) / 100 : Number(a.amount || 0) * (a.probability || 0) / 100;
      const wB = computeOpportunityFinancials(b).expectedOpportunityValue !== null ? computeOpportunityFinancials(b).expectedOpportunityValue! * (b.probability || 0) / 100 : Number(b.amount || 0) * (b.probability || 0) / 100;
      return wB - wA;
    }
    if (sortBy === "weighted_asc") {
      const wA = computeOpportunityFinancials(a).expectedOpportunityValue !== null ? computeOpportunityFinancials(a).expectedOpportunityValue! * (a.probability || 0) / 100 : Number(a.amount || 0) * (a.probability || 0) / 100;
      const wB = computeOpportunityFinancials(b).expectedOpportunityValue !== null ? computeOpportunityFinancials(b).expectedOpportunityValue! * (b.probability || 0) / 100 : Number(b.amount || 0) * (b.probability || 0) / 100;
      return wA - wB;
    }
    if (sortBy === "close_date_asc") return new Date(a.expectedCloseDate || 0).getTime() - new Date(b.expectedCloseDate || 0).getTime();
    if (sortBy === "close_date_desc") return new Date(b.expectedCloseDate || 0).getTime() - new Date(a.expectedCloseDate || 0).getTime();
    if (sortBy === "created_asc") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const handleHeaderSort = (key: string) => {
    switch (key) {
      case "name":
        setSortBy((prev) => (prev === "name_asc" ? "name_desc" : "name_asc"));
        break;
      case "owner":
        setSortBy((prev) => (prev === "owner_asc" ? "owner_desc" : "owner_asc"));
        break;
      case "account":
        setSortBy((prev) => (prev === "account_asc" ? "account_desc" : "account_asc"));
        break;
      case "stage":
        setSortBy((prev) => (prev === "stage_asc" ? "stage_desc" : "stage_asc"));
        break;
      case "actualOpportunityValue":
        setSortBy((prev) => (prev === "amount_desc" ? "amount_asc" : "amount_desc"));
        break;
      case "bottomLineCost":
        setSortBy((prev) => (prev === "cost_desc" ? "cost_asc" : "cost_desc"));
        break;
      case "marginValue":
        setSortBy((prev) => (prev === "margin_desc" ? "margin_asc" : "margin_desc"));
        break;
      case "marginPercentage":
        setSortBy((prev) => (prev === "margin_pct_desc" ? "margin_pct_asc" : "margin_pct_desc"));
        break;
      case "weightedPipeline":
        setSortBy((prev) => (prev === "weighted_desc" ? "weighted_asc" : "weighted_desc"));
        break;
      case "createdAt":
        setSortBy((prev) => (prev === "created_desc" ? "created_asc" : "created_desc"));
        break;
      case "closeDate":
        setSortBy((prev) => (prev === "close_date_asc" ? "close_date_desc" : "close_date_asc"));
        break;
      default:
        break;
    }
  };

  const getSortIcon = (key: string) => {
    switch (key) {
      case "name":
        if (sortBy === "name_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "name_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "owner":
        if (sortBy === "owner_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "owner_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "account":
        if (sortBy === "account_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "account_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "stage":
        if (sortBy === "stage_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "stage_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "actualOpportunityValue":
        if (sortBy === "amount_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "amount_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "bottomLineCost":
        if (sortBy === "cost_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "cost_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "marginValue":
        if (sortBy === "margin_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "margin_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "marginPercentage":
        if (sortBy === "margin_pct_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "margin_pct_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "weightedPipeline":
        if (sortBy === "weighted_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "weighted_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "createdAt":
        if (sortBy === "created_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "created_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      case "closeDate":
        if (sortBy === "close_date_asc") return <ArrowUp size={12} className="text-[var(--ledger-600)] shrink-0" />;
        if (sortBy === "close_date_desc") return <ArrowDown size={12} className="text-[var(--ledger-600)] shrink-0" />;
        return <ArrowUpDown size={12} className="text-[var(--ink-300)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />;
      default:
        return null;
    }
  };

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

  const metrics = sortedData.reduce(
    (acc, o) => {
      const fin = computeOpportunityFinancials(o);
      const value = Number(fin.actualOpportunityValue ?? fin.expectedOpportunityValue ?? o.amount ?? 0);
      const prob = (o.probability ?? o.stage?.probability ?? 0) / 100;
      acc.totalValue += value;
      acc.weightedValue += value * prob;
      if (fin.marginValue !== null) acc.totalMargin += fin.marginValue;
      return acc;
    },
    { totalValue: 0, weightedValue: 0, totalMargin: 0 }
  );
  const avgDealSize = sortedData.length > 0 ? metrics.totalValue / sortedData.length : 0;

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Opportunities"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnFilterDropdown
              columns={orderedColumns}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              onReorder={reorder}
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
        <MetricStrip>
          <MetricCard label="Opportunities" value={sortedData.length} caption="In current view" icon={Layers} color="indigo" />
          <MetricCard label="Total Value" value={formatCurrency(metrics.totalValue)} caption="Sum of proposal value" icon={IndianRupee} color="sky" />
          <MetricCard label="Weighted Pipeline" value={formatCurrency(metrics.weightedValue)} caption="Probability adjusted" icon={TrendingUp} color="amber" />
          <MetricCard label="Total Margin" value={formatCurrency(metrics.totalMargin)} caption="Across visible opportunities" icon={Gauge} color="emerald" />
          <MetricCard label="Avg Opportunity Size" value={formatCurrency(avgDealSize)} caption="Mean value per opportunity" icon={IndianRupee} color="purple" />
        </MetricStrip>

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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`${inputClass} min-h-[44px] sm:min-h-[38px] font-medium`}
            style={{ ...inputStyle, width: "auto" }}
          >
            <option value="created_desc">Sort by: Newest First</option>
            <option value="created_asc">Sort by: Oldest First</option>
            <option value="name_asc">Sort by: Name (A → Z)</option>
            <option value="name_desc">Sort by: Name (Z → A)</option>
            <option value="amount_desc">Sort by: Value (High → Low)</option>
            <option value="amount_asc">Sort by: Value (Low → High)</option>
            <option value="margin_desc">Sort by: Margin Value (High → Low)</option>
            <option value="margin_pct_desc">Sort by: Margin % (High → Low)</option>
            <option value="close_date_asc">Sort by: Close Date (Soonest)</option>
            <option value="close_date_desc">Sort by: Close Date (Latest)</option>
            <option value="account_asc">Sort by: Account (A → Z)</option>
            <option value="stage_asc">Sort by: Stage (A → Z)</option>
            <option value="owner_asc">Sort by: Assigned To (A → Z)</option>
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
            currentFilters={{ search, stageId, ownerId, ownerLabel, activeTab }}
            onApply={(f) => {
              setSearch(f.search || "");
              setStageId(f.stageId || "");
              setOwnerId(f.ownerId || null);
              setOwnerLabel(f.ownerLabel || null);
              if (f.activeTab) {
                setActiveTab(f.activeTab as any);
              }
            }}
            currentColumns={orderedColumns.filter((c) => isVisible(c.key)).map((c) => c.key)}
            onApplyColumns={applyColumns}
          />
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading…</div>
          ) : !sortedData.length ? (
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
                      {orderedColumns.filter((c) => isVisible(c.key)).map((col) => {
                        const isSortable = [
                          "name",
                          "owner",
                          "account",
                          "stage",
                          "actualOpportunityValue",
                          "bottomLineCost",
                          "marginValue",
                          "marginPercentage",
                          "createdAt",
                          "closeDate",
                        ].includes(col.key);
                        return (
                          <SortableTh
                            key={col.key}
                            colKey={col.key}
                            onReorder={reorder}
                            onHide={toggle}
                            canHide={!col.permanent}
                            onClick={() => isSortable && handleHeaderSort(col.key)}
                            className={`px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap border-b border-[var(--ink-100)] bg-white select-none ${
                              isSortable
                                ? "cursor-pointer group hover:bg-[var(--ink-50)] text-[var(--ink-600)] transition-colors"
                                : "text-[var(--ink-400)]"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{col.label}</span>
                              {isSortable && getSortIcon(col.key)}
                            </div>
                          </SortableTh>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedData.map((o) => {
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

                      const cellRenderers: Record<string, () => ReactElement> = {
                        name: () => (
                          <td className="px-4 py-3">
                            <Link to={`/opportunities/${o.id}`} className="font-semibold hover:underline text-[var(--ledger-700)]">
                              {o.name}
                            </Link>
                          </td>
                        ),
                        owner: () => (
                          <td className="px-4 py-3 text-[var(--ink-600)]">
                            {o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}
                          </td>
                        ),
                        account: () => (
                          <td className="px-4 py-3 font-medium text-[var(--ink-700)]">
                            {o.account?.name || "—"}
                          </td>
                        ),
                        contact: () => (
                          <td className="px-4 py-3 text-[var(--ink-600)]">
                            {contactName}
                          </td>
                        ),
                        stage: () => (
                          <td className="px-4 py-3">
                            <StageBadge stage={o.stage as any} />
                          </td>
                        ),
                        actualOpportunityValue: () => (
                          <td className="px-4 py-3 font-mono-num font-semibold text-slate-900">
                            {financials.actualOpportunityValue !== null ? formatCurrency(financials.actualOpportunityValue) : "—"}
                          </td>
                        ),
                        bottomLineCost: () => (
                          <td className="px-4 py-3 font-mono-num font-medium text-slate-600">
                            {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
                          </td>
                        ),
                        marginValue: () => (
                          <td className={`px-4 py-3 font-mono-num ${marginColorClass}`}>
                            {mv !== null ? formatCurrency(mv) : "—"}
                          </td>
                        ),
                         marginPercentage: () => (
                           <td className={`px-4 py-3 font-mono-num ${marginColorClass}`}>
                             {mp !== null ? `${mp.toFixed(1)}%` : "—"}
                           </td>
                         ),
                         weightedPipeline: () => {
                           const oppValue = financials.expectedOpportunityValue !== null ? financials.expectedOpportunityValue : Number(o.amount || 0);
                           const prob = o.probability || o.stage?.probability || 0;
                           const weighted = oppValue * (prob / 100);
                           return (
                             <td className="px-4 py-3 font-mono-num text-xs text-[var(--ledger-700)]">
                               {formatCurrency(weighted)}
                             </td>
                           );
                         },
                         createdAt: () => (
                          <td className="px-4 py-3 font-mono-num text-xs text-[var(--ink-500)]">
                            {formatDate(o.createdAt)}
                          </td>
                        ),
                        closeDate: () => (
                          <td className="px-4 py-3 font-mono-num text-xs text-[var(--ink-500)]">
                            {formatDate(o.expectedCloseDate)}
                          </td>
                        ),
                        remarks: () => (
                          <td className="px-4 py-3 text-xs max-w-xs truncate text-[var(--ink-500)]">
                            {o.description || "—"}
                          </td>
                        ),
                      };

                      return (
                        <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                          <td className="px-4 py-3">
                            <RowCheckbox checked={selected.has(o.id)} onChange={(v) => toggleOne(o.id, v)} />
                          </td>
                          {orderedColumns.filter((c) => isVisible(c.key)).map((col) => (
                            <Fragment key={col.key}>{cellRenderers[col.key]?.()}</Fragment>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="block md:hidden divide-y divide-[var(--ink-100)]">
                {sortedData.map((o) => (
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
          onClick={() => {
            if (isManager) {
              if (selected.size === 1) {
                const selectedId = Array.from(selected)[0];
                const target = opportunitiesList.find((o) => o.id === selectedId);
                if (target) {
                  setDeletionTarget({ id: target.id, name: target.name });
                }
              } else {
                alert("As a Manager, deleting opportunities requires Partner approval with justification. Please select an individual opportunity to submit a deletion request.");
              }
            } else {
              setShowBulkDeleteConfirm(true);
            }
          }}
          disabled={bulkDeleteMutation.isPending}
        >
          <Trash2 size={13} /> {isManager ? "Request Deletion" : "Delete Selected"}
        </Button>
      </BulkActionBar>

      {deletionTarget && (
        <OpportunityDeletionModal
          opportunity={deletionTarget}
          onClose={() => setDeletionTarget(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["opportunities"] });
            qc.invalidateQueries({ queryKey: ["opportunity-deletion-requests"] });
            setSelected(new Set());
            setDeletionTarget(null);
          }}
        />
      )}

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
      {showBulkDeleteConfirm && (
        <Modal title="Delete Opportunities" onClose={() => setShowBulkDeleteConfirm(false)} width="480px">
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">Permanent Deletion</div>
                <div>This will permanently delete {selected.size} opportunit{selected.size > 1 ? "ies" : "y"} and all associated records (quotes, line items, attachments, stage history). This action cannot be undone.</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
              <Button variant="secondary" onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleteMutation.isPending}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => bulkDeleteMutation.mutate(Array.from(selected))} disabled={bulkDeleteMutation.isPending}>
                {bulkDeleteMutation.isPending ? "Deleting…" : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
