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
  user?: { id: string; firstName: string; lastName: string } | null;
}

const TRACKED_FIELDS = ["stageId", "stage", "ownerId", "amount", "status"];

function describeChange(entry: AuditEntry): string | null {
  if (entry.action === "CREATED") return "created this record";
  if (entry.action === "ARCHIVED") return "archived this record";
  if (entry.action === "UNARCHIVED") return "restored this record";
  if (entry.action === "DELETED") return "deleted this record";
  if (entry.action === "CONVERTED") return "converted this lead";
  if (entry.action.startsWith("BULK_")) return `bulk-updated ${entry.action.replace("BULK_", "").toLowerCase().replace("_", " ")}`;
  if (entry.action === "CONVERTED_TO_DEAL") return "converted this opportunity to a deal";
  if (entry.action === "UPDATED" && entry.oldValues && entry.newValues) {
    const changed = Object.keys(entry.newValues).filter(
      (k) => TRACKED_FIELDS.includes(k) && JSON.stringify(entry.oldValues![k]) !== JSON.stringify(entry.newValues![k])
    );
    if (!changed.length) return "updated this record";
    return `changed ${changed.join(", ")}`;
  }
  return entry.action.toLowerCase().replace("_", " ");
}

export function HistoryPanel({ objectType, recordId }: { objectType: string; recordId: string }) {
  const { data, isLoading } = useQuery<{ data: AuditEntry[] }>({
    queryKey: ["audit-log", objectType, recordId],
    queryFn: async () => (await api.get("/audit-log", { params: { objectType, recordId } })).data,
  });

  if (isLoading) return <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading history…</div>;
  if (!data?.data.length) return <div className="text-sm" style={{ color: "var(--ink-400)" }}>No history yet.</div>;

  return (
    <div className="space-y-3">
      {data.data.map((entry) => (
        <div key={entry.id} className="flex items-start gap-2.5 text-sm">
          <History size={13} className="mt-0.5 shrink-0" style={{ color: "var(--ink-300)" }} />
          <div>
            <div>
              <span className="font-medium">{entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "System"}</span>{" "}
              <span style={{ color: "var(--ink-500)" }}>{describeChange(entry)}</span>
            </div>
            <div className="text-xs mt-0.5" style={{ color: "var(--ink-400)" }}>{relativeTime(entry.createdAt)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
