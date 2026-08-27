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
  return null;
}

function relatedLabel(task: any): string | null {
  return task.lead ? `${task.lead.firstName} ${task.lead.lastName}` :
    task.account?.name || (task.contact ? `${task.contact.firstName} ${task.contact.lastName}` : null) ||
    task.opportunity?.name || null;
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
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Tasks"
        subtitle="Everything you and your team need to follow up on."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Task
            </Button>
          </div>
        }
      />
      <div className="px-4 md:px-8 pb-8">
        <div className="flex gap-1 mb-5 rounded-md p-0.5 w-fit bg-[var(--ink-100)]">
          {(["mine", "team"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 rounded text-xs font-medium ${scope === s ? "bg-white text-[var(--ink-900)] shadow-xs" : "text-[var(--ink-600)]"}`}>
              {s === "mine" ? "My Tasks" : "Team Tasks"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm text-[var(--ink-400)]">Loading…</div>
        ) : !data?.data.length ? (
          <Card><EmptyState title="No tasks yet" subtitle="Create a task from here or from any lead, account, or opportunity." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Task</Button>} /></Card>
        ) : (
          <div className="space-y-6">
            {BUCKETS.map((b) => grouped[b].length > 0 && (
              <div key={b}>
                <div className={`text-xs uppercase font-semibold mb-2 ${b === "Overdue" ? "text-[var(--rose-600)]" : "text-[var(--ink-400)]"}`}>{b} ({grouped[b].length})</div>
                <Card>
                  {grouped[b].map((t) => {
                    const url = linkFor(t);
                    const related = relatedLabel(t);
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0 border-[var(--ink-100)]">
                        <button onClick={() => t.status !== "COMPLETED" && complete.mutate(t.id)} disabled={t.status === "COMPLETED"}>
                          {t.status === "COMPLETED" ? <CheckSquare size={16} className="text-[var(--ledger-600)]" /> : <Square size={16} className="text-[var(--ink-300)]" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${t.status === "COMPLETED" ? "line-through text-[var(--ink-400)]" : "text-[var(--ink-900)]"}`}>{t.subject}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-2 text-[var(--ink-400)]">
                            {t.dueDate && <span>{formatDate(t.dueDate)}</span>}
                            {related && url && <Link to={url} className="text-[var(--ledger-700)] hover:underline">{related}</Link>}
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
