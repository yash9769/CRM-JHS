import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, Badge, StageBadge } from "../components/ui";
import { NotesOnlyPanel } from "../components/NotesOnlyPanel";
import { ClosedWonModal } from "../components/ClosedWonModal";
import { ClosedLostModal } from "../components/ClosedLostModal";
import { NewContactModal, LogActivityModal, NewQuoteModal, AddLineItemModal } from "../components/CreateModals";
import { EditOpportunityModal, ArchiveConfirmModal } from "../components/EditModals";
import { formatCurrency, formatDate } from "../lib/format";
import { computeOpportunityFinancials } from "../lib/financial";
import type { Opportunity, Pipeline } from "../lib/types";
import { useAuth } from "../hooks/useAuth";
import { ApprovalRequestModal } from "../components/ApprovalRequestModal";
import { ApprovalReviewModal } from "../components/ApprovalReviewModal";
import {
  ArrowRight, CheckCircle2, Building2, User, Pencil, UserPlus,
  PhoneCall, Archive, FileText, Plus, Trash2, Download, Clock, ShieldAlert, RotateCcw,
  DollarSign, Info, ArrowDown, StickyNote, FileCheck
} from "lucide-react";

function Stepper({
  stages,
  currentStageId,
  onSelectStage,
}: {
  stages: Pipeline["stages"];
  currentStageId: string;
  onSelectStage: (stage: Pipeline["stages"][number]) => void;
}) {
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  return (
    <div className="flex items-center overflow-x-auto py-1 gap-1">
      {stages.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onSelectStage(s)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer hover:opacity-90 ${
                active
                  ? "bg-[var(--ledger-600)] text-white shadow-xs"
                  : done
                  ? "bg-[var(--ledger-50)] text-[var(--ledger-800)]"
                  : "bg-[var(--ink-50)] text-[var(--ink-500)]"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${
                  active ? "bg-white text-[var(--ledger-700)]" : done ? "bg-[var(--ledger-600)] text-white" : "bg-[var(--ink-200)] text-[var(--ink-600)]"
                }`}
              >
                {done ? <CheckCircle2 size={10} /> : i + 1}
              </div>
              <span className="whitespace-nowrap">{s.name}</span>
            </button>
            {i < stages.length - 1 && <ArrowRight size={12} className="mx-1 shrink-0 text-[var(--ink-300)]" />}
          </div>
        );
      })}
    </div>
  );
}

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isPartner = user?.orgRole === "PARTNER" || user?.orgRole === "SENIOR_PARTNER";

  const [modal, setModal] = useState<"edit" | "contact" | "log" | "archive" | "lineItem" | "quote" | null>(null);
  const [requestModalStage, setRequestModalStage] = useState<{ id: string; name: string } | null>(null);
  const [reviewModalApproval, setReviewModalApproval] = useState<any | null>(null);
  const [closedWonModalStageId, setClosedWonModalStageId] = useState<string | null>(null);
  const [closedLostModalStageId, setClosedLostModalStageId] = useState<string | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/opportunities/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      navigate("/opportunities");
    },
  });

  const deleteLineItemMutation = useMutation({
    mutationFn: (lineItemId: string) => api.delete(`/opportunities/${id}/line-items/${lineItemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", id] }),
  });

  const { data: opp, isLoading } = useQuery<Opportunity>({
    queryKey: ["opportunity", id],
    queryFn: async () => (await api.get(`/opportunities/${id}`)).data,
    enabled: !!id,
  });

  const stageMutation = useMutation({
    mutationFn: ({ stageId, remarks }: { stageId: string; remarks?: string }) =>
      api.patch(`/opportunities/${id}`, { stageId, pipelineId: opp!.pipelineId, remarks }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  const pendingApproval = opp?.stageApprovals?.find((a) => a.status === "PENDING");

  const approveMutation = useMutation({
    mutationFn: ({ approvalId, comments }: { approvalId: string; comments?: string }) =>
      api.post(`/opportunities/approvals/${approvalId}/approve`, { comments }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ approvalId, reason }: { approvalId: string; reason: string }) =>
      api.post(`/opportunities/approvals/${approvalId}/disapprove`, { approverComment: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["stage-approvals"] });
    },
  });

  if (isLoading || !opp) return <div className="p-8 text-sm text-[var(--ink-400)]">Loading opportunity…</div>;

  const financials = computeOpportunityFinancials(opp);
  const contactPerson = opp.contact || (opp.contacts && opp.contacts[0]?.contact) || null;
  const accountOwner = opp.account?.owner || null;

  const mv = financials.marginValue;
  const mp = financials.marginPercentage;
  const marginColorClass = mv !== null
    ? (mv > 0 ? "text-emerald-600 font-bold" : mv < 0 ? "text-rose-600 font-bold" : "text-slate-600 font-medium")
    : "text-slate-400";

  const handleStageSelect = (targetStage: any) => {
    if (!targetStage || targetStage.id === opp.stageId) return;

    const sName = targetStage.name.toLowerCase().trim();
    const isWon = (targetStage.isClosed && targetStage.isWon) || sName.includes("closed won") || sName === "won";
    const isLost = (targetStage.isClosed && !targetStage.isWon) || sName.includes("closed lost") || sName === "dead";
    const isApprovalStage = ["proposal", "quote", "negotiation", "closed won"].some((x) => sName.includes(x));

    if (isWon) {
      setClosedWonModalStageId(targetStage.id);
    } else if (isLost) {
      setClosedLostModalStageId(targetStage.id);
    } else if (!isPartner && isApprovalStage) {
      setRequestModalStage(targetStage);
    } else {
      stageMutation.mutate({ stageId: targetStage.id });
    }
  };

  return (
    <div className="pb-24 md:pb-12">
      {/* 1. FROZEN / STICKY PRICING DETAILS ROW */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[var(--ink-200)] shadow-xs px-4 md:px-8 py-2.5">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--ink-500)] flex items-center gap-1.5">
              <DollarSign size={14} className="text-[var(--ledger-600)]" /> Pricing Details:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
            <div>
              <span className="text-[var(--ink-400)] font-medium mr-1.5">Expected Deal Value:</span>
              <span className="font-mono-num font-bold text-slate-900">
                {financials.expectedDealValue !== null ? formatCurrency(financials.expectedDealValue) : formatCurrency(opp.amount)}
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-400)] font-medium mr-1.5">Topline Value:</span>
              <span className="font-mono-num font-bold text-slate-900">
                {financials.actualDealValue !== null ? formatCurrency(financials.actualDealValue) : "—"}
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-400)] font-medium mr-1.5">Cost Incurred:</span>
              <span className="font-mono-num font-medium text-slate-600">
                {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-400)] font-medium mr-1.5">Margin Value:</span>
              <span className={`font-mono-num ${marginColorClass}`}>
                {mv !== null ? formatCurrency(mv) : "—"}
              </span>
            </div>

            <div>
              <span className="text-[var(--ink-400)] font-medium mr-1.5">Margin %:</span>
              <span className={`font-mono-num ${marginColorClass}`}>
                {mp !== null ? `${mp.toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-5 max-w-6xl mx-auto space-y-5">
        {/* Pending Approval Alert Banner */}
        {pendingApproval && (
          <div className="p-4 rounded-xl bg-[var(--gold-50)] border border-[var(--gold-300)] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[var(--gold-100)] flex items-center justify-center shrink-0">
                <Clock size={20} className="text-[var(--gold-700)]" />
              </div>
              <div>
                <div className="font-bold text-sm text-[var(--gold-950)]">
                  Stage Change Pending Partner Approval
                </div>
                <div className="text-xs text-[var(--gold-800)]">
                  <span className="font-medium">
                    {pendingApproval.requestedBy ? `${pendingApproval.requestedBy.firstName} ${pendingApproval.requestedBy.lastName}` : "Manager"}
                  </span>{" "}
                  requested stage move from{" "}
                  <span className="line-through">{pendingApproval.fromStage?.name || "Current Stage"}</span> to{" "}
                  <span className="font-bold">{pendingApproval.toStage?.name || "Target Stage"}</span>.
                </div>
              </div>
            </div>
            {isPartner ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReviewModalApproval(pendingApproval)}
                >
                  <ShieldAlert size={14} className="text-[var(--ledger-600)]" /> Review Request
                </Button>
              </div>
            ) : (
              <Badge tone="amber">Awaiting Partner Approval</Badge>
            )}
          </div>
        )}

        {/* Header Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs mb-1.5 text-[var(--ink-400)]">
              <Link to={`/accounts/${opp.account?.id}`} className="flex items-center gap-1 font-medium hover:underline text-[var(--ledger-700)]">
                <Building2 size={13} /> {opp.account?.name}
              </Link>
              {contactPerson && (
                <>
                  <span>·</span>
                  <Link to={`/contacts/${contactPerson.id}`} className="flex items-center gap-1 hover:underline">
                    <User size={12} /> {contactPerson.firstName} {contactPerson.lastName}
                  </Link>
                </>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--ink-900)]">
              {opp.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs md:text-sm text-[var(--ink-600)]">
              <span className="font-mono-num text-base md:text-lg font-bold text-[var(--ledger-800)]">
                {financials.expectedDealValue !== null ? formatCurrency(financials.expectedDealValue) : formatCurrency(opp.amount)}
              </span>
              <span>·</span>
              <span className="font-medium">Assigned to: {opp.owner?.firstName} {opp.owner?.lastName}</span>
              <span>·</span>
              <span>Created: {formatDate(opp.createdAt)}</span>
              {opp.expectedCloseDate && (
                <>
                  <span>·</span>
                  <span className="font-medium">Expected Close: {formatDate(opp.expectedCloseDate)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
            <Button variant="secondary" onClick={() => setModal("contact")}><UserPlus size={14} /> Add Contact</Button>
            <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log Activity</Button>
            <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
          </div>
        </div>

        {/* Pipeline Stepper */}
        <Card className="p-4">
          <Stepper
            stages={opp.pipeline!.stages}
            currentStageId={opp.stageId}
            onSelectStage={handleStageSelect}
          />
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-[var(--ink-100)]">
            <span className="text-xs font-medium text-[var(--ink-500)]">Change Opportunity Stage to:</span>
            <select
              value={opp.stageId}
              onChange={(e) => {
                const target = opp.pipeline!.stages.find((s) => s.id === e.target.value);
                if (target) handleStageSelect(target);
              }}
              className="text-sm px-2.5 py-1.5 rounded-md border font-medium bg-white border-[var(--ink-200)] min-h-[38px]"
            >
              {opp.pipeline!.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left / Primary Column */}
          <div className="lg:col-span-2 space-y-5">
            {/* FIRST CARD: OPPORTUNITY DETAILS (with Associated Contacts inside) */}
            <Card className="p-4 md:p-5">
              <h3 className="text-sm font-semibold mb-4 pb-2 border-b border-[var(--ink-100)] text-[var(--ink-800)]">
                Opportunity Details
              </h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Opportunity Name</dt>
                  <dd className="mt-1 font-semibold text-[var(--ink-900)]">{opp.name}</dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Expected Deal Value</dt>
                  <dd className="mt-1 font-mono-num font-bold text-base text-[var(--ledger-700)]">
                    {financials.expectedDealValue !== null ? formatCurrency(financials.expectedDealValue) : formatCurrency(opp.amount)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Account</dt>
                  <dd className="mt-1">
                    {opp.account ? (
                      <Link to={`/accounts/${opp.account.id}`} className="font-medium text-[var(--ledger-700)] hover:underline flex items-center gap-1.5">
                        <Building2 size={13} /> {opp.account.name}
                      </Link>
                    ) : "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Account Owner</dt>
                  <dd className="mt-1 text-[var(--ink-700)] font-medium">
                    {accountOwner ? `${accountOwner.firstName} ${accountOwner.lastName}` : "—"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Forecast Category</dt>
                  <dd className="mt-1">
                    <Badge tone={opp.forecastCategory === "CLOSED_WON" ? "green" : opp.forecastCategory === "CLOSED_LOST" ? "rose" : "neutral"}>
                      {opp.forecastCategory || "PIPELINE"}
                    </Badge>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Deal Type</dt>
                  <dd className="mt-1 font-medium text-[var(--ink-800)]">
                    {opp.dealType || opp.opportunityType || "NEW_BUSINESS"}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Stage</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <StageBadge stage={opp.stage as any} />
                    <span className="text-xs font-mono-num text-[var(--ink-400)]">({opp.stage.probability}%)</span>
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Assigned To</dt>
                  <dd className="mt-1 font-medium text-[var(--ink-800)]">
                    {opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : "—"}
                  </dd>
                </div>

                {opp.loeValue && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">LOE (Level of Effort)</dt>
                    <dd className="mt-1 font-medium text-[var(--ink-800)]">{opp.loeValue} {opp.loeUnit || "Hours"}</dd>
                  </div>
                )}

                {opp.poNumber && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">PO Number</dt>
                    <dd className="mt-1 font-mono-num font-semibold text-[var(--ink-800)]">{opp.poNumber}</dd>
                  </div>
                )}

                {opp.poValue !== null && opp.poValue !== undefined && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">PO Value</dt>
                    <dd className="mt-1 font-mono-num font-bold text-[var(--ledger-700)]">{formatCurrency(opp.poValue)}</dd>
                  </div>
                )}

                {opp.actualCloseDate && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Actual Close Date</dt>
                    <dd className="mt-1 font-mono-num text-[var(--ink-700)]">{formatDate(opp.actualCloseDate)}</dd>
                  </div>
                )}

                {opp.wonDate && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Won Date</dt>
                    <dd className="mt-1 font-mono-num text-[var(--ledger-700)] font-semibold">{formatDate(opp.wonDate)}</dd>
                  </div>
                )}

                {opp.lostReason && (
                  <div className="sm:col-span-2 p-3 rounded-lg bg-rose-50 border border-rose-200">
                    <dt className="text-xs font-bold uppercase tracking-wider text-rose-800">Closed Lost Reason</dt>
                    <dd className="mt-1 text-sm text-rose-950 font-medium">{opp.lostReason}</dd>
                  </div>
                )}
              </dl>

              {opp.description && (
                <div className="mt-5 pt-4 border-t border-[var(--ink-100)]">
                  <h4 className="text-xs font-medium uppercase tracking-wider mb-1.5 text-[var(--ink-400)]">Remarks / Description</h4>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-[var(--ink-700)]">
                    {opp.description}
                  </p>
                </div>
              )}

              {/* ASSOCIATED CONTACTS SUB-SECTION (Moved inside First Card) */}
              <div className="mt-6 pt-5 border-t border-[var(--ink-100)]">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-700)] flex items-center gap-1.5">
                    <User size={13} className="text-[var(--ledger-600)]" /> Associated Contacts
                  </h4>
                  <Button size="sm" variant="secondary" onClick={() => setModal("contact")}>
                    <UserPlus size={12} /> Add Contact
                  </Button>
                </div>

                {!opp.contacts?.length && !opp.contact ? (
                  <div className="text-xs text-[var(--ink-400)] py-3 text-center bg-[var(--ink-50)] rounded-lg">
                    No contacts associated with this opportunity yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {opp.contact && (
                      <Link
                        to={`/contacts/${opp.contact.id}`}
                        className="p-2.5 rounded-lg border border-[var(--ink-100)] hover:bg-[var(--ink-50)] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-[var(--ink-900)] flex items-center gap-1.5">
                            {opp.contact.firstName} {opp.contact.lastName}
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-[var(--ledger-100)] text-[var(--ledger-700)]">
                              Primary
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
                            {[opp.contact.jobTitle, opp.contact.email, opp.contact.phone].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </Link>
                    )}

                    {opp.contacts?.filter((c) => c.contact.id !== opp.contactId).map(({ contact: c }) => (
                      <Link
                        key={c.id}
                        to={`/contacts/${c.id}`}
                        className="p-2.5 rounded-lg border border-[var(--ink-100)] hover:bg-[var(--ink-50)] transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-[var(--ink-900)]">
                            {c.firstName} {c.lastName}
                          </div>
                          <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
                            {[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* PRICING DETAILS CARD */}
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--ink-100)]">
                <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ink-800)]">
                  <DollarSign size={16} className="text-[var(--ledger-700)]" /> Pricing Details
                </h3>
              </div>

              {/* Pricing breakdown hierarchy */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-700)]">
                      <span>Expected Deal Value</span>
                      <span title="Expected Deal Value is the commercial value expected before the deal is won." className="cursor-help text-[var(--ink-400)]"><Info size={12} /></span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-400)]">Primary expected revenue</div>
                  </div>
                  <div className="font-mono-num text-base font-bold text-[var(--ledger-800)]">
                    {financials.expectedDealValue !== null ? formatCurrency(financials.expectedDealValue) : formatCurrency(opp.amount)}
                  </div>
                </div>

                <div className="flex justify-center text-[var(--ink-300)] -my-1">
                  <ArrowDown size={14} />
                </div>

                <div className="p-3 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-700)]">
                      <span>Topline Value</span>
                      <span title="Topline Value is the actual revenue realized or agreed upon closing." className="cursor-help text-[var(--ink-400)]"><Info size={12} /></span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-400)]">Final agreed commercial revenue</div>
                  </div>
                  <div className="font-mono-num text-base font-bold text-slate-900">
                    {financials.actualDealValue !== null ? formatCurrency(financials.actualDealValue) : "—"}
                  </div>
                </div>

                <div className="flex justify-center text-[var(--ink-300)] -my-1">
                  <ArrowDown size={14} />
                </div>

                <div className="p-3 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-700)]">
                      <span>Cost Incurred to Company</span>
                      <span title="Cost Incurred to Company is the delivery, license, or bottom-line internal cost." className="cursor-help text-[var(--ink-400)]"><Info size={12} /></span>
                    </div>
                    <div className="text-[11px] text-[var(--ink-400)]">Internal delivery & resource cost</div>
                  </div>
                  <div className="font-mono-num text-base font-bold text-slate-700">
                    {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
                  </div>
                </div>

                <div className="flex justify-center text-[var(--ink-300)] -my-1">
                  <ArrowDown size={14} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-xl border bg-white border-[var(--ink-200)]">
                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-600)] mb-1">
                      <span>Margin Value</span>
                      <span title="Margin Value = Revenue - Cost Incurred to Company" className="cursor-help text-[var(--ink-400)]"><Info size={11} /></span>
                    </div>
                    <div className={`font-mono-num text-base ${marginColorClass}`}>
                      {mv !== null ? formatCurrency(mv) : "—"}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border bg-white border-[var(--ink-200)]">
                    <div className="flex items-center gap-1 text-xs font-semibold text-[var(--ink-600)] mb-1">
                      <span>Margin Percentage</span>
                      <span title="Margin Percentage = (Margin Value / Revenue) * 100" className="cursor-help text-[var(--ink-400)]"><Info size={11} /></span>
                    </div>
                    <div className={`font-mono-num text-base ${marginColorClass}`}>
                      {mp !== null ? `${mp.toFixed(1)}%` : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* ATTACHMENTS CARD */}
            {opp.attachments && opp.attachments.length > 0 && (
              <Card className="p-4 md:p-5">
                <h3 className="text-sm font-semibold mb-3 text-[var(--ink-800)] flex items-center gap-2">
                  <FileCheck size={16} className="text-emerald-600" /> Close Won Attachments
                </h3>
                <div className="divide-y divide-[var(--ink-100)]">
                  {opp.attachments.map((att: any) => (
                    <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-[var(--ink-900)]">{att.originalFilename}</div>
                        <div className="text-[10px] text-[var(--ink-400)]">
                          Uploaded by {att.uploadedBy ? `${att.uploadedBy.firstName} ${att.uploadedBy.lastName}` : "User"} on {formatDate(att.createdAt)} ({Math.round(att.size / 1024)} KB)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* STAGE CHANGE APPROVALS & HISTORY CARD */}
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--ink-100)]">
                <h3 className="text-sm font-semibold text-[var(--ink-800)] flex items-center gap-2">
                  <ShieldAlert size={16} className="text-[var(--ledger-600)]" /> Stage Change Approvals & History
                </h3>
                {opp.stageApprovals?.some((a) => a.status === "DISAPPROVED") && !pendingApproval && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const lastDisapproved = opp.stageApprovals?.find((a) => a.status === "DISAPPROVED");
                      if (lastDisapproved?.toStage) {
                        handleStageSelect(lastDisapproved.toStage);
                      }
                    }}
                  >
                    <RotateCcw size={13} /> Request Again
                  </Button>
                )}
              </div>

              {!opp.stageApprovals?.length ? (
                <div className="text-xs text-[var(--ink-400)] py-2">No stage change approval requests recorded for this opportunity yet.</div>
              ) : (
                <div className="space-y-3">
                  {opp.stageApprovals.map((appr) => {
                    const isDisapproved = appr.status === "DISAPPROVED";
                    const isApproved = appr.status === "APPROVED";
                    const isPending = appr.status === "PENDING";

                    return (
                      <div
                        key={appr.id}
                        className={`p-3 rounded-xl border space-y-2 text-xs transition-colors ${
                          isPending
                            ? "bg-[var(--gold-50)] border-[var(--gold-200)]"
                            : isDisapproved
                            ? "bg-[var(--rose-50)] border-[var(--rose-200)] text-[var(--rose-950)]"
                            : isApproved
                            ? "bg-[var(--ledger-50)] border-[var(--ledger-200)]"
                            : "bg-[var(--ink-50)] border-[var(--ink-100)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold flex items-center gap-2">
                              <span>{appr.fromStage?.name || "Stage"}</span>
                              <ArrowRight size={12} className="text-[var(--ink-400)]" />
                              <span className="font-bold">{appr.toStage?.name || "Stage"}</span>
                            </div>
                            <div className="text-[11px] text-[var(--ink-500)] mt-0.5">
                              Requested by <strong className="text-[var(--ink-800)]">{appr.requestedBy ? `${appr.requestedBy.firstName} ${appr.requestedBy.lastName}` : "User"}</strong> · {formatDate(appr.createdAt)}
                            </div>
                          </div>
                          <Badge tone={isPending ? "amber" : isApproved ? "green" : isDisapproved ? "rose" : "neutral"}>
                            {appr.status}
                          </Badge>
                        </div>

                        {appr.poNumber && (
                          <div className="text-[11px] bg-white/70 p-2 rounded border border-[var(--ink-100)] flex flex-wrap gap-3">
                            {appr.loeValue && <span><strong>LOE:</strong> {appr.loeValue} {appr.loeUnit || "Hours"}</span>}
                            <span><strong>PO Number:</strong> {appr.poNumber}</span>
                            {appr.poValue && <span><strong>PO Value:</strong> {formatCurrency(appr.poValue)}</span>}
                          </div>
                        )}

                        {appr.requesterComment && (
                          <div className="text-[11px] italic text-[var(--ink-700)] bg-white/60 p-2 rounded">
                            Requester Note: "{appr.requesterComment}"
                          </div>
                        )}

                        {isDisapproved && (appr.approverComment || appr.comments) && (
                          <div className="p-2.5 rounded-lg bg-white border border-[var(--rose-200)] text-[var(--rose-900)]">
                            <div className="font-bold text-[11px] text-rose-800">Reason for Disapproval:</div>
                            <p className="mt-0.5 italic text-xs">"{appr.approverComment || appr.comments}"</p>
                            {appr.reviewedBy && (
                              <div className="mt-1 text-[10px] text-[var(--rose-700)] font-medium">
                                Reviewed by {appr.reviewedBy.firstName} {appr.reviewedBy.lastName} on {formatDate(appr.reviewedAt || appr.updatedAt)}
                              </div>
                            )}
                          </div>
                        )}

                        {isApproved && (
                          <div className="text-[11px] text-[var(--ledger-800)] font-medium">
                            Approved by {appr.reviewedBy ? `${appr.reviewedBy.firstName} ${appr.reviewedBy.lastName}` : "Partner"} on {formatDate(appr.reviewedAt || appr.updatedAt)}
                          </div>
                        )}

                        {isPending && isPartner && (
                          <div className="pt-1 flex justify-end">
                            <Button size="sm" variant="secondary" onClick={() => setReviewModalApproval(appr)}>
                              Review Request
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* LINE ITEMS & PRODUCTS */}
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--ink-800)]">Line Items & Products</h3>
                <Button size="sm" variant="secondary" onClick={() => setModal("lineItem")}>
                  <Plus size={13} /> Add Product
                </Button>
              </div>
              {!opp.lineItems?.length ? (
                <div className="text-sm text-[var(--ink-400)] py-2">No line items added to this opportunity.</div>
              ) : (
                <div className="divide-y divide-[var(--ink-100)]">
                  {opp.lineItems.map((item) => (
                    <div key={item.id} className="py-2.5 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-[var(--ink-900)]">{item.product?.name || "Product"}</div>
                        <div className="text-xs text-[var(--ink-500)]">
                          Qty: {item.quantity} × {formatCurrency(item.unitPrice)}
                          {Number(item.discountPct) > 0 && ` (-${item.discountPct}% disc)`}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num font-semibold text-[var(--ledger-700)]">{formatCurrency(item.total)}</span>
                        <button
                          onClick={() => deleteLineItemMutation.mutate(item.id)}
                          className="text-[var(--ink-400)] hover:text-red-600 p-1"
                          title="Remove line item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* QUOTES */}
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--ink-800)]">Quotes</h3>
                <Button size="sm" variant="secondary" onClick={() => setModal("quote")}>
                  <FileText size={13} /> Create Quote
                </Button>
              </div>
              {!opp.quotes?.length ? (
                <div className="text-sm text-[var(--ink-400)] py-2">No quotes generated for this opportunity yet.</div>
              ) : (
                <div className="space-y-2">
                  {opp.quotes.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--ink-100)] bg-white text-sm">
                      <div>
                        <div className="font-medium text-[var(--ink-900)] flex items-center gap-2">
                          {q.quoteNumber}
                          <Badge tone={q.status === "ACCEPTED" ? "green" : q.status === "REJECTED" ? "rose" : "neutral"}>{q.status}</Badge>
                        </div>
                        <div className="text-xs text-[var(--ink-500)]">Created {formatDate(q.createdAt)}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num font-bold text-[var(--ledger-700)]">{formatCurrency(q.amount)}</span>
                        <a href={`/api/v1/quotes/${q.id}/pdf`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost"><Download size={13} /></Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: ONLY NOTES (Activity timeline removed from this side panel) */}
          <div>
            <Card className="p-4 md:p-5 lg:sticky lg:top-14">
              <h3 className="text-sm font-semibold mb-3 text-[var(--ink-800)] flex items-center gap-2">
                <StickyNote size={16} className="text-[var(--ledger-600)]" /> Notes
              </h3>
              <NotesOnlyPanel
                notes={opp.notes}
                assoc={{ objectType: "OPPORTUNITY", opportunityId: opp.id }}
                queryKeysToInvalidate={[["opportunity", id]]}
              />
            </Card>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "edit" && <EditOpportunityModal opp={opp} onClose={() => setModal(null)} />}
      {modal === "contact" && (
        <NewContactModal
          accountId={opp.accountId}
          accountName={opp.account?.name}
          onClose={() => setModal(null)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["opportunity", id] })}
        />
      )}
      {modal === "log" && (
        <LogActivityModal
          context={{ objectType: "OPPORTUNITY", opportunityId: opp.id, label: opp.name }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "lineItem" && (
        <AddLineItemModal
          opportunityId={opp.id}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["opportunity", id] })}
        />
      )}
      {modal === "quote" && (
        <NewQuoteModal
          opportunityId={opp.id}
          accountId={opp.accountId}
          onClose={() => setModal(null)}
          onSuccess={() => qc.invalidateQueries({ queryKey: ["opportunity", id] })}
        />
      )}
      {modal === "archive" && (
        <ArchiveConfirmModal
          title={`Opportunity "${opp.name}"`}
          onConfirm={() => archiveMutation.mutate()}
          onClose={() => setModal(null)}
          isPending={archiveMutation.isPending}
        />
      )}

      {/* Closed Won Transition Modal */}
      {closedWonModalStageId && (
        <ClosedWonModal
          opportunity={opp}
          targetStageId={closedWonModalStageId}
          onClose={() => setClosedWonModalStageId(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["opportunity", id] });
            qc.invalidateQueries({ queryKey: ["opportunities"] });
          }}
        />
      )}

      {/* Closed Lost Transition Modal */}
      {closedLostModalStageId && (
        <ClosedLostModal
          opportunity={opp}
          targetStageId={closedLostModalStageId}
          onClose={() => setClosedLostModalStageId(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["opportunity", id] });
            qc.invalidateQueries({ queryKey: ["opportunities"] });
          }}
        />
      )}

      {/* Approval Modals */}
      {requestModalStage && (
        <ApprovalRequestModal
          opportunity={opp}
          fromStage={opp.stage}
          toStage={requestModalStage}
          onSubmit={async (notes) => {
            await stageMutation.mutateAsync({ stageId: requestModalStage.id, remarks: notes });
            setRequestModalStage(null);
          }}
          onClose={() => setRequestModalStage(null)}
          isSubmitting={stageMutation.isPending}
        />
      )}

      {reviewModalApproval && (
        <ApprovalReviewModal
          approval={reviewModalApproval}
          onApprove={async (apprId, comments) => {
            await approveMutation.mutateAsync({ approvalId: apprId, comments });
            setReviewModalApproval(null);
          }}
          onDisapprove={async (apprId, reason) => {
            await rejectMutation.mutateAsync({ approvalId: apprId, reason });
            setReviewModalApproval(null);
          }}
          onClose={() => setReviewModalApproval(null)}
          isSubmitting={approveMutation.isPending || rejectMutation.isPending}
        />
      )}
    </div>
  );
}
