import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Modal, Field, Button, inputClass, inputStyle } from "./ui";
import { RelationshipSelector, type RelationshipOption } from "./RelationshipSelector";
import { fetchAccountOptions, fetchContactOptions, fetchOwnerOptions } from "../lib/pickers";
import { NewAccountModal, NewContactModal } from "./CreateModals";
import type { Account, Contact, Opportunity, Lead, Pipeline } from "../lib/types";
import { Info, IndianRupee } from "lucide-react";
import { formatCurrency } from "../lib/format";

export function ArchiveConfirmModal({
  title, impactUrl, onConfirm, onClose, isPending,
}: { title: string; impactUrl?: string; onConfirm: () => void; onClose: () => void; isPending?: boolean }) {
  const { data: impact } = useQuery<Record<string, number>>({
    queryKey: ["impact", impactUrl],
    queryFn: async () => (await api.get(impactUrl!)).data,
    enabled: !!impactUrl,
  });
  const entries = impact ? Object.entries(impact).filter(([, v]) => v > 0) : [];

  return (
    <Modal title={`Archive ${title}?`} onClose={onClose} width="440px">
      {entries.length > 0 && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-[var(--ink-50)]">
          <div className="mb-1.5 text-[var(--ink-500)]">This record has:</div>
          <ul className="space-y-0.5">
            {entries.map(([k, v]) => (
              <li key={k} className="font-medium">{v} {k}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm mb-4 text-[var(--ink-600)]">
        Archived records are hidden from lists but not deleted — you can restore this later.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} disabled={isPending}>{isPending ? "Archiving…" : "Archive"}</Button>
      </div>
    </Modal>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="text-xs mt-1 text-[var(--rose-600)]">{message}</div>;
}

function fieldErrorsFrom(err: any): Record<string, string> {
  const details = err?.response?.data?.details;
  const out: Record<string, string> = {};
  if (Array.isArray(details)) {
    for (const d of details) {
      const path = Array.isArray(d.path) ? d.path.join(".") : d.path;
      if (path) out[path] = d.message;
    }
  }
  return out;
}

function GeneralError({ err, fallback }: { err: any; fallback: string }) {
  if (!err) return null;
  const msg = err?.response?.data?.error || fallback;
  return <div className="text-sm mb-3 px-3 py-2 rounded-md text-[var(--rose-600)] bg-[var(--rose-100)]">{msg}</div>;
}

export function EditAccountModal({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: account.name, domain: account.domain || "", industry: account.industry || "",
    employeeCount: account.employeeCount ? String(account.employeeCount) : "",
    annualRevenue: account.annualRevenue ? String(account.annualRevenue) : "",
    accountType: account.accountType, phone: account.phone || "", website: account.website || "",
    billingAddress: account.billingAddress || "", description: account.description || "",
  });
  const [ownerId, setOwnerId] = useState<string | null>(account.ownerId || (account.owner?.id ?? null));
  const [ownerLabel, setOwnerLabel] = useState<string | null>(account.owner ? `${account.owner.firstName} ${account.owner.lastName}` : null);

  const mutation = useMutation({
    mutationFn: () => api.patch(`/accounts/${account.id}`, {
      ...form,
      ownerId: ownerId || null,
      employeeCount: form.employeeCount ? Number(form.employeeCount) : null,
      annualRevenue: form.annualRevenue ? Number(form.annualRevenue) : null,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["account", account.id] }); qc.invalidateQueries({ queryKey: ["accounts"] }); onClose(); },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  return (
    <Modal title="Edit Account" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <GeneralError err={mutation.error} fallback="Could not update account." />
        <Field label="Account name" required>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} />
          <FieldError message={fieldErrors.name} />
        </Field>
        <Field label="Account Owner">
          <RelationshipSelector
            value={ownerId} valueLabel={ownerLabel}
            onChange={(id, opt) => { setOwnerId(id); setOwnerLabel(opt?.label || null); }}
            fetchOptions={fetchOwnerOptions}
            placeholder="Search account owner…"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Domain"><input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Industry"><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Website"><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <Field label="Billing address"><input value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} /></Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EditContactModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: contact.firstName, lastName: contact.lastName, email: contact.email || "",
    phone: contact.phone || "", jobTitle: contact.jobTitle || "", linkedinUrl: contact.linkedinUrl || "",
    lifecycleStage: contact.lifecycleStage,
  });
  const mutation = useMutation({
    mutationFn: () => api.patch(`/contacts/${contact.id}`, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contact", contact.id] }); qc.invalidateQueries({ queryKey: ["contacts"] }); onClose(); },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  return (
    <Modal title="Edit Contact" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <GeneralError err={mutation.error} fallback="Could not update contact." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} style={inputStyle} />
            <FieldError message={fieldErrors.firstName} />
          </Field>
          <Field label="Last name" required>
            <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} style={inputStyle} />
            <FieldError message={fieldErrors.lastName} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Phone Number"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <Field label="Designation"><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        <Field label="LinkedIn"><input value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export function EditOpportunityModal({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const qc = useQueryClient();

  const { data: oppPipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
  });

  const oppPipeline = oppPipelines?.data[0] || opp.pipeline;

  const [accountId, setAccountId] = useState<string | null>(opp.accountId || (opp.account?.id ?? null));
  const [accountLabel, setAccountLabel] = useState<string | null>(opp.account?.name || null);
  const [accountOwnerId, setAccountOwnerId] = useState<string | null>(opp.account?.ownerId || (opp.account?.owner?.id ?? null));
  const [accountOwnerLabel, setAccountOwnerLabel] = useState<string | null>(opp.account?.owner ? `${opp.account.owner.firstName} ${opp.account.owner.lastName}` : null);

  const initialContact = opp.contact || (opp.contacts && opp.contacts[0]?.contact) || null;
  const [contactId, setContactId] = useState<string | null>(opp.contactId || (initialContact?.id ?? null));
  const [contactLabel, setContactLabel] = useState<string | null>(initialContact ? `${initialContact.firstName} ${initialContact.lastName}` : null);

  const [ownerId, setOwnerId] = useState<string | null>(opp.ownerId || (opp.owner?.id ?? null));
  const [ownerLabel, setOwnerLabel] = useState<string | null>(opp.owner ? `${opp.owner.firstName} ${opp.owner.lastName}` : null);

  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState<string | null>(null);

  const initialProposalVal = opp.actualOpportunityValue !== undefined && opp.actualOpportunityValue !== null
    ? String(opp.actualOpportunityValue)
    : (opp.expectedOpportunityValue !== undefined && opp.expectedOpportunityValue !== null ? String(opp.expectedOpportunityValue) : String(opp.amount || ""));

  const [form, setForm] = useState({
    name: opp.name,
    proposalSentValue: initialProposalVal,
    bottomLineCost: opp.bottomLineCost !== undefined && opp.bottomLineCost !== null ? String(opp.bottomLineCost) : "",
    stageId: opp.stageId,
    createdDate: opp.createdAt ? opp.createdAt.slice(0, 10) : "",
    expectedCloseDate: opp.expectedCloseDate ? opp.expectedCloseDate.slice(0, 10) : "",
    remarks: opp.description || "",
  });

  const proposalSentVal = form.proposalSentValue ? Number(form.proposalSentValue) : null;
  const costVal = form.bottomLineCost ? Number(form.bottomLineCost) : null;
  const marginVal = proposalSentVal !== null && costVal !== null ? (proposalSentVal - costVal) : (proposalSentVal !== null ? proposalSentVal : null);
  const marginPct = marginVal !== null && proposalSentVal && proposalSentVal > 0 ? (marginVal / proposalSentVal) * 100 : null;

  const [clientError, setClientError] = useState<string | null>(null);

  function handleAccountSelect(id: string | null, opt?: RelationshipOption) {
    setAccountId(id);
    setAccountLabel(opt?.label || null);
    if (opt?.ownerId) {
      setAccountOwnerId(opt.ownerId);
      setAccountOwnerLabel(opt.ownerLabel || null);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.createdDate && form.expectedCloseDate) {
        if (new Date(form.expectedCloseDate) < new Date(form.createdDate)) {
          throw new Error("Close Date cannot be earlier than Created Date");
        }
      }
      if (!accountId) {
        throw new Error("Account is required");
      }
      if (!ownerId) {
        throw new Error("Assigned To is required");
      }

      const proposalSent = form.proposalSentValue ? Number(form.proposalSentValue) : null;
      const cost = form.bottomLineCost ? Number(form.bottomLineCost) : null;

      if (proposalSent !== null && proposalSent < 0) throw new Error("Proposal Sent Value must be non-negative");
      if (cost !== null && cost < 0) throw new Error("Cost Incurred to Company must be non-negative");

      return api.patch(`/opportunities/${opp.id}`, {
        name: form.name,
        accountId: accountId,
        contactId: contactId || null,
        amount: proposalSent ?? Number(opp.amount),
        expectedOpportunityValue: proposalSent,
        actualOpportunityValue: proposalSent,
        bottomLineCost: cost,
        stageId: form.stageId,
        ownerId: ownerId,
        createdAt: form.createdDate ? new Date(form.createdDate).toISOString() : undefined,
        expectedCloseDate: form.expectedCloseDate ? new Date(form.expectedCloseDate).toISOString() : null,
        description: form.remarks || null,
        remarks: form.remarks || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", opp.id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      onClose();
    },
    onError: (err: any) => {
      setClientError(err?.message || "Could not update opportunity.");
    },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  return (
    <>
      <Modal title="Edit Opportunity" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setClientError(null);
            mutation.mutate();
          }}
          className="space-y-4"
        >
          {clientError && (
            <div className="text-sm px-3 py-2 rounded-md text-[var(--rose-600)] bg-[var(--rose-100)]">
              {clientError}
            </div>
          )}
          <GeneralError err={mutation.error} fallback="Could not update opportunity." />

          <Field label="Account Owner">
            <RelationshipSelector
              value={accountOwnerId}
              valueLabel={accountOwnerLabel}
              onChange={(id, opt) => {
                setAccountOwnerId(id);
                setAccountOwnerLabel(opt?.label || null);
              }}
              fetchOptions={fetchOwnerOptions}
              placeholder="Search / select account owner…"
            />
          </Field>

          <Field label="Account" required>
            <RelationshipSelector
              value={accountId}
              valueLabel={accountLabel}
              onChange={handleAccountSelect}
              fetchOptions={fetchAccountOptions}
              placeholder="Search account…"
              onCreateNew={(term) => setShowNewAccount(term || "")}
              createLabel="+ Create new account"
            />
            <FieldError message={fieldErrors.accountId || fieldErrors.account} />
          </Field>

          <Field label="Contact Person">
            <RelationshipSelector
              value={contactId}
              valueLabel={contactLabel}
              onChange={(id, opt) => {
                setContactId(id);
                setContactLabel(opt?.label || null);
              }}
              fetchOptions={(search) => fetchContactOptions(search, accountId || undefined)}
              placeholder={accountId ? `Search contacts for ${accountLabel}…` : "Search contacts…"}
              onCreateNew={(term) => setShowNewContact(term || "")}
              createLabel="+ Create new contact"
            />
            <FieldError message={fieldErrors.contactId} />
          </Field>

          <Field label="Opportunity Name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
            <FieldError message={fieldErrors.name} />
          </Field>

          <Field label="Opportunity Stage" required>
            <select
              value={form.stageId}
              onChange={(e) => setForm({ ...form, stageId: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              {(oppPipeline?.stages || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.stageId} />
          </Field>

          {/* FINANCIAL DETAILS SECTION */}
          <div className="p-4 rounded-xl border bg-[var(--ink-50)] border-[var(--ink-100)] space-y-3">
            <div className="flex items-center gap-2">
              <IndianRupee size={16} className="text-[var(--ledger-700)]" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ink-800)]">Financial Details</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field
                label={
                  <div className="flex items-center gap-1">
                    <span>Proposal Sent Value</span>
                    <span title="Proposal Sent Value is the total commercial proposal value for this opportunity." className="cursor-help text-[var(--ink-400)] hover:text-[var(--ledger-700)]">
                      <Info size={13} />
                    </span>
                  </div>
                }
                required
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--ink-500)]">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.proposalSentValue}
                    onChange={(e) => setForm({ ...form, proposalSentValue: e.target.value })}
                    className={`${inputClass} pl-8 font-mono-num`}
                    style={inputStyle}
                    placeholder="10,00,000"
                  />
                </div>
                <FieldError message={fieldErrors.amount || fieldErrors.actualOpportunityValue || fieldErrors.expectedOpportunityValue} />
              </Field>

              <Field
                label={
                  <div className="flex items-center gap-1">
                    <span>Cost Incurred to Company</span>
                    <span title="Cost Incurred to Company is the internal cost associated with delivering this opportunity." className="cursor-help text-[var(--ink-400)] hover:text-[var(--ledger-700)]">
                      <Info size={13} />
                    </span>
                  </div>
                }
              >
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--ink-500)]">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.bottomLineCost}
                    onChange={(e) => setForm({ ...form, bottomLineCost: e.target.value })}
                    className={`${inputClass} pl-8 font-mono-num`}
                    style={inputStyle}
                    placeholder="7,00,000"
                  />
                </div>
                <FieldError message={fieldErrors.bottomLineCost} />
              </Field>
            </div>

            {/* Auto-Calculated Output Margins Bar */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--ink-200)] text-xs">
              <div className="p-3 rounded-lg bg-white border border-[var(--ink-100)] flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-[var(--ink-500)] font-medium mb-1">
                  <span>Margin Value (Auto-Calculated)</span>
                  <span title="Margin Value = Proposal Sent Value - Cost Incurred to Company" className="cursor-help text-[var(--ink-400)]"><Info size={11} /></span>
                </div>
                <div className={`font-mono-num text-base font-bold ${marginVal !== null ? (marginVal > 0 ? "text-emerald-700" : marginVal < 0 ? "text-rose-600" : "text-slate-700") : "text-slate-400"}`}>
                  {marginVal !== null ? formatCurrency(marginVal) : "—"}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[var(--ink-100)] flex flex-col justify-between">
                <div className="flex items-center gap-1 text-[11px] text-[var(--ink-500)] font-medium mb-1">
                  <span>Margin Percentage (Auto-Calculated)</span>
                  <span title="Margin % = (Margin Value / Proposal Sent Value) * 100" className="cursor-help text-[var(--ink-400)]"><Info size={11} /></span>
                </div>
                <div className={`font-mono-num text-base font-bold ${marginPct !== null ? (marginPct > 0 ? "text-emerald-700" : marginPct < 0 ? "text-rose-600" : "text-slate-700") : "text-slate-400"}`}>
                  {marginPct !== null ? `${marginPct.toFixed(1)}%` : "—"}
                </div>
              </div>
            </div>
          </div>

          <Field label="Remarks">
            <textarea
              rows={3}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className={inputClass}
              style={{ ...inputStyle, minHeight: 72 }}
            />
            <FieldError message={fieldErrors.description || fieldErrors.remarks} />
          </Field>

          <Field label="Assigned To" required>
            <RelationshipSelector
              value={ownerId}
              valueLabel={ownerLabel}
              onChange={(id, opt) => {
                setOwnerId(id);
                setOwnerLabel(opt?.label || null);
              }}
              fetchOptions={fetchOwnerOptions}
              placeholder="Search assigned user…"
            />
            <FieldError message={fieldErrors.ownerId} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Created Date">
              <input
                type="date"
                value={form.createdDate}
                onChange={(e) => setForm({ ...form, createdDate: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
              <FieldError message={fieldErrors.createdAt} />
            </Field>

            <Field label="Close Date">
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(e) => setForm({ ...form, expectedCloseDate: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
              <FieldError message={fieldErrors.expectedCloseDate} />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !accountId || !ownerId}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {showNewAccount !== null && (
        <NewAccountModal
          initialName={showNewAccount}
          onClose={() => setShowNewAccount(null)}
          onCreated={(acc) => {
            setAccountId(acc.id);
            setAccountLabel(acc.name);
            setShowNewAccount(null);
          }}
        />
      )}

      {showNewContact !== null && (
        <NewContactModal
          accountId={accountId || undefined}
          accountName={accountLabel || undefined}
          onClose={() => setShowNewContact(null)}
          onCreated={(ct) => {
            setContactId(ct.id);
            setContactLabel(`${ct.firstName} ${ct.lastName}`);
            setShowNewContact(null);
          }}
        />
      )}
    </>
  );
}

export function EditLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: lead.firstName, lastName: lead.lastName, email: lead.email || "", phone: lead.phone || "",
    companyName: lead.companyName || "", jobTitle: lead.jobTitle || "", source: lead.source || "",
    status: lead.status, score: String(lead.score), notes: lead.notes || "",
  });
  const mutation = useMutation({
    mutationFn: () => api.patch(`/leads/${lead.id}`, { ...form, score: Number(form.score) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", lead.id] }); qc.invalidateQueries({ queryKey: ["leads"] }); onClose(); },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  return (
    <Modal title="Edit Lead" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <GeneralError err={mutation.error} fallback="Could not update lead." />
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} style={inputStyle} />
            <FieldError message={fieldErrors.firstName} />
          </Field>
          <Field label="Last name" required>
            <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company"><input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Job title"><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className={inputClass} style={inputStyle}>
              {["NEW", "CONTACTED", "QUALIFIED", "NURTURING", "UNQUALIFIED"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Score">
            <input type="number" min="0" max="100" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <Field label="Notes"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} /></Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </form>
    </Modal>
  );
}
