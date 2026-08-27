import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Button } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { NewOpportunityModal } from "../components/CreateModals";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { Plus } from "lucide-react";

export default function PipelinePage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);

  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({
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

  const { data: opps } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "kanban", pipeline?.id],
    queryFn: async () =>
      (
        await api.get("/opportunities", {
          params: { pipelineId: pipeline!.id, isConverted: false, pageSize: 1000 },
        })
      ).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) =>
      api.patch(`/opportunities/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities", "kanban"] }),
  });

  if (!pipeline) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading pipeline…</div>;

  return (
    <div>
      <PageHeader
        title="Sales Pipeline"
        subtitle="Drag opportunities between stages as deals progress."
        action={
          <div className="flex items-center gap-2">
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
      <div className="px-8 pb-8">
        <KanbanBoard
          stages={pipeline.stages}
          items={opps?.data || []}
          basePath="/opportunities"
          onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })}
          visibleStageIds={visibleKeys}
        />
      </div>
      {showNew && <NewOpportunityModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
