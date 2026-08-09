import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, Badge, Modal, Field, inputClass, inputStyle } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { formatCurrency, formatDate } from "../lib/format";
import type { Opportunity, Pipeline } from "../lib/types";
import { ArrowRight, CheckCircle2, Building2 } from "lucide-react";

function Stepper({ stages, currentStageId }: { stages: Pipeline["stages"]; currentStageId: string }) {
  const openStages = stages.filter((s) => !s.isClosed || s.isWon);
  const currentIdx = openStages.findIndex((s) => s.id === currentStageId);
  return (
    <div className="flex items-center overflow-x-auto py-1">
      {openStages.map((s, i) => {
        const done = i < currentIdx || (i === currentIdx);
        const active = i === currentIdx;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            <div className="flex items-center gap-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
                style={{ background: done ? "var(--ledger-600)" : "var(--ink-100)", color: done ? "white" : "var(--ink-400)" }}
              >
                {done && !active ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              <span className="text-xs font-medium whitespace-nowrap" style={{ color: active ? "var(--ledger-700)" : "var(--ink-500)" }}>{s.name}</span>
            </div>
            {i < openStages.length - 1 && <ArrowRight size={13} className="mx-2 shrink-0" style={{ color: "var(--ink-200)" }} />}
          </div>
        );
      })}
    </div>
  );
}

function ConvertModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: dealPipelines } = useQuery<{ data: Pipeline[] }>({ queryKey: ["pipelines", "DEAL"], queryFn: async () => (await api.get("/pipelines", { params: { type: "DEAL" } })).data });
  const dealPipeline = dealPipelines?.data[0];
  const [dealStageId, setDealStageId] = useState("");
  const [closeDate, setCloseDate] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post(`/opportunities/${opp.id}/convert`, {
      dealPipelineId: dealPipeline!.id,
      dealStageId: dealStageId || dealPipeline!.stages[0].id,
      closeDate: closeDate ? new Date(closeDate).toISOString() : undefined,
    }),
    onSuccess: (res) => navigate(`/deals/${res.data.id}`),
  });

  if (!dealPipeline) return null;

  return (
    <Modal title="Convert to Deal" onClose={onClose}>
      <p className="text-sm mb-4" style={{ color: "var(--ink-600)" }}>
        This creates a Deal for <strong>{opp.account?.name}</strong> worth <strong>{formatCurrency(opp.amount)}</strong>.
        The account, contacts, amount, and owner carry over — this opportunity stays on record as the source.
      </p>
      <Field label="Deal stage">
        <select value={dealStageId} onChange={(e) => setDealStageId(e.target.value)} className={inputClass} style={inputStyle}>
          {dealPipeline.stages.filter((s) => !s.isClosed).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Expected close date">
        <input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} className={inputClass} style={inputStyle} />
      </Field>
      {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>Could not convert this opportunity.</div>}
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Converting…" : "Convert to Deal"}</Button>
      </div>
    </Modal>
  );
}

export default function OpportunityDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [showConvert, setShowConvert] = useState(false);

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

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--ink-400)" }}>
            <Link to={`/accounts/${opp.account?.id}`} className="flex items-center gap-1 hover:underline"><Building2 size={12} /> {opp.account?.name}</Link>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{opp.name}</h1>
          <div className="flex items-center gap-3 mt-1.5 text-sm" style={{ color: "var(--ink-500)" }}>
            <span className="font-mono-num text-base font-semibold" style={{ color: "var(--ink-900)" }}>{formatCurrency(opp.amount)}</span>
            <span>·</span>
            <span>{opp.probability}% probability</span>
            <span>·</span>
            <span>Owner: {opp.owner?.firstName} {opp.owner?.lastName}</span>
          </div>
        </div>
        {opp.isConverted ? (
          <Link to={`/deals/${opp.convertedDealId}`}>
            <Button variant="secondary"><Badge tone="green">Converted</Badge> View Deal</Button>
          </Link>
        ) : (
          <Button onClick={() => setShowConvert(true)}>Convert to Deal</Button>
        )}
      </div>

      <Card className="p-4 mb-5">
        <Stepper stages={opp.pipeline!.stages} currentStageId={opp.stageId} />
        {!opp.isConverted && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-xs" style={{ color: "var(--ink-400)" }}>Move to:</span>
            <select
              value={opp.stageId}
              onChange={(e) => stageMutation.mutate(e.target.value)}
              className="text-sm px-2 py-1 rounded-md border"
              style={{ borderColor: "var(--ink-200)" }}
            >
              {opp.pipeline!.stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5 col-span-2">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Contacts</h3>
          {!opp.contacts?.length ? (
            <div className="text-sm mb-5" style={{ color: "var(--ink-400)" }}>No contacts associated.</div>
          ) : (
            <div className="space-y-2 mb-5">
              {opp.contacts.map(({ contact: c }) => (
                <Link key={c.id} to={`/contacts/${c.id}`} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--ink-50)]" style={{ border: "1px solid var(--ink-100)" }}>
                  <span className="font-medium text-sm">{c.firstName} {c.lastName}</span>
                  <span className="text-xs" style={{ color: "var(--ink-400)" }}>{c.jobTitle}</span>
                </Link>
              ))}
            </div>
          )}

          {opp.description && (
            <>
              <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--ink-800)" }}>Description</h3>
              <p className="text-sm mb-5" style={{ color: "var(--ink-600)" }}>{opp.description}</p>
            </>
          )}

          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Stage history</h3>
          <div className="space-y-1.5">
            {opp.stageHistory?.map((h: any) => (
              <div key={h.id} className="text-xs flex items-center gap-2" style={{ color: "var(--ink-500)" }}>
                <span className="font-mono-num">{formatDate(h.changedAt)}</span>
                <span>Stage changed</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Activity</h3>
          <Timeline
            activities={opp.activities}
            notes={opp.notes}
            assoc={{ objectType: "OPPORTUNITY", opportunityId: opp.id }}
            queryKeysToInvalidate={[["opportunity", id]]}
          />
        </Card>
      </div>

      {showConvert && <ConvertModal opp={opp} onClose={() => setShowConvert(false)} />}
    </div>
  );
}
