import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Button } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { NewOpportunityModal } from "../components/CreateModals";
import type { Opportunity, Pipeline, Paginated } from "../lib/types";
import { Plus } from "lucide-react";

export default function PipelinePage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({ queryKey: ["pipelines", "OPPORTUNITY"], queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data });
  const pipeline = pipelines?.data[0];

  const { data: opps } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "kanban", pipeline?.id],
    queryFn: async () => (await api.get("/opportunities", { params: { pipelineId: pipeline!.id, isConverted: false, pageSize: 100 } })).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => api.patch(`/opportunities/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities", "kanban"] }),
  });

  if (!pipeline) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading pipeline…</div>;

  return (
    <div>
      <PageHeader title="Sales Pipeline" subtitle="Drag opportunities between stages as deals progress." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Opportunity</Button>} />
      <div className="px-8 pb-8">
        <KanbanBoard
          stages={pipeline.stages}
          items={opps?.data || []}
          basePath="/opportunities"
          onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })}
        />
      </div>
      {showNew && <NewOpportunityModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
