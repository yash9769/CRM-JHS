import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { History } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; orgRole?: string } | null;
}

const TRACKED_FIELDS = ["stageId", "stage", "ownerId", "amount", "actualDealValue", "bottomLineCost", "poNumber", "poValue", "loeValue", "remarks"];

function describeChange(entry: AuditEntry): string {
  if (entry.action === "CREATED") return "created this opportunity";
  if (entry.action === "STAGE_CHANGED") return "updated opportunity stage";
  if (entry.action === "STAGE_APPROVAL_REQUESTED") return "submitted stage approval request";
  if (entry.action === "APPROVED") return "approved stage change request";
  if (entry.action === "REJECTED" || entry.action === "DISAPPROVED") return "disapproved stage change request";
  if (entry.action === "ARCHIVED") return "archived this opportunity";
  if (entry.action === "UNARCHIVED") return "restored this opportunity";
  if (entry.action === "DELETED") return "deleted this opportunity";
  if (entry.action.startsWith("BULK_")) return `bulk-updated ${entry.action.replace("BULK_", "").toLowerCase().replace("_", " ")}`;
  if (entry.action === "UPDATED" && entry.oldValues && entry.newValues) {
    const changed = Object.keys(entry.newValues).filter(
      (k) => TRACKED_FIELDS.includes(k) && JSON.stringify(entry.oldValues![k]) !== JSON.stringify(entry.newValues![k])
    );
    if (!changed.length) return "updated opportunity details";
    return `updated ${changed.map(c => c.replace(/([A-Z])/g, ' $1').toLowerCase()).join(", ")}`;
  }
  return entry.action.toLowerCase().replace(/_/g, " ");
}

export function HistoryPanel({ objectType, recordId }: { objectType: string; recordId: string }) {
  const { data, isLoading } = useQuery<{ data: AuditEntry[] }>({
    queryKey: ["audit-log", objectType, recordId],
    queryFn: async () => (await api.get("/audit-log", { params: { objectType, recordId } })).data,
  });

  if (isLoading) return <div className="text-xs text-[var(--ink-400)] py-2">Loading audit history…</div>;
  if (!data?.data?.length) return <div className="text-xs text-[var(--ink-400)] py-2">No activity audit logs recorded yet.</div>;

  return (
    <div className="space-y-2.5">
      {data.data.map((entry) => {
        const roleLabel = entry.user?.orgRole?.replace("_", " ") || "";
        return (
          <div key={entry.id} className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-[var(--ink-50)]/70 border border-[var(--ink-100)]">
            <History size={14} className="mt-0.5 shrink-0 text-[var(--ledger-600)]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-[var(--ink-900)]">
                  {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "System Action"}
                </span>
                {roleLabel && (
                  <span className="text-[10px] uppercase font-bold text-[var(--ledger-700)] bg-[var(--ledger-50)] px-1.5 py-0.5 rounded border border-[var(--ledger-200)]">
                    {roleLabel}
                  </span>
                )}
              </div>
              <div className="text-[var(--ink-600)] font-medium">
                {describeChange(entry)}
              </div>
              <div className="text-[10px] text-[var(--ink-400)] mt-1">
                {relativeTime(entry.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
