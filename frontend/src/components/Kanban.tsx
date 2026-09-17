import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate, initials } from "../lib/format";
import { computeOpportunityFinancials } from "../lib/financial";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { ApprovalRequestModal } from "./ApprovalRequestModal";
import { getStageTheme } from "../lib/stageThemes";
import {
  Building2,
  User,
  Calendar,
  Clock,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface KanbanItem {
  id: string;
  name: string;
  amount: string;
  expectedOpportunityValue?: string | number | null;
  actualOpportunityValue?: string | number | null;
  bottomLineCost?: string | number | null;
  expectedMargin?: string | number | null;
  grossMargin?: string | number | null;
  marginLoss?: string | number | null;
  stageId: string;
  closeDate?: string | null;
  expectedCloseDate?: string | null;
  createdAt?: string | null;
  probability: number;
  account?: { name: string } | null;
  contact?: { firstName: string; lastName: string } | null;
  contacts?: { contact: { firstName: string; lastName: string } }[] | null;
  owner?: { firstName: string; lastName: string } | null;
  stageApprovals?: any[];
}

export function KanbanBoard<T extends KanbanItem>({
  stages,
  items,
  basePath,
  onMove,
  visibleStageIds,
}: {
  stages: { id: string; name: string; isClosed: boolean; isWon: boolean; probability?: number }[];
  items: T[];
  basePath: string;
  onMove: (item: T, newStageId: string, extra?: { poNumber?: string; poValue?: string; lostReason?: string }) => void;
  visibleStageIds?: Set<string>;
}) {
  const { user } = useAuth();
  const isPartnerOrSenior = user?.orgRole === "PARTNER" || user?.orgRole === "SENIOR_PARTNER";

  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ item: T; targetStage: { id: string; name: string; isClosed: boolean; isWon: boolean } } | null>(null);
  const [terminalPoNumber, setTerminalPoNumber] = useState("");
  const [terminalPoValue, setTerminalPoValue] = useState("");
  const [terminalLostReason, setTerminalLostReason] = useState("");

  const [approvalMove, setApprovalMove] = useState<{ item: T; fromStage: { id: string; name: string }; targetStage: { id: string; name: string } } | null>(null);

  function handleDrop(targetStage: { id: string; name: string; isClosed: boolean; isWon: boolean }) {
    if (!dragId) return;
    const item = items.find((i) => i.id === dragId);
    if (!item || item.stageId === targetStage.id) {
      setDragId(null);
      return;
    }

    const currentStage = stages.find((s) => s.id === item.stageId);
    const isTargetApprovalStage = ["proposal", "quote", "negotiation", "closed won"].includes(targetStage.name.toLowerCase().trim());
    const requiresApproval = !isPartnerOrSenior && isTargetApprovalStage;

    if (requiresApproval && currentStage) {
      setApprovalMove({ item, fromStage: currentStage, targetStage });
    } else {
      setConfirmMove({ item, targetStage });
    }
    setDragId(null);
  }

  const displayedStages = visibleStageIds
    ? stages.filter((s) => visibleStageIds.has(s.id))
    : stages;

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-1 px-0.5">
        {displayedStages.map((stage) => {
          const stageItems = items.filter((i) => i.stageId === stage.id);
          const theme = getStageTheme(stage.name, stage.isWon, stage.isClosed);
          const Icon = theme.icon;

          const totalValue = stageItems.reduce((acc, i) => {
            const financials = computeOpportunityFinancials(i);
            const val = financials.actualOpportunityValue !== null
              ? financials.actualOpportunityValue
              : financials.expectedOpportunityValue !== null
              ? financials.expectedOpportunityValue
              : Number(i.amount || 0);
            return acc + (Number(val) || 0);
          }, 0);

          const weightedValue = stageItems.reduce((acc, i) => {
            const financials = computeOpportunityFinancials(i);
            const val = financials.actualOpportunityValue !== null
              ? financials.actualOpportunityValue
              : financials.expectedOpportunityValue !== null
              ? financials.expectedOpportunityValue
              : Number(i.amount || 0);
            const prob = (i.probability ?? stage.probability ?? 0) / 100;
            return acc + (Number(val) || 0) * prob;
          }, 0);

          const isOver = overStage === stage.id;

          return (
            <div
              key={stage.id}
              className={`w-80 shrink-0 rounded-2xl flex flex-col transition-all duration-200 border shadow-xs ${
                theme.columnBg
              } ${theme.borderColor} ${isOver ? theme.dropHighlight : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(stage.id);
              }}
              onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(stage);
              }}
            >
              {/* Colorful Top Accent Bar */}
              <div className={`h-1.5 w-full bg-gradient-to-r ${theme.accentGradient} rounded-t-2xl`} />

              {/* Column Header */}
              <div className="px-4 py-3.5 border-b border-black/[0.04]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-white shadow-xs border border-black/[0.06] text-[var(--ink-700)]">
                      <Icon size={14} className="shrink-0" />
                    </div>
                    <span className={`text-xs font-bold uppercase tracking-wider ${theme.titleColor}`}>
                      {stage.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold font-mono-num border shadow-2xs ${theme.badgeBg}`}>
                      {stageItems.length}
                    </span>
                    {stage.probability !== undefined && (
                      <span className="text-[10px] font-semibold text-[var(--ink-500)] px-1.5 py-0.5 rounded bg-white/80 border border-[var(--ink-200)]">
                        {stage.probability}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Stage Financial Totals Bar */}
                <div className="mt-2.5 pt-2 border-t border-black/[0.04] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-400)] block">Proposal Total</span>
                    <span className="font-mono-num font-bold text-sm text-[var(--ink-900)]">
                      {formatCurrency(totalValue)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-semibold text-[var(--ink-400)] block">Weighted</span>
                    <span className="font-mono-num font-semibold text-xs text-[var(--ledger-700)]">
                      {formatCurrency(weightedValue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cards Container */}
              <div className="p-3 space-y-3 min-h-[140px] flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
                {stageItems.map((item) => {
                  const contactPerson = item.contact
                    ? `${item.contact.firstName} ${item.contact.lastName}`
                    : (item.contacts && item.contacts[0]?.contact
                    ? `${item.contacts[0].contact.firstName} ${item.contacts[0].contact.lastName}`
                    : null);
                  const closeDate = item.expectedCloseDate || item.closeDate;
                  const pendingAppr = item.stageApprovals?.find((a: any) => a.status === "PENDING");
                  const financials = computeOpportunityFinancials(item);

                  const proposalVal = financials.actualOpportunityValue !== null
                    ? financials.actualOpportunityValue
                    : financials.expectedOpportunityValue !== null
                    ? financials.expectedOpportunityValue
                    : Number(item.amount || 0);

                  const marginVal = financials.marginValue;
                  const marginPct = financials.marginPercentage;
                  const isMarginNegative = marginVal !== null && marginVal < 0;

                  return (
                    <Link
                      key={item.id}
                      to={`${basePath}/${item.id}`}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      data-dragging={dragId === item.id}
                      className={`kanban-card group block rounded-xl p-3.5 bg-white shadow-xs hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing border border-[var(--ink-200)] hover:border-[var(--ledger-300)] relative overflow-hidden ${theme.cardLeftStripe}`}
                    >
                      {/* Top Account & Owner Initial Pill */}
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        {item.account ? (
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-600)] truncate">
                            <Building2 size={12} className="text-[var(--ledger-600)] shrink-0" />
                            <span className="truncate hover:text-[var(--ledger-700)]">{item.account.name}</span>
                          </div>
                        ) : (
                          <span />
                        )}

                        {item.owner && (
                          <div
                            title={`Owner: ${item.owner.firstName} ${item.owner.lastName}`}
                            className="w-5 h-5 rounded-full bg-[var(--ledger-100)] text-[var(--ledger-900)] text-[10px] font-bold flex items-center justify-center shrink-0 border border-[var(--ledger-200)]"
                          >
                            {initials(item.owner.firstName, item.owner.lastName)}
                          </div>
                        )}
                      </div>

                      {/* Opportunity Name */}
                      <div className="text-sm font-bold text-[var(--ink-900)] group-hover:text-[var(--ledger-700)] transition-colors line-clamp-2 mb-2.5">
                        {item.name}
                      </div>

                      {/* Financials Box */}
                      <div className="p-2.5 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-[var(--ink-500)]">Proposal Value:</span>
                          <span className="font-mono-num font-bold text-sm text-[var(--ink-950)]">
                            {formatCurrency(proposalVal)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-medium text-[var(--ink-400)]">Cost Incurred:</span>
                          <span className="font-mono-num font-medium text-[var(--ink-600)]">
                            {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
                          </span>
                        </div>

                        <div className="pt-1 border-t border-[var(--ink-200)] flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[var(--ink-500)]">Margin:</span>
                          <span
                            className={`font-mono-num font-bold px-1.5 py-0.5 rounded text-[11px] ${
                              marginVal === null
                                ? "bg-slate-100 text-slate-600"
                                : isMarginNegative
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {marginVal !== null ? formatCurrency(marginVal) : "—"}{" "}
                            {marginPct !== null && `(${marginPct.toFixed(1)}%)`}
                          </span>
                        </div>
                      </div>

                      {/* Pending Approval Badge */}
                      {pendingAppr && (
                        <div className="mt-2.5 p-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
                          <Clock size={12} className="text-amber-600 animate-spin" />
                          <span className="truncate">
                            Awaiting Review: {pendingAppr.toStage?.name || "Proposal"}
                          </span>
                        </div>
                      )}

                      {/* Card Footer: Contact & Close Date */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--ink-100)] flex items-center justify-between text-[11px] text-[var(--ink-500)]">
                        {contactPerson ? (
                          <div className="flex items-center gap-1 truncate max-w-[50%]" title={contactPerson}>
                            <User size={11} className="shrink-0 text-[var(--ink-400)]" />
                            <span className="truncate">{contactPerson}</span>
                          </div>
                        ) : (
                          <span />
                        )}

                        {closeDate && (
                          <div className="flex items-center gap-1 font-mono-num text-[10px] font-medium text-[var(--ink-600)]" title="Target Close Date">
                            <Calendar size={11} className="shrink-0 text-[var(--ink-400)]" />
                            <span>{formatDate(closeDate)}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terminal Stage Move Confirmation Modal */}
      {confirmMove && (
        <Modal
          title={
            confirmMove.targetStage.isWon
              ? `Mark as ${confirmMove.targetStage.name} 🎉`
              : confirmMove.targetStage.isClosed
              ? `Mark as ${confirmMove.targetStage.name}`
              : "Change Stage"
          }
          onClose={() => {
            setConfirmMove(null);
            setTerminalPoNumber("");
            setTerminalPoValue("");
            setTerminalLostReason("");
          }}
          width="460px"
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--ink-700)]">
              Are you sure you want to move <strong>"{confirmMove.item.name}"</strong> to{" "}
              <strong className="text-[var(--ledger-700)]">{confirmMove.targetStage.name}</strong>?
            </p>

            <div className="p-3.5 rounded-xl text-xs space-y-2 bg-[var(--ink-50)] border border-[var(--ink-100)]">
              <div className="flex justify-between">
                <span className="text-[var(--ink-500)] font-medium">Opportunity Value:</span>
                <span className="font-mono-num font-bold text-[var(--ink-900)]">{formatCurrency(confirmMove.item.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-500)] font-medium">Account:</span>
                <span className="font-semibold text-[var(--ink-800)]">{confirmMove.item.account?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--ink-500)] font-medium">Target Close Date:</span>
                <span className="font-mono-num">{formatDate(confirmMove.item.expectedCloseDate || confirmMove.item.closeDate)}</span>
              </div>
            </div>

            {confirmMove.targetStage.isWon && (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
                    Purchase Order (PO) Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    value={terminalPoNumber}
                    onChange={(e) => setTerminalPoNumber(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="e.g. PO-2026-9812"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
                    Final PO Value <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--ink-500)]">₹</span>
                    <input
                      type="number"
                      value={terminalPoValue}
                      onChange={(e) => setTerminalPoValue(e.target.value)}
                      className={`${inputClass} pl-8 font-mono-num`}
                      style={inputStyle}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            )}

            {confirmMove.targetStage.isClosed && !confirmMove.targetStage.isWon && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
                  Closed Lost / Dead Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={terminalLostReason}
                  onChange={(e) => setTerminalLostReason(e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-none`}
                  style={inputStyle}
                  placeholder="Explain why this opportunity was closed lost or cancelled…"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--ink-100)]">
              <Button
                variant="secondary"
                onClick={() => {
                  setConfirmMove(null);
                  setTerminalPoNumber("");
                  setTerminalPoValue("");
                  setTerminalLostReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant={confirmMove.targetStage.isWon ? "primary" : "secondary"}
                onClick={() => {
                  const extra = confirmMove.targetStage.isWon
                    ? { poNumber: terminalPoNumber, poValue: terminalPoValue }
                    : confirmMove.targetStage.isClosed
                    ? { lostReason: terminalLostReason }
                    : undefined;
                  onMove(confirmMove.item, confirmMove.targetStage.id, extra);
                  setConfirmMove(null);
                  setTerminalPoNumber("");
                  setTerminalPoValue("");
                  setTerminalLostReason("");
                }}
                disabled={
                  (confirmMove.targetStage.isWon && (!terminalPoNumber.trim() || !terminalPoValue.trim() || Number(terminalPoValue) <= 0)) ||
                  (confirmMove.targetStage.isClosed && !confirmMove.targetStage.isWon && !terminalLostReason.trim())
                }
              >
                Confirm Move
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Stage Approval Request Modal */}
      {approvalMove && (
        <ApprovalRequestModal
          opportunity={approvalMove.item}
          fromStage={approvalMove.fromStage}
          toStage={approvalMove.targetStage}
          onSubmit={async () => {
            await onMove(approvalMove.item, approvalMove.targetStage.id);
            setApprovalMove(null);
          }}
          onClose={() => setApprovalMove(null)}
        />
      )}
    </>
  );
}
