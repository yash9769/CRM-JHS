import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useClickOutside } from "../hooks/useClickOutside";
import { Button, Badge } from "./ui";
import type { StageApproval } from "../lib/types";
import { ApprovalReviewModal } from "./ApprovalReviewModal";
import { Clock, ChevronDown, ShieldAlert, Eye, XCircle } from "lucide-react";

export function StageApprovalsWidget() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<StageApproval | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  useClickOutside(rootRef, open, () => setOpen(false));

  const { data: stageData } = useQuery<{ data: StageApproval[] }>({
    queryKey: ["stage-approvals", "pending"],
    queryFn: async () => (await api.get("/opportunities/approvals/pending")).data,
    refetchInterval: 10000,
  });

  const { data: delData } = useQuery<{ data: any[] }>({
    queryKey: ["account-deletion-requests", "pending"],
    queryFn: async () => (await api.get("/accounts/deletion-requests", { params: { status: "PENDING" } })).data,
    refetchInterval: 10000,
  });

  const approvals = stageData?.data || [];
  const accountDeletions = delData?.data || [];
  const count = approvals.length + accountDeletions.length;

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/opportunities/approvals/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
    },
  });

  const disapproveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/opportunities/approvals/${id}/disapprove`, { approverComment: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["opportunity"] });
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/opportunities/approvals/${id}/cancel`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
    },
  });

  const approveAccountDeletionMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/accounts/deletion-requests/${requestId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const rejectAccountDeletionMutation = useMutation({
    mutationFn: (requestId: string) => api.post(`/accounts/deletion-requests/${requestId}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["account-deletion-requests"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const isPartner = user?.orgRole === "PARTNER" || user?.orgRole === "SENIOR_PARTNER";

  if (!count && !isPartner) return null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--gold-50)] text-[var(--gold-800)] border border-[var(--gold-200)] hover:bg-[var(--gold-100)] transition-all shadow-xs"
      >
        <Clock size={14} className="text-[var(--gold-600)]" />
        <span>Approvals</span>
        {count > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--gold-600)] text-white">
            {count}
          </span>
        )}
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border shadow-xl bg-white border-[var(--ink-100)] z-50 overflow-hidden">
          <div className="p-3 bg-[var(--ink-50)] border-b border-[var(--ink-100)] flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-[var(--ink-800)]">
              <ShieldAlert size={15} className="text-[var(--ledger-600)]" />
              <span>Pending Approvals ({count})</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-xs text-[var(--ink-400)] hover:text-[var(--ink-700)]">
              ✕
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--ink-100)]">
            {!count ? (
              <div className="p-6 text-center text-xs text-[var(--ink-400)]">
                No pending approval requests.
              </div>
            ) : (
              <>
                {/* Account Deletion Requests */}
                {accountDeletions.map((delReq) => (
                  <div key={delReq.id} className="p-3 space-y-2 hover:bg-[var(--ink-50)] transition-colors bg-rose-50/40">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs text-rose-900">
                          Account Deletion: "{delReq.accountName || delReq.account?.name}"
                        </div>
                        <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
                          Requested by{" "}
                          <span className="font-medium text-[var(--ink-700)]">
                            {delReq.requestedBy ? `${delReq.requestedBy.firstName} ${delReq.requestedBy.lastName}` : "Manager"}
                          </span>
                        </div>
                        <div className="text-[11px] italic text-[var(--ink-600)] mt-1 bg-white p-1.5 rounded border border-rose-100">
                          "{delReq.reason}"
                        </div>
                      </div>
                      <Badge tone="rose">Deletion</Badge>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {isPartner && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => approveAccountDeletionMutation.mutate(delReq.id)}
                          disabled={approveAccountDeletionMutation.isPending}
                        >
                          Approve Delete
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => rejectAccountDeletionMutation.mutate(delReq.id)}
                        disabled={rejectAccountDeletionMutation.isPending}
                      >
                        {delReq.requestedById === user?.id && !isPartner ? "Revoke" : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Stage Approvals */}
                {approvals.map((appr) => (
                  <div key={appr.id} className="p-3 space-y-2 hover:bg-[var(--ink-50)] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-xs text-[var(--ledger-800)]">
                          {appr.opportunity?.name || "Opportunity"}
                        </div>
                        <div className="text-[11px] text-[var(--ink-500)]">
                          Requested by{" "}
                          <span className="font-medium text-[var(--ink-700)]">
                            {appr.requestedBy ? `${appr.requestedBy.firstName} ${appr.requestedBy.lastName}` : "Manager"}
                          </span>
                        </div>
                      </div>
                      <Badge tone="amber">Pending</Badge>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs bg-white p-2 rounded border border-[var(--ink-100)]">
                      <span className="text-[var(--ink-500)] line-through">{appr.fromStage?.name || "Old Stage"}</span>
                      <span className="text-[var(--ink-400)]">→</span>
                      <span className="font-bold text-[var(--ledger-700)]">{appr.toStage?.name || "Target Stage"}</span>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {appr.requestedById === user?.id && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => revokeMutation.mutate(appr.id)}
                          disabled={revokeMutation.isPending}
                        >
                          <XCircle size={13} /> Revoke
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedApproval(appr)}
                      >
                        <Eye size={13} /> Review Request
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {selectedApproval && (
        <ApprovalReviewModal
          approval={selectedApproval}
          onApprove={async (id) => {
            await approveMutation.mutateAsync(id);
          }}
          onDisapprove={async (id, reason) => {
            await disapproveMutation.mutateAsync({ id, reason });
          }}
          onClose={() => setSelectedApproval(null)}
          isSubmitting={approveMutation.isPending || disapproveMutation.isPending}
        />
      )}
    </div>
  );
}
