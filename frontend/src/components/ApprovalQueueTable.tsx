import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatDate, relativeTime } from "../lib/format";
import { Button, Badge } from "./ui";
import { useAuth } from "../hooks/useAuth";
import type { StageApproval } from "../lib/types";
import { ApprovalReviewModal } from "./ApprovalReviewModal";
import { ShieldAlert, Search, Filter, ArrowRight, Eye, XCircle, Clock, CheckCircle2 } from "lucide-react";

export function ApprovalQueueTable({ limit }: { limit?: number }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selectedApproval, setSelectedApproval] = useState<StageApproval | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [requestedStageFilter, setRequestedStageFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const { data, isLoading } = useQuery<{ data: StageApproval[] }>({
    queryKey: ["stage-approvals", statusFilter, requestedStageFilter, search],
    queryFn: async () =>
      (
        await api.get("/opportunities/approvals/pending", {
          params: {
            status: statusFilter,
            requestedStage: requestedStageFilter || undefined,
            search: search || undefined,
          },
        })
      ).data,
  });

  const { data: counts } = useQuery<{ pending: number; approved: number }>({
    queryKey: ["stage-approvals", "counts"],
    queryFn: async () => (await api.get("/opportunities/approvals/counts")).data,
  });

  const approvals = data?.data || [];
  const displayedApprovals = limit ? approvals.slice(0, limit) : approvals;

  const approveMutation = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments?: string }) => {
      await api.post(`/opportunities/approvals/${id}/approve`, { comments });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const disapproveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/opportunities/approvals/${id}/disapprove`, { approverComment: reason });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/opportunities/approvals/${id}/cancel`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  return (
    <div className="space-y-3">
      {/* Pending / Approved counts */}
      {counts && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[var(--ink-100)] shadow-xs">
            <Clock size={14} className="text-[var(--gold-600)]" />
            <span className="text-xs text-[var(--ink-500)]">Pending:</span>
            <span className="font-mono-num font-bold text-sm">{counts.pending}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-[var(--ink-100)] shadow-xs">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-xs text-[var(--ink-500)]">Approved:</span>
            <span className="font-mono-num font-bold text-sm">{counts.approved}</span>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-[var(--ink-100)] shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opportunity or account..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--ledger-600)] border-[var(--ink-200)] bg-[var(--ink-50)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={13} className="text-[var(--ink-400)]" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs outline-none border-[var(--ink-200)] bg-white font-medium"
          >
            <option value="PENDING">Status: Pending</option>
            <option value="APPROVED">Status: Approved</option>
            <option value="DISAPPROVED">Status: Disapproved</option>
            <option value="CANCELLED">Status: Cancelled</option>
            <option value="all">Status: All</option>
          </select>

          <select
            value={requestedStageFilter}
            onChange={(e) => setRequestedStageFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs outline-none border-[var(--ink-200)] bg-white font-medium"
          >
            <option value="">All Requested Stages</option>
            <option value="Proposal">Proposal</option>
            <option value="Quote">Quote</option>
            <option value="Negotiation">Negotiation</option>
            <option value="Closed Won">Closed Won</option>
          </select>
        </div>
      </div>

      {/* List view */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-[var(--ink-400)] bg-white rounded-xl border border-[var(--ink-100)]">
          Loading approval requests…
        </div>
      ) : displayedApprovals.length === 0 ? (
        <div className="p-8 text-center space-y-1 bg-white rounded-xl border border-[var(--ink-100)]">
          <ShieldAlert size={24} className="mx-auto text-[var(--ink-300)]" />
          <div className="text-xs font-semibold text-[var(--ink-700)]">No approval requests found</div>
          <div className="text-[11px] text-[var(--ink-400)]">
            {statusFilter === "PENDING"
              ? "No pending stage change requests requiring review."
              : "No matching approval history."}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayedApprovals.map((appr) => {
            const opp = appr.opportunity;
            const canRevoke = appr.status === "PENDING" && appr.requestedById === user?.id;
            return (
              <div
                key={appr.id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-[var(--ink-100)] shadow-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-[var(--ink-900)] truncate">{opp?.name || "Opportunity"}</span>
                    {opp?.account?.name && (
                      <span className="text-xs text-[var(--ink-500)]">· {opp.account.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs mt-1 font-medium">
                    <span className="text-[var(--ink-500)] line-through">{appr.fromStage?.name || "Old"}</span>
                    <ArrowRight size={12} className="text-[var(--ink-400)]" />
                    <span className="font-bold text-[var(--ledger-700)] px-1.5 py-0.5 rounded bg-[var(--ledger-50)] border border-[var(--ledger-100)]">
                      {appr.toStage?.name || "New"}
                    </span>
                    <span className="font-mono-num text-[var(--ink-700)] ml-2">{formatCurrency(opp?.amount || 0)}</span>
                  </div>
                  <div className="text-[11px] text-[var(--ink-400)] mt-1">
                    Requested by {appr.requestedBy ? `${appr.requestedBy.firstName} ${appr.requestedBy.lastName}` : "User"} · {relativeTime(appr.createdAt)} ({formatDate(appr.createdAt)})
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {appr.status !== "PENDING" && (
                    <Badge tone={appr.status === "APPROVED" ? "green" : appr.status === "CANCELLED" ? "neutral" : "rose"}>
                      {appr.status}
                    </Badge>
                  )}
                  {appr.status === "PENDING" && (
                    <Button size="sm" variant="secondary" onClick={() => setSelectedApproval(appr)}>
                      <Eye size={12} /> Review
                    </Button>
                  )}
                  {canRevoke && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => revokeMutation.mutate(appr.id)}
                      disabled={revokeMutation.isPending}
                    >
                      <XCircle size={12} /> Revoke
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedApproval && (
        <ApprovalReviewModal
          approval={selectedApproval}
          onApprove={async (id, comments) => {
            await approveMutation.mutateAsync({ id, comments });
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
