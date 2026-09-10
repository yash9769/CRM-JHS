import { useState } from "react";
import { Link } from "react-router-dom";
import { formatCurrency, formatDate } from "../lib/format";
import { computeOpportunityFinancials } from "../lib/financial";
import { Badge, Modal, Button, inputClass, inputStyle } from "./ui";
import { ApprovalRequestModal } from "./ApprovalRequestModal";
import { Building2, User, Calendar } from "lucide-react";
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
      <div className="flex gap-3 overflow-x-auto pb-4">
        {displayedStages.map((stage) => {
          const stageItems = items.filter((i) => i.stageId === stage.id);
          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 rounded-xl flex flex-col"
              style={{ background: "var(--ink-50)" }}
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
              <div className="px-3.5 py-3 flex items-center justify-between border-b" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-700)" }}>
                    {stage.name}
                  </span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-mono-num font-medium bg-white" style={{ color: "var(--ink-500)", border: "1px solid var(--ink-200)" }}>
                    {stageItems.length}
                  </span>
                </div>
              </div>
              <div className="px-3.5 py-1.5 text-xs font-mono-num font-semibold" style={{ color: "var(--ink-600)" }}>
                {(() => {
                  const weighted = stageItems.reduce((s, i) => {
                    const value = Number(i.expectedOpportunityValue ?? i.amount ?? 0);
                    const prob = (i.probability ?? stage.probability ?? 0) / 100;
                    return s + value * prob;
                  }, 0);
                  return formatCurrency(weighted);
                })()}
              </div>
              <div
                className="px-2.5 pb-3 space-y-2.5 min-h-[120px] flex-1 rounded-b-xl transition-colors overflow-y-auto max-h-[calc(100vh-280px)]"
                style={{ background: overStage === stage.id ? "var(--ledger-50)" : "transparent" }}
              >
                {stageItems.map((item) => {
                  const contactPerson = item.contact
                    ? `${item.contact.firstName} ${item.contact.lastName}`
                    : (item.contacts && item.contacts[0]?.contact ? `${item.contacts[0].contact.firstName} ${item.contacts[0].contact.lastName}` : null);
                  const closeDate = item.expectedCloseDate || item.closeDate;
                  const pendingAppr = item.stageApprovals?.find((a: any) => a.status === "PENDING");
                  const financials = computeOpportunityFinancials(item);

                  return (
                    <Link
                      key={item.id}
                      to={`${basePath}/${item.id}`}
                      draggable
                      onDragStart={() => setDragId(item.id)}
                      data-dragging={dragId === item.id}
                      className="kanban-card block rounded-lg p-3 bg-white shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing"
                      style={{ border: "1px solid var(--ink-100)" }}
                    >
                      {/* Opportunity Name */}
                      <div className="text-sm font-semibold mb-1 line-clamp-2" style={{ color: "var(--ink-900)" }}>
                        {item.name}
                      </div>

                      {/* Account */}
                      {item.account && (
                        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: "var(--ink-600)" }}>
                          <Building2 size={12} className="shrink-0" style={{ color: "var(--ink-400)" }} />
                          <span className="truncate">{item.account.name}</span>
                        </div>
                      )}

                      {/* Proposal Value, Cost Incurred, Margin */}
                      <div className="pt-2 border-t space-y-1" style={{ borderColor: "var(--ink-50)" }}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink-500)]">Proposal Value:</span>
                          <span className="font-mono-num font-bold text-sm text-[var(--ledger-800)]">
                            {financials.actualOpportunityValue !== null
                              ? formatCurrency(financials.actualOpportunityValue)
                              : financials.expectedOpportunityValue !== null
                              ? formatCurrency(financials.expectedOpportunityValue)
                              : formatCurrency(item.amount)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink-500)]">Cost Incurred to Company:</span>
                          <span className="font-mono-num font-medium text-[var(--ink-600)]">
                            {financials.bottomLineCost !== null ? formatCurrency(financials.bottomLineCost) : "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink-500)]">Margin Value:</span>
                          <span className={`font-mono-num font-bold ${financials.marginValue !== null && financials.marginValue < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                            {financials.marginValue !== null ? formatCurrency(financials.marginValue) : "—"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[var(--ink-500)]">Margin %:</span>
                          <span className={`font-mono-num font-bold ${financials.marginPercentage !== null && financials.marginPercentage < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                            {financials.marginPercentage !== null ? `${financials.marginPercentage.toFixed(1)}%` : "—"}
                          </span>
                        </div>

                        {pendingAppr ? (
                          <div className="pt-1">
                            <Badge tone="amber">
                              ⏳ Pending Approval: {pendingAppr.toStage?.name || "Proposal"}
                            </Badge>
                          </div>
                        ) : item.probability !== undefined ? (
                          <div className="flex justify-end pt-0.5">
                            <Badge tone={stage.isWon ? "green" : stage.isClosed ? "neutral" : undefined}>
                              {item.probability}%
                            </Badge>
                          </div>
                        ) : null}
                      </div>

                      {/* Contact Person & Close Date & Assigned To */}
                      <div className="mt-2.5 pt-2 border-t space-y-1 text-[11px]" style={{ borderColor: "var(--ink-50)", color: "var(--ink-500)" }}>
                        {contactPerson && (
                          <div className="flex items-center gap-1.5 truncate">
                            <User size={11} className="shrink-0" style={{ color: "var(--ink-400)" }} />
                            <span className="truncate">{contactPerson}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          {closeDate ? (
                            <span className="flex items-center gap-1 font-mono-num" title="Target Close Date">
                              <Calendar size={11} className="shrink-0" style={{ color: "var(--ink-400)" }} />
                              <span className="font-semibold text-[var(--ink-500)]">Close Date:</span> {formatDate(closeDate)}
                            </span>
                          ) : (
                            <span />
                          )}
                          {item.owner && (
                            <span className="font-medium px-1.5 py-0.5 rounded text-[10px]" style={{ background: "var(--ink-100)", color: "var(--ink-700)" }}>
                              {item.owner.firstName} {item.owner.lastName?.[0]}.
                            </span>
                          )}
                        </div>
                        {item.createdAt && (
                          <div className="flex items-center gap-1.5 font-mono-num text-[10px]" style={{ color: "var(--ink-400)" }}>
                            <span>Created:</span>
                            <span>{formatDate(item.createdAt)}</span>
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
          onClose={() => { setConfirmMove(null); setTerminalPoNumber(""); setTerminalPoValue(""); setTerminalLostReason(""); }}
          width="440px"
        >
          <div className="space-y-3">
            <p className="text-sm" style={{ color: "var(--ink-600)" }}>
              Are you sure you want to move <strong>"{confirmMove.item.name}"</strong> to{" "}
              <strong>{confirmMove.targetStage.name}</strong>?
            </p>
            <div className="p-3 rounded-lg text-xs space-y-1.5" style={{ background: "var(--ink-50)", color: "var(--ink-600)" }}>
              <div><strong>Opportunity Value:</strong> {formatCurrency(confirmMove.item.amount)}</div>
              <div><strong>Account:</strong> {confirmMove.item.account?.name || "—"}</div>
              <div><strong>Close Date:</strong> {formatDate(confirmMove.item.expectedCloseDate || confirmMove.item.closeDate)}</div>
            </div>

            {confirmMove.targetStage.isWon && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">PO Number <span className="text-rose-500">*</span></label>
                  <input
                    value={terminalPoNumber}
                    onChange={(e) => setTerminalPoNumber(e.target.value)}
                    className={inputClass}
                    style={inputStyle}
                    placeholder="PO-2026-001"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">PO Value <span className="text-rose-500">*</span></label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--ink-500)]">₹</span>
                    <input
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
                <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">Closed Lost / Dead Reason <span className="text-rose-500">*</span></label>
                <textarea
                  value={terminalLostReason}
                  onChange={(e) => setTerminalLostReason(e.target.value)}
                  rows={2}
                  className={inputClass}
                  style={{ ...inputStyle, minHeight: 60 }}
                  placeholder="Explain why this opportunity was closed lost or dead…"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="secondary" onClick={() => { setConfirmMove(null); setTerminalPoNumber(""); setTerminalPoValue(""); setTerminalLostReason(""); }}>
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
