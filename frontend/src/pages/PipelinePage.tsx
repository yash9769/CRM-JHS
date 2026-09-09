import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Button, inputClass, inputStyle } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { NewOpportunityModal } from "../components/CreateModals";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import { computeOpportunityFinancials } from "../lib/financial";
import { formatCurrency } from "../lib/format";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import {
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Layers,
  Trophy,
  IndianRupee,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

export default function PipelinePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  const { data: pipelines, isLoading: isPipelinesLoading } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
  });
  const pipeline = pipelines?.data[0];

  const stageColumns: ColumnDef[] = useMemo(() => {
    if (!pipeline?.stages) return [];
    return pipeline.stages.map((s) => ({
      key: s.id,
      label: s.name,
    }));
  }, [pipeline]);

  const { visibleKeys, toggle, showAll, reset } = useColumnVisibility(
    "pipeline-stages",
    stageColumns
  );

  const { data: opps, isLoading: isOppsLoading } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "kanban", pipeline?.id, search, ownerId],
    queryFn: async () =>
      (
        await api.get("/opportunities", {
          params: {
            pipelineId: pipeline!.id,
            pageSize: 1000,
            ...(search ? { search } : {}),
            ...(ownerId ? { ownerId } : {}),
          },
        })
      ).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId, extra }: { id: string; stageId: string; extra?: { poNumber?: string; poValue?: string; lostReason?: string } }) =>
      api.patch(`/opportunities/${id}`, { stageId, pipelineId: pipeline!.id, ...extra }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  const items = opps?.data || [];

  // Compute live pipeline summary metrics
  const pipelineMetrics = useMemo(() => {
    let totalOpenValue = 0;
    let totalWeightedValue = 0;
    let activeDealsCount = 0;
    let closedWonValue = 0;
    let closedWonCount = 0;

    items.forEach((item) => {
      const financials = computeOpportunityFinancials(item);
      const val = Number(
        financials.actualOpportunityValue !== null
          ? financials.actualOpportunityValue
          : financials.expectedOpportunityValue !== null
          ? financials.expectedOpportunityValue
          : item.amount || 0
      );

      const stage = pipeline?.stages.find((s) => s.id === item.stageId);
      const isWon = stage?.isWon || stage?.name.toLowerCase().includes("won");
      const isClosed = stage?.isClosed;

      if (isWon) {
        closedWonValue += val;
        closedWonCount += 1;
      } else if (!isClosed) {
        totalOpenValue += val;
        activeDealsCount += 1;
        const prob = (item.probability ?? stage?.probability ?? 0) / 100;
        totalWeightedValue += val * prob;
      }
    });

    const avgDealSize = activeDealsCount > 0 ? totalOpenValue / activeDealsCount : 0;

    return {
      totalOpenValue,
      totalWeightedValue,
      activeDealsCount,
      closedWonValue,
      closedWonCount,
      avgDealSize,
    };
  }, [items, pipeline]);

  if (isPipelinesLoading || !pipeline) {
    return (
      <div className="px-4 md:px-8 py-5 md:py-7 space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-80 shrink-0 rounded-2xl flex flex-col space-y-3 p-4 bg-slate-50/80 border border-slate-200/60">
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-3 pt-2">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-28 w-full bg-white rounded-xl shadow-xs animate-pulse border border-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Sales Pipeline"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnFilterDropdown
              columns={stageColumns}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Stages"
            />
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Opportunity
            </Button>
          </div>
        }
      />

      <div className="px-4 md:px-8 space-y-4">
        {/* Top Summary KPI Metrics Cards Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Open Pipeline */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/30 border border-indigo-200/70 shadow-xs">
            <div className="flex items-center justify-between gap-1 text-[var(--ink-500)] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">Total Pipeline</span>
              <div className="w-5 h-5 rounded-md bg-indigo-100/80 flex items-center justify-center text-indigo-700">
                <Sparkles size={11} />
              </div>
            </div>
            <div className="font-mono-num text-base md:text-lg font-bold text-indigo-950">
              {formatCurrency(pipelineMetrics.totalOpenValue)}
            </div>
            <div className="text-[10px] text-indigo-700/80 mt-0.5 font-medium">
              Across active open stages
            </div>
          </div>

          {/* Card 2: Weighted Forecast */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-sky-50/80 via-white to-sky-50/30 border border-sky-200/70 shadow-xs">
            <div className="flex items-center justify-between gap-1 text-[var(--ink-500)] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-900">Weighted Forecast</span>
              <div className="w-5 h-5 rounded-md bg-sky-100/80 flex items-center justify-center text-sky-700">
                <TrendingUp size={11} />
              </div>
            </div>
            <div className="font-mono-num text-base md:text-lg font-bold text-sky-950">
              {formatCurrency(pipelineMetrics.totalWeightedValue)}
            </div>
            <div className="text-[10px] text-sky-700/80 mt-0.5 font-medium">
              Probability adjusted
            </div>
          </div>

          {/* Card 3: Active Opportunities Count */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 border border-amber-200/70 shadow-xs">
            <div className="flex items-center justify-between gap-1 text-[var(--ink-500)] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Active Deals</span>
              <div className="w-5 h-5 rounded-md bg-amber-100/80 flex items-center justify-center text-amber-700">
                <Layers size={11} />
              </div>
            </div>
            <div className="font-mono-num text-base md:text-lg font-bold text-amber-950">
              {pipelineMetrics.activeDealsCount} <span className="text-xs font-normal text-amber-800/80">deals</span>
            </div>
            <div className="text-[10px] text-amber-700/80 mt-0.5 font-medium">
              In qualification & discussion
            </div>
          </div>

          {/* Card 4: Closed Won Revenue */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 border border-emerald-200/70 shadow-xs">
            <div className="flex items-center justify-between gap-1 text-[var(--ink-500)] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Closed Won</span>
              <div className="w-5 h-5 rounded-md bg-emerald-100/80 flex items-center justify-center text-emerald-700">
                <Trophy size={11} />
              </div>
            </div>
            <div className="font-mono-num text-base md:text-lg font-bold text-emerald-950">
              {formatCurrency(pipelineMetrics.closedWonValue)}
            </div>
            <div className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">
              {pipelineMetrics.closedWonCount} deals closed successfully
            </div>
          </div>

          {/* Card 5: Average Deal Size */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-50/80 via-white to-purple-50/30 border border-purple-200/70 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between gap-1 text-[var(--ink-500)] mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">Avg. Deal Size</span>
              <div className="w-5 h-5 rounded-md bg-purple-100/80 flex items-center justify-center text-purple-700">
                <IndianRupee size={11} />
              </div>
            </div>
            <div className="font-mono-num text-base md:text-lg font-bold text-purple-950">
              {formatCurrency(pipelineMetrics.avgDealSize)}
            </div>
            <div className="text-[10px] text-purple-700/80 mt-0.5 font-medium">
              Mean value per open deal
            </div>
          </div>
        </div>

        {/* Filter / Search Bar */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pipeline opportunities…"
              className={`${inputClass} pl-8 shadow-2xs focus:ring-2 focus:ring-indigo-500/20`}
              style={inputStyle}
            />
          </div>

          <div className="w-56">
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

        {/* Kanban Board Container */}
        {isOppsLoading ? (
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-80 shrink-0 rounded-2xl flex flex-col space-y-3 p-4 bg-slate-50/80 border border-slate-200/60">
                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-3 pt-2">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="h-28 w-full bg-white rounded-xl shadow-xs animate-pulse border border-slate-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <KanbanBoard
            stages={pipeline.stages}
            items={items}
            basePath="/opportunities"
            onMove={(item, stageId, extra) => moveMutation.mutate({ id: item.id, stageId, extra })}
            visibleStageIds={visibleKeys}
          />
        )}
      </div>

      {showNew && <NewOpportunityModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
