import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, StageBadge, EmptyState } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import { formatCurrency, formatDate } from "../lib/format";
import type { Deal, Pipeline, Paginated } from "../lib/types";
import { LayoutGrid, List } from "lucide-react";

export default function DealsPage() {
  const [params] = useSearchParams();
  const wonOnly = params.get("won") === "true";
  const qc = useQueryClient();
  const [view, setView] = useState<"table" | "kanban">(wonOnly ? "table" : "kanban");

  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({ queryKey: ["pipelines", "DEAL"], queryFn: async () => (await api.get("/pipelines", { params: { type: "DEAL" } })).data });
  const pipeline = pipelines?.data[0];

  const { data: deals, isLoading } = useQuery<Paginated<Deal>>({
    queryKey: ["deals", "list", pipeline?.id],
    queryFn: async () => (await api.get("/deals", { params: { pipelineId: pipeline?.id, pageSize: 100 } })).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => api.patch(`/deals/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deals"] }),
  });

  const displayed = wonOnly ? deals?.data.filter((d) => d.stage?.isClosed && d.stage.isWon) : deals?.data;

  return (
    <div>
      <PageHeader
        title={wonOnly ? "Won Deals" : "Deals"}
        subtitle={wonOnly ? "Everything your team has closed." : "Concrete sales commitments in progress."}
        action={
          !wonOnly && (
            <div className="flex gap-1 rounded-md p-0.5" style={{ background: "var(--ink-100)" }}>
              <button onClick={() => setView("kanban")} className="p-1.5 rounded" style={{ background: view === "kanban" ? "white" : "transparent" }}><LayoutGrid size={15} /></button>
              <button onClick={() => setView("table")} className="p-1.5 rounded" style={{ background: view === "table" ? "white" : "transparent" }}><List size={15} /></button>
            </div>
          )
        }
      />
      <div className="px-8 pb-8">
        {isLoading || !pipeline ? (
          <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
        ) : !displayed?.length ? (
          <Card><EmptyState title={wonOnly ? "No won deals yet" : "No deals yet"} subtitle="Convert an opportunity to create your first deal." /></Card>
        ) : view === "kanban" && !wonOnly ? (
          <KanbanBoard stages={pipeline.stages} items={deals!.data} basePath="/deals" onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })} />
        ) : (
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Account", "Amount", "Stage", "Owner", "Close Date"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {displayed.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
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
    </div>
  );
}
