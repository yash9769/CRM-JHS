import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, Badge, StageBadge } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { NewContactModal, LogActivityModal } from "../components/CreateModals";
import { EditOpportunityModal, ArchiveConfirmModal } from "../components/EditModals";
import { formatCurrency, formatDate } from "../lib/format";
import type { Opportunity, Pipeline } from "../lib/types";
import {
  ArrowRight, CheckCircle2, Building2, User, Pencil, UserPlus,
  PhoneCall, Archive,
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
  const [modal, setModal] = useState<"edit" | "contact" | "log" | "archive" | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/opportunities/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      navigate("/opportunities");
    },
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

  if (isLoading || !opp) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>;

  const contactPerson = opp.contact || (opp.contacts && opp.contacts[0]?.contact) || null;
  const accountOwner = opp.account?.owner || null;

  return (
    <div className="px-8 py-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: "var(--ink-400)" }}>
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
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--ink-900)" }}>
            {opp.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm" style={{ color: "var(--ink-600)" }}>
            <span className="font-mono-num text-lg font-bold" style={{ color: "var(--ledger-800)" }}>
              {formatCurrency(opp.amount)}
            </span>
            <span>·</span>
            <span className="font-medium">Assigned to: {opp.owner?.firstName} {opp.owner?.lastName}</span>
            <span>·</span>
            <span>Created: {formatDate(opp.createdAt)}</span>
            {opp.expectedCloseDate && (
              <>
                <span>·</span>
                <span className="font-medium">Close Date: {formatDate(opp.expectedCloseDate)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {opp.isConverted ? (
            <Link to={`/deals/${opp.convertedDealId}`}>
              <Button variant="secondary"><Badge tone="green">Converted</Badge> View Deal</Button>
            </Link>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
              <Button variant="secondary" onClick={() => setModal("contact")}><UserPlus size={14} /> Create Contact</Button>
              <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log</Button>
              <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
            </>
          )}
        </div>
      </div>

      {/* Pipeline Stepper */}
      <Card className="p-4 mb-5">
        <Stepper stages={opp.pipeline!.stages} currentStageId={opp.stageId} />
        {!opp.isConverted && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--ink-500)" }}>Move Opportunity Stage to:</span>
            <select
              value={opp.stageId}
              onChange={(e) => stageMutation.mutate(e.target.value)}
              className="text-sm px-2.5 py-1 rounded-md border font-medium bg-white"
              style={{ borderColor: "var(--ink-200)" }}
            >
              {opp.pipeline!.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.probability}%)
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      {/* Two Column Layout: Primary Fields & Activity/Timeline */}
      <div className="grid grid-cols-3 gap-5">
        {/* Left Column: Key Opportunity Details */}
        <div className="col-span-2 space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4 pb-2 border-b" style={{ color: "var(--ink-800)", borderColor: "var(--ink-100)" }}>
              Opportunity Details
            </h3>
            <dl className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Opportunity Name</dt>
                <dd className="mt-1 font-semibold" style={{ color: "var(--ink-900)" }}>{opp.name}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Opportunity Value</dt>
                <dd className="mt-1 font-mono-num font-bold text-base" style={{ color: "var(--ledger-700)" }}>
                  {formatCurrency(opp.amount)}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Account</dt>
                <dd className="mt-1">
                  {opp.account ? (
                    <Link to={`/accounts/${opp.account.id}`} className="font-medium text-[var(--ledger-700)] hover:underline flex items-center gap-1.5">
                      <Building2 size={13} /> {opp.account.name}
                    </Link>
                  ) : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Account Owner</dt>
                <dd className="mt-1" style={{ color: "var(--ink-700)" }}>
                  {accountOwner ? `${accountOwner.firstName} ${accountOwner.lastName}` : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Contact Person</dt>
                <dd className="mt-1">
                  {contactPerson ? (
                    <Link to={`/contacts/${contactPerson.id}`} className="font-medium text-[var(--ledger-700)] hover:underline flex items-center gap-1.5">
                      <User size={13} /> {contactPerson.firstName} {contactPerson.lastName}
                    </Link>
                  ) : (
                    <span style={{ color: "var(--ink-400)" }}>No contact person linked</span>
                  )}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Assigned To</dt>
                <dd className="mt-1 font-medium" style={{ color: "var(--ink-800)" }}>
                  {opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : "—"}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Opportunity Stage</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <StageBadge stage={opp.stage as any} />
                  <span className="text-xs font-mono-num" style={{ color: "var(--ink-400)" }}>({opp.stage.probability}%)</span>
                </dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Created Date</dt>
                <dd className="mt-1 font-mono-num" style={{ color: "var(--ink-700)" }}>{formatDate(opp.createdAt)}</dd>
              </div>

              <div>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--ink-400)" }}>Opportunity Close Date</dt>
                <dd className="mt-1 font-mono-num font-medium" style={{ color: "var(--ink-800)" }}>
                  {formatDate(opp.expectedCloseDate)}
                </dd>
              </div>
            </dl>

            {opp.description && (
              <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--ink-100)" }}>
                <h4 className="text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-400)" }}>Remarks</h4>
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-700)" }}>
                  {opp.description}
                </p>
              </div>
            )}
          </Card>

          {/* Contacts associated */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--ink-800)" }}>Associated Contacts</h3>
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-[var(--ink-50)] transition-colors"
                    style={{ borderColor: "var(--ink-100)" }}
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
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-[var(--ink-50)] transition-colors"
                    style={{ borderColor: "var(--ink-100)" }}
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

          {/* Stage History */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Stage History</h3>
            <div className="space-y-2">
              {opp.stageHistory?.map((h: any) => (
                <div key={h.id} className="text-xs flex items-center justify-between p-2 rounded bg-[var(--ink-50)]" style={{ color: "var(--ink-600)" }}>
                  <span className="font-medium">Stage updated to current pipeline status</span>
                  <span className="font-mono-num text-[var(--ink-400)]">{formatDate(h.changedAt)}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Activity & Timeline */}
        <div>
          <Card className="p-5 sticky top-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Activity & Notes</h3>
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
