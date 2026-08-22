import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, EmptyState } from "../components/ui";
import { NewTaskModal } from "../components/CreateModals";
import { useAuth } from "../hooks/useAuth";
import { formatDate } from "../lib/format";
import type { Activity } from "../lib/types";
import { Plus, CheckSquare, Square, Download } from "lucide-react";
import { downloadCsvExport } from "../lib/exportCsv";

const BUCKETS = ["Overdue", "Today", "Upcoming", "Completed"] as const;
type Bucket = (typeof BUCKETS)[number];

function bucketOf(task: Activity): Bucket {
  if (task.status === "COMPLETED") return "Completed";
  if (!task.dueDate) return "Upcoming";
  const due = new Date(task.dueDate);
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (due < todayStart) return "Overdue";
  if (due <= todayEnd) return "Today";
  return "Upcoming";
}

function linkFor(task: any): string | null {
  if (task.leadId) return `/leads/${task.leadId}`;
  if (task.accountId) return `/accounts/${task.accountId}`;
  if (task.contactId) return `/contacts/${task.contactId}`;
  if (task.opportunityId) return `/opportunities/${task.opportunityId}`;
  if (task.dealId) return `/deals/${task.dealId}`;
  return null;
}

function relatedLabel(task: any): string | null {
  return task.lead ? `${task.lead.firstName} ${task.lead.lastName}` :
    task.account?.name || (task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null) ||
    task.opportunity?.name || task.deal?.name || null;
}

export default function TasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const [showNew, setShowNew] = useState(false);

  const { data, isLoading } = useQuery<{ data: Activity[] }>({
    queryKey: ["activities", "tasks", scope],
    queryFn: async () => (await api.get("/activities", { params: { type: "TASK", ...(scope === "mine" && user ? { ownerId: user.id } : {}) } })).data,
  });

  const complete = useMutation({
    mutationFn: (id: string) => api.patch(`/activities/${id}`, { status: "COMPLETED" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activities", "tasks"] }),
  });

  async function exportCsv() {
    await downloadCsvExport(
      "/activities/export",
      { type: "TASK", ...(scope === "mine" && user ? { ownerId: user.id } : {}) },
      "tasks.csv"
    );
  }

  const grouped = useMemo(() => {
    const out: Record<Bucket, Activity[]> = { Overdue: [], Today: [], Upcoming: [], Completed: [] };
    for (const t of data?.data || []) out[bucketOf(t)].push(t);
    return out;
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="Everything you and your team need to follow up on."
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Task
            </Button>
          </div>
        }
      />
      <div className="px-8 pb-8">
        <div className="flex gap-1 mb-5 rounded-md p-0.5 w-fit" style={{ background: "var(--ink-100)" }}>
          {(["mine", "team"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className="px-3 py-1.5 rounded text-xs font-medium" style={{ background: scope === s ? "white" : "transparent" }}>
              {s === "mine" ? "My Tasks" : "Team Tasks"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
        ) : !data?.data.length ? (
          <Card><EmptyState title="No tasks yet" subtitle="Create a task from here or from any lead, account, or deal." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Task</Button>} /></Card>
        ) : (
          <div className="space-y-6">
            {BUCKETS.map((b) => grouped[b].length > 0 && (
              <div key={b}>
                <div className="text-xs uppercase font-semibold mb-2" style={{ color: b === "Overdue" ? "var(--rose-600)" : "var(--ink-400)" }}>{b} ({grouped[b].length})</div>
                <Card>
                  {grouped[b].map((t) => {
                    const url = linkFor(t);
                    const related = relatedLabel(t);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: "var(--ink-100)" }}>
                        <button onClick={() => t.status !== "COMPLETED" && complete.mutate(t.id)} disabled={t.status === "COMPLETED"}>
                          {t.status === "COMPLETED" ? <CheckSquare size={16} style={{ color: "var(--ledger-600)" }} /> : <Square size={16} style={{ color: "var(--ink-300)" }} />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium" style={{ textDecoration: t.status === "COMPLETED" ? "line-through" : "none" }}>{t.subject}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--ink-400)" }}>
                            {t.dueDate && <span>{formatDate(t.dueDate)}</span>}
                            {related && url && <Link to={url} style={{ color: "var(--ledger-700)" }}>{related}</Link>}
                          </div>
                        </div>
                        {t.owner && <Badge>{t.owner.firstName} {t.owner.lastName}</Badge>}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>
      {showNew && <NewTaskModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
