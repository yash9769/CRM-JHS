import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, Badge, StageBadge } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { NewContactModal, LogActivityModal, NewQuoteModal, AddLineItemModal } from "../components/CreateModals";
import { EditOpportunityModal, ArchiveConfirmModal } from "../components/EditModals";
import { formatCurrency, formatDate } from "../lib/format";
import type { Opportunity, Pipeline } from "../lib/types";
import {
  ArrowRight, CheckCircle2, Building2, User, Pencil, UserPlus,
  PhoneCall, Archive, FileText, Plus, Trash2, Download
} from "lucide-react";

function Stepper({ stages, currentStageId }: { stages: Pipeline["stages"]; currentStageId: string }) {
  const currentIdx = stages.findIndex((s) => s.id === currentStageId);
  return (
    <div className="flex items-center overflow-x-auto py-1 gap-1">
      {stages.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
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
            </div>
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
  const [modal, setModal] = useState<"edit" | "contact" | "log" | "archive" | "lineItem" | "quote" | null>(null);

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
    mutationFn: (stageId: string) => api.patch(`/opportunities/${id}`, { stageId, pipelineId: opp!.pipelineId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", id] }),
  });

  if (isLoading || !opp) return <div className="p-8 text-sm text-[var(--ink-400)]">Loading…</div>;

  const contactPerson = opp.contact || (opp.contacts && opp.contacts[0]?.contact) || null;
  const accountOwner = opp.account?.owner || null;

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-6xl mx-auto space-y-5 pb-24 md:pb-8">
      {/* Header */}
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
              {formatCurrency(opp.amount)}
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
          <Button variant="secondary" onClick={() => setModal("contact")}><UserPlus size={14} /> Contact</Button>
          <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log</Button>
          <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <Card className="p-4">
        <Stepper stages={opp.pipeline!.stages} currentStageId={opp.stageId} />
        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-[var(--ink-100)]">
          <span className="text-xs font-medium text-[var(--ink-500)]">Move Opportunity Stage to:</span>
          <select
            value={opp.stageId}
            onChange={(e) => stageMutation.mutate(e.target.value)}
            className="text-sm px-2.5 py-1.5 rounded-md border font-medium bg-white border-[var(--ink-200)] min-h-[38px]"
          >
            {opp.pipeline!.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.probability}%)
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left / Primary Column */}
        <div className="lg:col-span-2 space-y-5">
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
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Value</dt>
                <dd className="mt-1 font-mono-num font-bold text-base text-[var(--ledger-700)]">
                  {formatCurrency(opp.amount)}
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
                <dd className="mt-1 text-[var(--ink-700)]">
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
                <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Type</dt>
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
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wider text-[var(--ink-400)]">Lost Reason</dt>
                  <dd className="mt-1 text-[var(--ink-700)]">{opp.lostReason}</dd>
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
          </Card>

          {/* Line Items (Products) */}
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

          {/* Quotes */}
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

          {/* Associated Contacts */}
          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--ink-800)]">Associated Contacts</h3>
              <Button size="sm" variant="secondary" onClick={() => setModal("contact")}>
                <UserPlus size={13} /> Add Contact
              </Button>
            </div>
            {!opp.contacts?.length && !opp.contact ? (
              <div className="text-sm text-[var(--ink-400)] py-2">No contacts linked yet.</div>
            ) : (
              <div className="space-y-2">
                {opp.contact && (
                  <Link
                    to={`/contacts/${opp.contact.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-[var(--ink-100)] hover:bg-[var(--ink-50)] transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm text-[var(--ink-900)]">
                        {opp.contact.firstName} {opp.contact.lastName}
                        <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--ledger-100)] text-[var(--ledger-700)]">
                          Primary Contact
                        </span>
                      </div>
                      <div className="text-xs text-[var(--ink-500)]">{[opp.contact.jobTitle, opp.contact.email, opp.contact.phone].filter(Boolean).join(" · ")}</div>
                    </div>
                  </Link>
                )}
                {opp.contacts?.filter((c) => c.contact.id !== opp.contactId).map(({ contact: c }) => (
                  <Link
                    key={c.id}
                    to={`/contacts/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-[var(--ink-100)] hover:bg-[var(--ink-50)] transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm text-[var(--ink-900)]">{c.firstName} {c.lastName}</div>
                      <div className="text-xs text-[var(--ink-500)]">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(" · ")}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right / Activity Column */}
        <div>
          <Card className="p-4 md:p-5 lg:sticky lg:top-5">
            <h3 className="text-sm font-semibold mb-3 text-[var(--ink-800)]">Activity & Notes</h3>
            <Timeline
              activities={opp.activities}
              notes={opp.notes}
              assoc={{ objectType: "OPPORTUNITY", opportunityId: opp.id }}
              queryKeysToInvalidate={[["opportunity", id]]}
            />
          </Card>
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
    </div>
  );
}
