import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { relativeTime } from "../lib/format";
import { History, ExternalLink } from "lucide-react";
import { AuditLogDetailModal, type AuditEntry } from "./AuditLogDetailModal";

const TRACKED_FIELDS = ["stageId", "stage", "ownerId", "amount", "actualDealValue", "bottomLineCost", "poNumber", "poValue", "loeValue", "remarks"];

function describeChange(entry: AuditEntry): string {
  if (entry.action === "CREATED") return "created this record";
  if (entry.action === "STAGE_CHANGED") {
    const from = entry.newValues?.fromStageName || entry.oldValues?.stageName;
    const to = entry.newValues?.toStageName || entry.newValues?.stageName;
    if (from && to) return `changed stage from "${from}" to "${to}"`;
    if (to) return `changed stage to "${to}"`;
    return "updated stage";
  }
  if (entry.action === "STAGE_APPROVAL_REQUESTED") {
    const to = entry.newValues?.toStageName || entry.newValues?.stageName;
    return to ? `submitted Partner stage approval request for "${to}"` : "submitted stage approval request";
  }
  if (entry.action === "STAGE_APPROVAL_APPROVED" || entry.action === "APPROVED") {
    const to = entry.newValues?.toStage || entry.newValues?.toStageName;
    return to ? `approved stage change request to "${to}"` : "approved stage change request";
  }
  if (entry.action === "STAGE_APPROVAL_DISAPPROVED" || entry.action === "REJECTED" || entry.action === "DISAPPROVED") {
    const comment = entry.newValues?.approverComment;
    return comment ? `disapproved stage change request (Reason: "${comment}")` : "disapproved stage change request";
  }
  if (entry.action === "ARCHIVED") return "archived this record";
  if (entry.action === "UNARCHIVED") return "restored this record";
  if (entry.action === "DELETED") return "deleted this record";
  if (entry.action.startsWith("BULK_")) return `bulk-updated ${entry.action.replace("BULK_", "").toLowerCase().replace("_", " ")}`;
  if (entry.action === "UPDATED" && entry.oldValues && entry.newValues) {
    const changed = Object.keys(entry.newValues).filter(
      (k) => TRACKED_FIELDS.includes(k) && JSON.stringify(entry.oldValues![k]) !== JSON.stringify(entry.newValues![k])
    );
    if (!changed.length) return "updated record details";
    return `updated ${changed.map(c => c.replace(/([A-Z])/g, ' $1').toLowerCase()).join(", ")}`;
  }
  return entry.action.toLowerCase().replace(/_/g, " ");
}

export function HistoryPanel({ objectType, recordId, fallbackHistory }: { objectType: string; recordId: string; fallbackHistory?: any[] }) {
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);

  const { data, isLoading } = useQuery<{ data: AuditEntry[] }>({
    queryKey: ["audit-log", objectType, recordId],
    queryFn: async () => (await api.get("/audit-log", { params: { objectType, recordId } })).data,
  });

  if (isLoading) return <div className="text-xs text-[var(--ink-400)] py-2">Loading audit history…</div>;

  const entries = data?.data && data.data.length > 0
    ? data.data
    : (fallbackHistory && fallbackHistory.length > 0
        ? fallbackHistory.map((h: any) => ({
            id: h.id || Math.random().toString(),
            action: "STAGE_CHANGED",
            objectType: objectType,
            recordId: recordId,
            newValues: { fromStageName: h.fromStage?.name, toStageName: h.toStage?.name },
            createdAt: h.changedAt || h.createdAt || new Date().toISOString(),
            user: h.user || h.changedBy || null,
          }))
        : []);

  if (!entries.length) return <div className="text-xs text-[var(--ink-400)] py-2">No activity audit logs recorded yet.</div>;

  return (
    <div className="space-y-2.5">
      {entries.map((entry) => {
        const roleLabel = entry.user?.orgRole?.replace("_", " ") || "";
        return (
          <div
            key={entry.id}
            onClick={() => setSelectedEntry({ ...entry, objectType, recordId })}
            className="flex items-start gap-2.5 text-xs p-2.5 rounded-lg bg-[var(--ink-50)]/70 border border-[var(--ink-100)] cursor-pointer hover:bg-slate-100 hover:border-[var(--ledger-400)] shadow-none hover:shadow-sm transition-all group relative"
            title="Click to view full audit log details"
          >
            <History size={14} className="mt-0.5 shrink-0 text-[var(--ledger-600)] group-hover:scale-110 transition-transform" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-0.5">
                <span className="font-semibold text-[var(--ink-900)] group-hover:text-[var(--ledger-700)] transition-colors">
                  {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "System Action"}
                </span>
                <div className="flex items-center gap-1.5">
                  {roleLabel && (
                    <span className="text-[10px] uppercase font-bold text-[var(--ledger-700)] bg-[var(--ledger-50)] px-1.5 py-0.5 rounded border border-[var(--ledger-200)]">
                      {roleLabel}
                    </span>
                  )}
                  <ExternalLink size={12} className="text-[var(--ink-400)] group-hover:text-[var(--ledger-600)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="text-[var(--ink-600)] font-medium">
                {describeChange(entry)}
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--ink-400)]">
                <span>{relativeTime(entry.createdAt)}</span>
                <span className="text-[var(--ledger-600)] font-semibold group-hover:underline">Click for log details ➔</span>
              </div>
            </div>
          </div>
        );
      })}

      {selectedEntry && (
        <AuditLogDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
