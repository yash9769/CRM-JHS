import { useState } from "react";
import { Modal, Button, Badge } from "./ui";
import { formatCurrency, formatDate, relativeTime } from "../lib/format";
import type { StageApproval } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import { CheckCircle2, XCircle, ArrowRight, ShieldAlert, Calendar, Building2, User, Wallet } from "lucide-react";

interface ApprovalReviewModalProps {
  approval: StageApproval;
  onApprove: (id: string, comments?: string) => Promise<void>;
  onDisapprove: (id: string, reason: string) => Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function ApprovalReviewModal({
  approval,
  onApprove,
  onDisapprove,
  onClose,
  isSubmitting = false,
}: ApprovalReviewModalProps) {
  const { user } = useAuth();
  const [view, setView] = useState<"detail" | "approve_confirm" | "disapprove_form">("detail");
  const [disapproveReason, setDisapproveReason] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isSelf = user?.id === approval.requestedById;
  const opp = approval.opportunity;

  const handleConfirmApprove = async () => {
    try {
      setErrorMsg("");
      await onApprove(approval.id, approveComment.trim() || undefined);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || "Failed to approve request");
    }
  };

  const handleConfirmDisapprove = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = disapproveReason.trim();
    if (!cleanReason) {
      setErrorMsg("Reason for disapproval is required and cannot be empty.");
      return;
    }

    try {
      setErrorMsg("");
      await onDisapprove(approval.id, cleanReason);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || "Failed to disapprove request");
    }
  };

  return (
    <Modal
      title={
        view === "approve_confirm"
          ? "Confirm Stage Approval"
          : view === "disapprove_form"
          ? "Disapprove Stage Change"
          : "Opportunity Approval Review"
      }
      onClose={onClose}
      width="540px"
    >
      <div className="space-y-4 text-xs">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-[var(--rose-50)] text-[var(--rose-800)] border border-[var(--rose-200)] flex items-center gap-2">
            <XCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isSelf && (
          <div className="p-3 rounded-lg bg-[var(--gold-50)] text-[var(--gold-800)] border border-[var(--gold-200)] flex items-center gap-2 font-medium">
            <ShieldAlert size={16} className="shrink-0" />
            <span>You created this request. Requester cannot approve or disapprove their own request.</span>
          </div>
        )}

        {view === "detail" && (
          <>
            {/* Transition Badge Header */}
            <div className="p-3.5 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--ink-400)] tracking-wider mb-1">
                  Requested Stage Transition
                </div>
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span className="text-[var(--ink-600)]">{approval.fromStage?.name || "Current Stage"}</span>
                  <ArrowRight size={14} className="text-[var(--ink-400)]" />
                  <span className="px-2.5 py-0.5 rounded font-bold bg-[var(--ledger-100)] text-[var(--ledger-800)]">
                    {approval.toStage?.name || "Requested Stage"}
                  </span>
                </div>
              </div>
              <Badge tone={approval.status === "PENDING" ? "amber" : approval.status === "APPROVED" ? "green" : "rose"}>
                {approval.status}
              </Badge>
            </div>

            {/* Opportunity Summary Details */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-white border border-[var(--ink-100)]">
              <div>
                <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold">Opportunity</div>
                <div className="font-bold text-sm text-[var(--ink-900)]">{opp?.name || "Opportunity"}</div>
              </div>

              <div>
                <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold flex items-center gap-1">
                  <Wallet size={11} /> Opportunity Value
                </div>
                <div className="font-bold text-sm font-mono-num text-[var(--ink-900)]">
                  {formatCurrency(opp?.amount || 0)}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold flex items-center gap-1">
                  <Building2 size={11} /> Account
                </div>
                <div className="font-medium text-[var(--ink-800)]">{opp?.account?.name || "—"}</div>
              </div>

              <div>
                <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold flex items-center gap-1">
                  <User size={11} /> Account Owner / Assigned To
                </div>
                <div className="font-medium text-[var(--ink-800)]">
                  {opp?.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : "Unassigned"}
                </div>
              </div>

              {opp?.contact && (
                <div>
                  <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold">Contact Person</div>
                  <div className="font-medium text-[var(--ink-800)]">
                    {opp.contact.firstName} {opp.contact.lastName}
                  </div>
                </div>
              )}

              {opp?.expectedCloseDate && (
                <div>
                  <div className="text-[10px] text-[var(--ink-400)] uppercase font-semibold flex items-center gap-1">
                    <Calendar size={11} /> Close Date
                  </div>
                  <div className="font-medium font-mono-num text-[var(--ink-800)]">
                    {formatDate(opp.expectedCloseDate)}
                  </div>
                </div>
              )}
            </div>

            {/* Requester & Notes */}
            <div className="p-3 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)] space-y-1">
              <div className="flex items-center justify-between text-[11px] text-[var(--ink-500)]">
                <span>
                  Requested by:{" "}
                  <strong className="text-[var(--ink-800)]">
                    {approval.requestedBy ? `${approval.requestedBy.firstName} ${approval.requestedBy.lastName}` : "Sales User"}
                  </strong>
                </span>
                <span>{relativeTime(approval.createdAt)}</span>
              </div>
              {approval.requesterComment && (
                <div className="pt-1 text-xs italic text-[var(--ink-700)]">
                  "{approval.requesterComment}"
                </div>
              )}
            </div>

            {/* Closed Won Opportunity Details (LOE, PO Number, PO Value) */}
            {(approval.poNumber || approval.loeValue || approval.poValue !== null) && (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2">
                <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  <span>Closing Agreement Details</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-emerald-900">
                  {approval.loeValue && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-700">LOE (Effort)</div>
                      <div className="font-medium mt-0.5">{approval.loeValue} {approval.loeUnit || "Hours"}</div>
                    </div>
                  )}
                  {approval.poNumber && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-700">PO Number</div>
                      <div className="font-mono-num font-bold mt-0.5">{approval.poNumber}</div>
                    </div>
                  )}
                  {approval.poValue !== null && approval.poValue !== undefined && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-emerald-700">PO Value</div>
                      <div className="font-mono-num font-bold mt-0.5">{formatCurrency(approval.poValue)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Supporting Attachments */}
            {approval.attachments && approval.attachments.length > 0 && (
              <div className="p-3 rounded-xl bg-white border border-[var(--ink-200)] space-y-2">
                <div className="text-xs font-bold text-[var(--ink-800)]">
                  Supporting Documents ({approval.attachments.length})
                </div>
                <div className="divide-y divide-[var(--ink-100)]">
                  {approval.attachments.map((att: any) => (
                    <div key={att.id} className="py-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--ink-900)] truncate">{att.originalFilename}</span>
                      <span className="text-[10px] text-[var(--ink-400)] ml-2 shrink-0">
                        {Math.round(att.size / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Existing Disapproval Reason if available */}
            {approval.status === "DISAPPROVED" && approval.approverComment && (
              <div className="p-3 rounded-lg bg-[var(--rose-50)] border border-[var(--rose-200)] text-[var(--rose-900)]">
                <div className="font-semibold text-xs">Disapproval Reason:</div>
                <p className="mt-0.5 italic text-xs">"{approval.approverComment}"</p>
                <div className="mt-1 text-[10px] text-[var(--rose-700)]">
                  Reviewed by {approval.reviewedBy ? `${approval.reviewedBy.firstName} ${approval.reviewedBy.lastName}` : "Partner"}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {approval.status === "PENDING" && !isSelf && (
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--ink-100)]">
                <Button variant="secondary" onClick={() => setView("disapprove_form")}>
                  <XCircle size={14} className="text-rose-600" /> Disapprove
                </Button>
                <Button onClick={() => setView("approve_confirm")}>
                  <CheckCircle2 size={14} /> Approve Stage Change
                </Button>
              </div>
            )}
          </>
        )}

        {view === "approve_confirm" && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--ink-700)]">
              Are you sure you want to approve moving <strong>"{opp?.name}"</strong> from{" "}
              <strong>{approval.fromStage?.name}</strong> to <strong>{approval.toStage?.name}</strong>?
            </p>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-700)]">
                Optional Approver Note
              </label>
              <textarea
                value={approveComment}
                onChange={(e) => setApproveComment(e.target.value)}
                rows={2}
                placeholder="Add optional notes for the sales team..."
                className="w-full p-2.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--ledger-600)] border-[var(--ink-200)]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
              <Button variant="secondary" onClick={() => setView("detail")} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={handleConfirmApprove} disabled={isSubmitting}>
                {isSubmitting ? "Approving…" : "Confirm Approval"}
              </Button>
            </div>
          </div>
        )}

        {view === "disapprove_form" && (
          <form onSubmit={handleConfirmDisapprove} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1 text-[var(--ink-800)]">
                Reason for Disapproval <span className="text-rose-600">*</span>
              </label>
              <textarea
                value={disapproveReason}
                onChange={(e) => setDisapproveReason(e.target.value)}
                rows={4}
                required
                placeholder="Please explain why this request cannot be approved (e.g., pricing adjustment required, missing scope document)..."
                className="w-full p-2.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-rose-500 border-[var(--ink-200)] bg-white"
              />
              <p className="mt-1 text-[11px] text-[var(--ink-400)]">
                Disapproval reason is mandatory and will be communicated to the requester.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
              <Button variant="secondary" type="button" onClick={() => setView("detail")} disabled={isSubmitting}>
                Back
              </Button>
              <Button
                variant="secondary"
                type="submit"
                className="bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100"
                disabled={isSubmitting || !disapproveReason.trim()}
              >
                {isSubmitting ? "Disapproving…" : "Disapprove Request"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
