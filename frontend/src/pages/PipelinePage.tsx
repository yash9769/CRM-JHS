import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Button, inputClass, inputStyle } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { NewOpportunityModal } from "../components/CreateModals";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { Plus, Search } from "lucide-react";
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
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.patch(`/opportunities/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  if (isPipelinesLoading || !pipeline) {
    return <div className="p-8 text-sm text-[var(--ink-400)]">Loading pipeline…</div>;
  }

  const items = opps?.data || [];

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

      <div className="px-4 md:px-8 pb-3">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pipeline opportunities…"
              className={`${inputClass} pl-8`}
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

        {isOppsLoading ? (
          <div className="p-8 text-sm text-[var(--ink-400)]">Loading pipeline opportunities…</div>
        ) : (
          <KanbanBoard
            stages={pipeline.stages}
            items={items}
            basePath="/opportunities"
            onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })}
            visibleStageIds={visibleKeys}
          />
        )}
      </div>

      {showNew && <NewOpportunityModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
