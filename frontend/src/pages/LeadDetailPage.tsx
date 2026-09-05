import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Badge, Button, Modal, Field, inputClass, inputStyle, BackButton } from "../components/ui";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchAccountOptions, fetchContactOptions, fetchOwnerOptions } from "../lib/pickers";
import { Timeline } from "../components/Timeline";
import { NewTaskModal } from "../components/CreateModals";
import { EditLeadModal } from "../components/EditModals";
import { HistoryPanel } from "../components/HistoryPanel";
import { formatDate, initials, relativeTime } from "../lib/format";
import type { Lead, Pipeline } from "../lib/types";
import { UserPlus, Phone, Mail, Building2, ArrowRightLeft, CheckSquare, Pencil } from "lucide-react";

const statusTone: Record<string, "neutral" | "green" | "amber" | "rose"> = {
  NEW: "neutral", CONTACTED: "amber", QUALIFIED: "green", NURTURING: "amber", UNQUALIFIED: "rose", CONVERTED: "green",
};

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer select-none">
      <span className="text-sm font-medium" style={{ color: "var(--ink-700)" }}>{label}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="w-9 h-5 rounded-full relative transition-colors disabled:opacity-40"
        style={{ background: checked ? "var(--ledger-600)" : "var(--ink-200)" }}
      >
        <span className="absolute top-0.5 w-4 h-4 rounded-full bg-[var(--surface-raised)] transition-all" style={{ left: checked ? 18 : 2 }} />
      </button>
    </label>
  );
}

function ConvertLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [createAccount, setCreateAccount] = useState(!lead.companyName ? false : true);
  const [createContact, setCreateContact] = useState(true);
  const [createOpportunity, setCreateOpportunity] = useState(false);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountLabel, setAccountLabel] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState(lead.companyName || "");

  const [contactId, setContactId] = useState<string | null>(null);
  const [contactLabel, setContactLabel] = useState<string | null>(null);

  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
    enabled: createOpportunity,
  });
  const pipeline = pipelines?.data[0];

  const [oppName, setOppName] = useState(`${lead.companyName || lead.firstName + " " + lead.lastName} — Opportunity`);
  const [oppAmount, setOppAmount] = useState("");
  const [oppStageId, setOppStageId] = useState("");
  const [oppOwnerId, setOppOwnerId] = useState<string | null>(lead.ownerId || null);
  const [oppOwnerLabel, setOppOwnerLabel] = useState<string | null>(lead.owner ? `${lead.owner.firstName} ${lead.owner.lastName}` : null);

  const stageId = oppStageId || pipeline?.stages.find((s) => !s.isClosed)?.id || "";

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/leads/${lead.id}/convert`, {
        createAccount: createAccount && !accountId,
        createContact,
        createOpportunity,
        accountId: accountId || undefined,
        newAccount: createAccount && !accountId ? { name: newAccountName } : undefined,
        contactId: contactId || undefined,
        opportunity: createOpportunity
          ? { name: oppName, amount: Number(oppAmount), pipelineId: pipeline!.id, stageId, ownerId: oppOwnerId! }
          : undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      onClose();
      if (res.data.opportunityId) navigate(`/opportunities/${res.data.opportunityId}`);
      else if (res.data.accountId) navigate(`/accounts/${res.data.accountId}`);
      else if (res.data.contactId) navigate(`/contacts/${res.data.contactId}`);
    },
  });

  const accountReady = !createAccount || accountId || newAccountName.trim().length > 0;
  const oppReady = !createOpportunity || (oppName && oppAmount && pipeline && oppOwnerId && (accountId || createAccount));
  const canSubmit = accountReady && oppReady && !mutation.isPending;

  return (
    <Modal title="Convert Lead" onClose={onClose} width="560px">
      <div className="mb-4 p-3 rounded-lg" style={{ background: "var(--ink-50)" }}>
        <div className="font-medium text-sm">{lead.firstName} {lead.lastName}</div>
        <div className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>{[lead.companyName, lead.email, lead.phone].filter(Boolean).join(" · ")}</div>
      </div>

      {mutation.isError && (
        <div className="text-sm mb-3 px-3 py-2 rounded-md" style={{ color: "var(--rose-600)", background: "var(--rose-100)" }}>
          {(mutation.error as any)?.response?.data?.error || "Could not convert this lead."}
        </div>
      )}

      <div className="divide-y" style={{ borderColor: "var(--ink-100)" }}>
        <ToggleRow label="Create Account" checked={createAccount} onChange={setCreateAccount} />
        <ToggleRow label="Create Contact" checked={createContact} onChange={setCreateContact} />
        <ToggleRow label="Create Opportunity" checked={createOpportunity} onChange={(v) => { setCreateOpportunity(v); if (v) setCreateAccount(true); }} />
      </div>

      {createAccount && (
        <div className="mt-4">
          <Field label="Account">
            <RelationshipSelector
              value={accountId} valueLabel={accountLabel}
              onChange={(id, opt) => { setAccountId(id); setAccountLabel(opt?.label || null); }}
              fetchOptions={fetchAccountOptions}
              placeholder={newAccountName ? `Search, or create "${newAccountName}"` : "Search companies…"}
              onCreateNew={() => setAccountId(null)}
            />
          </Field>
          {!accountId && (
            <Field label="New account name" required>
              <input required value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} className={inputClass} style={inputStyle} />
            </Field>
          )}
        </div>
      )}

      {createContact && (
        <div className="mt-2">
          <Field label="Contact">
            <RelationshipSelector
              value={contactId} valueLabel={contactLabel}
              onChange={(id, opt) => { setContactId(id); setContactLabel(opt?.label || null); }}
              fetchOptions={(s) => fetchContactOptions(s, accountId || undefined)}
              placeholder={`Leave blank to create "${lead.firstName} ${lead.lastName}"`}
            />
          </Field>
        </div>
      )}

      {createOpportunity && (
        <div className="mt-2 p-3 rounded-lg border" style={{ borderColor: "var(--ink-100)" }}>
          <Field label="Opportunity name" required>
            <input required value={oppName} onChange={(e) => setOppName(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount" required>
              <input required type="number" min="0.01" step="0.01" value={oppAmount} onChange={(e) => setOppAmount(e.target.value)} className={inputClass} style={inputStyle} />
            </Field>
            <Field label="Stage">
              <select value={stageId} onChange={(e) => setOppStageId(e.target.value)} className={inputClass} style={inputStyle}>
                {pipeline?.stages.filter((s) => !s.isClosed).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Owner" required>
            <RelationshipSelector
              value={oppOwnerId} valueLabel={oppOwnerLabel}
              onChange={(id, opt) => { setOppOwnerId(id); setOppOwnerLabel(opt?.label || null); }}
              fetchOptions={fetchOwnerOptions}
              placeholder="Search owner…"
            />
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-5">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>{mutation.isPending ? "Converting…" : "Convert Lead"}</Button>
      </div>
    </Modal>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const [showConvert, setShowConvert] = useState(false);
  const [showTask, setShowTask] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { data: lead, isLoading } = useQuery<Lead>({
    queryKey: ["lead", id],
    queryFn: async () => (await api.get(`/leads/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !lead) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>;

  const isConverted = lead.status === "CONVERTED";

  return (
    <div className="px-8 py-7 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: "var(--ink-600)" }}>
            {initials(lead.firstName, lead.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{lead.firstName} {lead.lastName}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
              <Badge tone={statusTone[lead.status]}>{lead.status.replace("_", " ")}</Badge>
              {lead.companyName && <span className="flex items-center gap-1"><Building2 size={12} /> {lead.companyName}</span>}
              {lead.owner && <span>Owner: {lead.owner.firstName} {lead.owner.lastName}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isConverted && <Button variant="secondary" onClick={() => setShowEdit(true)}><Pencil size={14} /> Edit</Button>}
          {!isConverted && <Button variant="secondary" onClick={() => setShowTask(true)}><CheckSquare size={14} /> Create Task</Button>}
          {!isConverted ? (
            <Button onClick={() => setShowConvert(true)}><ArrowRightLeft size={14} /> Convert Lead</Button>
          ) : (
            <Badge tone="green">Converted</Badge>
          )}
        </div>
      </div>

      {isConverted && (lead.convertedAccount || lead.convertedContact || lead.convertedOpportunity) && (
        <Card className="p-4 mb-5">
          <div className="text-xs uppercase font-medium mb-2" style={{ color: "var(--ink-400)" }}>Converted into</div>
          <div className="flex gap-4 text-sm">
            {lead.convertedAccount && <Link to={`/accounts/${lead.convertedAccount.id}`} style={{ color: "var(--ledger-700)" }}>Account: {lead.convertedAccount.name}</Link>}
            {lead.convertedContact && <Link to={`/contacts/${lead.convertedContact.id}`} style={{ color: "var(--ledger-700)" }}>Contact: {lead.convertedContact.firstName} {lead.convertedContact.lastName}</Link>}
            {lead.convertedOpportunity && <Link to={`/opportunities/${lead.convertedOpportunity.id}`} style={{ color: "var(--ledger-700)" }}>Opportunity: {lead.convertedOpportunity.name}</Link>}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5 col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Lead information</h3>
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <div className="flex items-start gap-1.5"><Phone size={13} className="mt-0.5" style={{ color: "var(--ink-400)" }} /><div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Phone</dt><dd className="mt-0.5">{lead.phone || "—"}</dd></div></div>
            <div className="flex items-start gap-1.5"><Mail size={13} className="mt-0.5" style={{ color: "var(--ink-400)" }} /><div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Email</dt><dd className="mt-0.5">{lead.email || "—"}</dd></div></div>
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Job title</dt><dd className="mt-0.5">{lead.jobTitle || "—"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Source</dt><dd className="mt-0.5">{lead.source || "—"}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Score</dt><dd className="mt-0.5 font-mono-num">{lead.score}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Created</dt><dd className="mt-0.5">{formatDate(lead.createdAt)} · {relativeTime(lead.createdAt)}</dd></div>
          </dl>
          {lead.notes && (
            <>
              <div className="text-xs mt-4 mb-1" style={{ color: "var(--ink-400)" }}>Notes</div>
              <p className="text-sm" style={{ color: "var(--ink-600)" }}>{lead.notes}</p>
            </>
          )}
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--ink-400)" }}><UserPlus size={13} /> Status</div>
          <div className="text-lg font-semibold">{lead.status.replace("_", " ")}</div>
        </Card>
      </div>

      <Card className="p-5 mt-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Activity</h3>
        <Timeline
          activities={lead.activities}
          notes={lead.notesList}
          assoc={{ objectType: "LEAD", leadId: lead.id }}
          queryKeysToInvalidate={[["lead", id]]}
        />
      </Card>

      <Card className="p-5 mt-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>History</h3>
        <HistoryPanel objectType="LEAD" recordId={lead.id} />
      </Card>

      {showConvert && <ConvertLeadModal lead={lead} onClose={() => setShowConvert(false)} />}
      {showEdit && <EditLeadModal lead={lead} onClose={() => setShowEdit(false)} />}
      {showTask && <NewTaskModal onClose={() => setShowTask(false)} context={{ objectType: "LEAD", leadId: lead.id, label: `${lead.firstName} ${lead.lastName}` }} />}
    </div>
  );
}
