import { useState } from "react";
import { Modal } from "./ui";
import { relativeTime, formatCurrency } from "../lib/format";
import {
  History,
  User,
  Layers,
  ArrowRight,
  FileText,
  XCircle,
  ChevronDown,
  ChevronUp,
  Tag,
  Mail,
  Info
} from "lucide-react";

export interface AuditEntry {
  id: string;
  action: string;
  objectType?: string;
  recordId?: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; email?: string; orgRole?: string } | null;
}

export function AuditLogDetailModal({
  entry,
  onClose,
}: {
  entry: AuditEntry;
  onClose: () => void;
}) {
  const [showRawJson, setShowRawJson] = useState(false);

  const formattedDate = new Date(entry.createdAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });

  const roleLabel = entry.user?.orgRole?.replace("_", " ") || "USER";

  const getActionBadgeColor = (action: string) => {
    if (action.includes("APPROVED") || action === "CREATED") {
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
    if (action.includes("DISAPPROVED") || action.includes("REJECTED") || action === "DELETED") {
      return "bg-rose-50 text-rose-800 border-rose-200";
    }
    if (action.includes("REQUESTED")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    return "bg-blue-50 text-blue-800 border-blue-200";
  };

  const computeFieldDiffs = () => {
    const oldVals = entry.oldValues || {};
    const newVals = entry.newValues || {};

    const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));

    const excludedKeys = [
      "id", "tenantId", "updatedAt", "createdAt", "deletedAt", "archived",
      "stageName", "fromStageName", "toStageName", "passwordHash"
    ];

    const diffs: { field: string; label: string; oldVal: any; newVal: any }[] = [];

    for (const key of allKeys) {
      if (excludedKeys.includes(key)) continue;

      const oldV = oldVals[key];
      const newV = newVals[key];

      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        const label = key
          .replace(/([A-Z])/g, " $1")
          .replace(/^./, (str) => str.toUpperCase());

        diffs.push({
          field: key,
          label,
          oldVal: oldV,
          newVal: newV,
        });
      }
    }

    return diffs;
  };

  const diffs = computeFieldDiffs();

  const fromStage = entry.newValues?.fromStageName || entry.oldValues?.stageName || entry.oldValues?.stageId;
  const toStage = entry.newValues?.toStageName || entry.newValues?.stageName || entry.newValues?.toStage;
  const remarks = entry.newValues?.remarks || entry.newValues?.requesterComment || entry.newValues?.description;
  const approverComment = entry.newValues?.approverComment;
  const poNumber = entry.newValues?.poNumber || entry.oldValues?.poNumber;
  const poValue = entry.newValues?.poValue ?? entry.oldValues?.poValue;
  const loeValue = entry.newValues?.loeValue ?? entry.oldValues?.loeValue;

  return (
    <Modal title="Audit Log Entry Details" onClose={onClose} width="640px">
      <div className="space-y-4 text-xs">
        {/* ACTION & STATUS HEADER BANNER */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-sm shrink-0">
              <History size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[11px] font-bold uppercase rounded border ${getActionBadgeColor(entry.action)}`}>
                  {entry.action.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-slate-600 text-[11px] mt-1 font-medium truncate">
                {formattedDate} ({relativeTime(entry.createdAt)})
              </div>
            </div>
          </div>
        </div>

        {/* METADATA GRID: PERFORMER & OBJECT */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* USER / PERFORMER CARD */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <User size={13} className="text-slate-400" /> Performed By
            </div>
            <div className="font-bold text-slate-900 text-sm">
              {entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : "System Action"}
            </div>
            {entry.user && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                  {roleLabel}
                </span>
                {entry.user.email && (
                  <span className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                    <Mail size={11} /> {entry.user.email}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* RECORD / ENTITY CARD */}
          <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              <Layers size={13} className="text-slate-400" /> Target Record
            </div>
            <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                {entry.objectType || "RECORD"}
              </span>
            </div>
            {entry.recordId && (
              <div className="text-[11px] font-mono text-slate-500 truncate" title={entry.recordId}>
                ID: {entry.recordId}
              </div>
            )}
          </div>
        </div>

        {/* STAGE TRANSITION SUMMARY BOX */}
        {(fromStage || toStage) && (
          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 space-y-2">
            <div className="text-[11px] font-semibold text-indigo-900 uppercase tracking-wider">
              Stage Transition
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 shadow-sm">
                {fromStage || "Initial Stage"}
              </span>
              <ArrowRight size={14} className="text-indigo-500 shrink-0" />
              <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-sm">
                {toStage || "Target Stage"}
              </span>
            </div>
          </div>
        )}

        {/* APPROVAL REASON / DISAPPROVAL COMMENT */}
        {approverComment && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-1">
            <div className="font-bold text-xs flex items-center gap-1.5 text-rose-800">
              <XCircle size={15} /> Disapproval / Reviewer Reason
            </div>
            <div className="text-xs leading-relaxed italic bg-white/80 p-2.5 rounded-lg border border-rose-200">
              "{approverComment}"
            </div>
          </div>
        )}

        {/* REQUESTER REMARKS */}
        {remarks && !approverComment && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-700 text-[11px] flex items-center gap-1.5">
              <FileText size={13} /> Notes / Remarks
            </div>
            <div className="text-slate-800 text-xs leading-relaxed bg-white p-2 rounded border border-slate-200">
              {remarks}
            </div>
          </div>
        )}

        {/* PO & FINANCIAL HIGHLIGHTS */}
        {(poValue || poNumber || loeValue) && (
          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 grid grid-cols-2 gap-2 text-emerald-950">
            {poNumber && (
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">PO Number</span>
                <span className="font-semibold text-xs">{poNumber}</span>
              </div>
            )}
            {poValue && (
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">PO Value</span>
                <span className="font-bold text-xs text-emerald-900">{formatCurrency(Number(poValue))}</span>
              </div>
            )}
            {loeValue && (
              <div className="col-span-2">
                <span className="text-[10px] uppercase font-bold text-emerald-700 block">LOE / Attachment</span>
                <span className="font-medium text-xs">{String(loeValue)}</span>
              </div>
            )}
          </div>
        )}

        {/* DETAILED FIELD CHANGES TABLE */}
        <div className="space-y-1.5">
          <div className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
            <Tag size={13} className="text-slate-400" /> Changed Fields & Detailed Values
          </div>

          {diffs.length === 0 ? (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-[11px] italic flex items-center gap-1.5">
              <Info size={13} /> No specific field comparison available for this log action.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-700 font-semibold text-[11px]">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2 text-rose-700">Previous Value</th>
                    <th className="px-3 py-2 text-emerald-700">New Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {diffs.map((d) => (
                    <tr key={d.field} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                        {d.label}
                      </td>
                      <td className="px-3 py-2 text-rose-600 bg-rose-50/30 break-all font-mono text-[11px]">
                        {d.oldVal !== undefined && d.oldVal !== null ? (
                          typeof d.oldVal === "object" ? JSON.stringify(d.oldVal) : String(d.oldVal)
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-emerald-700 bg-emerald-50/30 break-all font-mono text-[11px] font-semibold">
                        {d.newVal !== undefined && d.newVal !== null ? (
                          typeof d.newVal === "object" ? JSON.stringify(d.newVal) : String(d.newVal)
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RAW JSON TOGGLE */}
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            {showRawJson ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showRawJson ? "Hide Raw Technical JSON" : "View Raw Technical JSON Payload"}
          </button>

          {showRawJson && (
            <div className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-200 font-mono text-[10px] space-y-2 overflow-x-auto max-h-60">
              <div>
                <span className="text-slate-400 font-bold block mb-1">// Log Action Metadata</span>
                <div>ID: {entry.id}</div>
                <div>Action: {entry.action}</div>
                <div>Created At: {entry.createdAt}</div>
              </div>
              {entry.oldValues && (
                <div>
                  <span className="text-rose-400 font-bold block mb-1">// Old Values</span>
                  <pre>{JSON.stringify(entry.oldValues, null, 2)}</pre>
                </div>
              )}
              {entry.newValues && (
                <div>
                  <span className="text-emerald-400 font-bold block mb-1">// New Values</span>
                  <pre>{JSON.stringify(entry.newValues, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
