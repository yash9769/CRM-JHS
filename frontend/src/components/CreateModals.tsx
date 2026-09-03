import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Modal, Field, Button, inputClass, inputStyle } from "./ui";
import { RelationshipSelector, type RelationshipOption } from "./RelationshipSelector";
import { fetchAccountOptions, fetchContactOptions, fetchOwnerOptions } from "../lib/pickers";
import type { Pipeline, DuplicateLeadCandidate } from "../lib/types";
import { Info, IndianRupee } from "lucide-react";
import { formatCurrency } from "../lib/format";

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

/* ---------------------------------------------------------------------- */
/* Account                                                                 */
/* ---------------------------------------------------------------------- */

export function NewAccountModal({
  onClose,
  onCreated,
  initialName,
  initialOwnerId,
  initialOwnerLabel,
}: {
  onClose: () => void;
  onCreated?: (account: any) => void;
  initialName?: string;
  initialOwnerId?: string | null;
  initialOwnerLabel?: string | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: initialName || "", domain: "", industry: "", phone: "", website: "" });
  const [ownerId, setOwnerId] = useState<string | null>(initialOwnerId || null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(initialOwnerLabel || null);
  const [duplicates, setDuplicates] = useState<any[] | null>(null);

  const mutation = useMutation({
    mutationFn: (force: boolean) =>
      api.post("/accounts", { ...form, ownerId: ownerId || undefined }, { params: force ? { force: "true" } : {} }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onCreated?.(res.data);
      onClose();
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) setDuplicates(err.response.data.duplicates || []);
    },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (duplicates) {
    return (
      <Modal title="Possible duplicate" onClose={onClose}>
        <p className="text-sm mb-3 text-[var(--ink-600)]">An account that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm border-[var(--ink-100)]">
              <div className="font-medium">{d.name}</div>
              <div className="text-[var(--ink-500)]">{[d.domain, d.industry].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onCreated?.(duplicates[0])}>Use existing</Button>
          <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create anyway"}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New Account" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(false); }}>
        <GeneralError err={mutation.error?.response?.status !== 409 ? mutation.error : undefined} fallback="Could not create account." />
        <Field label="Account name" required>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} placeholder="e.g. Acme Technologies" />
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
          <Field label="Domain">
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={inputClass} style={inputStyle} placeholder="acme.com" />
          </Field>
          <Field label="Industry">
            <input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputClass} style={inputStyle} placeholder="Information Technology" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Website">
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClass} style={inputStyle} placeholder="https://acme.com" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Contact                                                                 */
/* ---------------------------------------------------------------------- */

import { useAuth } from "../hooks/useAuth";

export function NewContactModal({
  onClose,
  onCreated,
  accountId: fixedAccountId,
  accountName,
  initialFirstName,
  initialLastName,
  initialEmail,
  initialPhone,
  initialJobTitle,
}: {
  onClose: () => void;
  onCreated?: (contact: any) => void;
  accountId?: string;
  accountName?: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialEmail?: string;
  initialPhone?: string;
  initialJobTitle?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: initialFirstName || "",
    lastName: initialLastName || "",
    email: initialEmail || "",
    phone: initialPhone || "",
    jobTitle: initialJobTitle || "",
  });
  const [accountId, setAccountId] = useState<string | null>(fixedAccountId || null);
  const [accountLabel, setAccountLabel] = useState<string | null>(accountName || null);
  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<any[] | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (force: boolean) => {
      if (form.phone && !/^\d+$/.test(form.phone)) {
        throw new Error("Phone number must contain only numeric digits (no spaces, dashes, or letters)");
      }
      return api.post("/contacts", { ...form, accountId: accountId || null }, { params: force ? { force: "true" } : {} });
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["contacts"] }); if (accountId) qc.invalidateQueries({ queryKey: ["account", accountId] }); onCreated?.(res.data); onClose(); },
    onError: (err: any) => { if (err?.response?.status === 409) setDuplicates(err.response.data.duplicates || []); },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (duplicates) {
    return (
      <Modal title="Possible duplicate" onClose={onClose}>
        <p className="text-sm mb-3 text-[var(--ink-600)]">A contact that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm border-[var(--ink-100)]">
              <div className="font-medium">{d.firstName} {d.lastName}</div>
              <div className="text-[var(--ink-500)]">{[d.email, d.phone, d.account?.name].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onCreated?.(duplicates[0])}>Use existing</Button>
          <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create anyway"}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <>
      <Modal title="New Contact" onClose={onClose}>
        <form onSubmit={(e) => {
          e.preventDefault();
          setPhoneError(null);
          if (form.phone && !/^\d+$/.test(form.phone)) {
            setPhoneError("Phone number must contain only numeric digits (no spaces, dashes, or symbols)");
            return;
          }
          mutation.mutate(false);
        }}>
          <GeneralError err={mutation.error?.response?.status !== 409 ? mutation.error : undefined} fallback="Could not create contact." />
          {phoneError && (
            <div className="text-sm mb-3 px-3 py-2 rounded-md text-[var(--rose-600)] bg-[var(--rose-100)]">
              {phoneError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" required>
              <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} style={inputStyle} placeholder="Rahul" />
              <FieldError message={fieldErrors.firstName} />
            </Field>
            <Field label="Last name" required>
              <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} style={inputStyle} placeholder="Mehta" />
              <FieldError message={fieldErrors.lastName} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} placeholder="rahul@example.com" />
              <FieldError message={fieldErrors.email} />
            </Field>
            <Field label="Phone Number (Numeric only)">
              <input
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setPhoneError(null);
                }}
                className={inputClass}
                style={inputStyle}
                placeholder="9876543210"
              />
              <FieldError message={fieldErrors.phone} />
            </Field>
          </div>
          <Field label="Designation">
            <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} style={inputStyle} placeholder="Chief Technology Officer" />
          </Field>
          {!fixedAccountId ? (
            <Field label="Account">
              <RelationshipSelector
                value={accountId} valueLabel={accountLabel}
                onChange={(id, opt) => { setAccountId(id); setAccountLabel(opt?.label || null); }}
                fetchOptions={fetchAccountOptions}
                placeholder="Search or select company…"
                onCreateNew={(term) => setShowNewAccount(term)}
                createLabel="+ Create new account"
              />
            </Field>
          ) : (
            accountLabel && <div className="text-xs mb-3.5 text-[var(--ink-500)]">Will be linked to <span className="font-medium text-[var(--ink-700)]">{accountLabel}</span> automatically.</div>
          )}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Contact"}</Button>
          </div>
        </form>
      </Modal>
      {showNewAccount !== null && (
        <NewAccountModal
          initialName={showNewAccount}
          onClose={() => setShowNewAccount(null)}
          onCreated={(acc) => { setAccountId(acc.id); setAccountLabel(acc.name); setShowNewAccount(null); }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Opportunity                                                             */
/* ---------------------------------------------------------------------- */

export function NewOpportunityModal({
  onClose,
  onCreated,
  accountId: fixedAccountId,
  accountName,
  accountOwnerId: fixedAccountOwnerId,
  accountOwnerLabel: fixedAccountOwnerLabel,
  contactId: fixedContactId,
  contactName,
  initialName,
  initialAmount,
  initialRemarks,
}: {
  onClose: () => void;
  onCreated?: (opp: any) => void;
  accountId?: string;
  accountName?: string;
  accountOwnerId?: string;
  accountOwnerLabel?: string;
  contactId?: string;
  contactName?: string;
  initialName?: string;
  initialAmount?: string | number;
  initialRemarks?: string;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isManager = user?.orgRole === "MANAGER";

  const { data: oppPipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
  });

  const oppPipeline = oppPipelines?.data[0];

  const [accountId, setAccountId] = useState<string | null>(fixedAccountId || null);
  const [accountLabel, setAccountLabel] = useState<string | null>(accountName || null);
  const [accountOwnerId, setAccountOwnerId] = useState<string | null>(fixedAccountOwnerId || null);
  const [accountOwnerLabel, setAccountOwnerLabel] = useState<string | null>(fixedAccountOwnerLabel || null);

  const [contactId, setContactId] = useState<string | null>(fixedContactId || null);
  const [contactLabel, setContactLabel] = useState<string | null>(contactName || null);

  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState<string | null>(null);

  const [ownerId, setOwnerId] = useState<string | null>(
    isManager && user ? user.id : null
  );
  const [ownerLabel, setOwnerLabel] = useState<string | null>(
    isManager && user ? `${user.firstName} ${user.lastName}` : null
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: initialName || "",
    proposalSentValue: initialAmount ? String(initialAmount) : "",
    bottomLineCost: "",
    stageId: "",
    remarks: initialRemarks || "",
    createdDate: todayStr,
    closeDate: "",
  });

  const proposalSentVal = form.proposalSentValue ? Number(form.proposalSentValue) : null;
  const costVal = form.bottomLineCost ? Number(form.bottomLineCost) : null;
  const marginVal = proposalSentVal !== null && costVal !== null ? (proposalSentVal - costVal) : (proposalSentVal !== null ? proposalSentVal : null);
  const marginPct = marginVal !== null && proposalSentVal && proposalSentVal > 0 ? (marginVal / proposalSentVal) * 100 : null;

  const [clientError, setClientError] = useState<string | null>(null);
  const effectiveStageId = form.stageId || oppPipeline?.stages[0]?.id || "";

  function handleAccountSelect(id: string | null, opt?: RelationshipOption) {
    setAccountId(id);
    setAccountLabel(opt?.label || null);
    if (opt?.ownerId) {
      setAccountOwnerId(opt.ownerId);
      setAccountOwnerLabel(opt.ownerLabel || null);
    }
    if (!isManager && !ownerId && opt?.ownerId) {
      setOwnerId(opt.ownerId);
      setOwnerLabel(opt.ownerLabel || null);
    }
    if (contactId && opt && id) {
      setContactId(null);
      setContactLabel(null);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (form.createdDate && form.closeDate) {
        if (new Date(form.closeDate) < new Date(form.createdDate)) {
          throw new Error("Close Date cannot be earlier than Created Date");
        }
      }
      if (!accountId) {
        throw new Error("Please select or create an Account");
      }
      if (!ownerId) {
        throw new Error("Please assign the opportunity to a user");
      }

      const proposalSent = form.proposalSentValue ? Number(form.proposalSentValue) : null;
      const cost = form.bottomLineCost ? Number(form.bottomLineCost) : null;

      if (proposalSent !== null && proposalSent < 0) throw new Error("Proposal Sent Value must be non-negative");
      if (cost !== null && cost < 0) throw new Error("Cost Incurred to Company must be non-negative");

      return api.post("/opportunities", {
        name: form.name,
        accountId: accountId,
        contactId: contactId || null,
        amount: proposalSent ?? 0,
        expectedDealValue: proposalSent,
        actualDealValue: proposalSent,
        bottomLineCost: cost,
        pipelineId: oppPipeline!.id,
        stageId: effectiveStageId,
        ownerId: ownerId,
        createdAt: form.createdDate ? new Date(form.createdDate).toISOString() : undefined,
        expectedCloseDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
        description: form.remarks || null,
        remarks: form.remarks || null,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      if (accountId) qc.invalidateQueries({ queryKey: ["account", accountId] });
      onCreated?.(res.data);
      onClose();
    },
    onError: (err: any) => {
      setClientError(err?.message || "Could not create opportunity.");
    },
  });

  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (!oppPipeline) return null;

  return (
    <>
      <Modal title="Create Opportunity" onClose={onClose}>
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
          <GeneralError err={mutation.error} fallback="Could not create opportunity." />

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
            <FieldError message={fieldErrors.accountOwnerId} />
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
                if (opt?.accountId && !accountId) {
                  setAccountId(opt.accountId);
                  setAccountLabel(opt.accountLabel || null);
                }
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
              placeholder="e.g. Acme Enterprise SOC Implementation"
            />
            <FieldError message={fieldErrors.name} />
          </Field>

          <Field label="Opportunity Stage" required>
            <select
              value={effectiveStageId}
              onChange={(e) => setForm({ ...form, stageId: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              {oppPipeline.stages.map((s) => (
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
                <FieldError message={fieldErrors.amount || fieldErrors.actualDealValue || fieldErrors.expectedDealValue} />
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
              placeholder="Client requirements, scope notes, proposal details…"
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
                value={form.closeDate}
                onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
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
            <Button type="submit" disabled={mutation.isPending || !accountId || !ownerId || !form.name}>
              {mutation.isPending ? "Creating…" : "Create Opportunity"}
            </Button>
          </div>
        </form>
      </Modal>

      {showNewAccount !== null && (
        <NewAccountModal
          initialName={showNewAccount}
          initialOwnerId={accountOwnerId}
          initialOwnerLabel={accountOwnerLabel}
          onClose={() => setShowNewAccount(null)}
          onCreated={(acc) => {
            setAccountId(acc.id);
            setAccountLabel(acc.name);
            if (acc.ownerId) {
              setAccountOwnerId(acc.ownerId);
              setAccountOwnerLabel(acc.owner ? `${acc.owner.firstName} ${acc.owner.lastName}` : null);
              if (!ownerId) {
                setOwnerId(acc.ownerId);
                setOwnerLabel(acc.owner ? `${acc.owner.firstName} ${acc.owner.lastName}` : null);
              }
            }
            setShowNewAccount(null);
          }}
        />
      )}

      {showNewContact !== null && (
        <NewContactModal
          accountId={accountId || undefined}
          accountName={accountLabel || undefined}
          initialFirstName={showNewContact.split(" ")[0] || ""}
          initialLastName={showNewContact.split(" ").slice(1).join(" ") || ""}
          onClose={() => setShowNewContact(null)}
          onCreated={(ct) => {
            setContactId(ct.id);
            setContactLabel(`${ct.firstName} ${ct.lastName}`);
            if (ct.accountId && !accountId) {
              setAccountId(ct.accountId);
              setAccountLabel(ct.account?.name || null);
            }
            setShowNewContact(null);
          }}
        />
      )}
    </>
  );
}

/* ---------------------------------------------------------------------- */
/* Add Line Item                                                           */
/* ---------------------------------------------------------------------- */

export function AddLineItemModal({
  opportunityId,
  onClose,
  onSuccess,
}: {
  opportunityId: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [discountPct, setDiscountPct] = useState("0");

  const { data: products } = useQuery<any>({
    queryKey: ["products", "picker"],
    queryFn: async () => (await api.get("/products", { params: { pageSize: 100 } })).data,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/opportunities/${opportunityId}/line-items`, {
        productId,
        quantity: Number(quantity),
        unitPrice: Number(unitPrice),
        discountPct: Number(discountPct),
      }),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  return (
    <Modal title="Add Line Item" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <Field label="Product" required>
          <select
            required
            value={productId}
            onChange={(e) => {
              const pId = e.target.value;
              setProductId(pId);
              const p = products?.data?.find((x: any) => x.id === pId);
              if (p) setUnitPrice(String(p.unitPrice));
            }}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Select product…</option>
            {products?.data?.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name} ({formatCurrency(p.unitPrice)})
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Quantity" required>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Unit Price" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Discount %">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !productId}>
            {mutation.isPending ? "Adding…" : "Add Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* New Quote Modal                                                         */
/* ---------------------------------------------------------------------- */

export function NewQuoteModal({
  opportunityId: fixedOpportunityId,
  accountId: fixedAccountId,
  onClose,
  onSuccess,
}: {
  opportunityId?: string;
  accountId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [opportunityId, setOpportunityId] = useState(fixedOpportunityId || "");
  const [expirationDate, setExpirationDate] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [taxPct, setTaxPct] = useState("0");

  const { data: opps } = useQuery<any>({
    queryKey: ["opportunities", "picker"],
    queryFn: async () => (await api.get("/opportunities", { params: { pageSize: 100 } })).data,
  });

  const selectedOpp = opps?.data?.find((o: any) => o.id === opportunityId);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/quotes", {
        opportunityId: opportunityId || fixedOpportunityId,
        accountId: fixedAccountId || selectedOpp?.accountId,
        expirationDate: expirationDate || undefined,
        discountPct: Number(discountPct),
        taxPct: Number(taxPct),
      }),
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  return (
    <Modal title="Create Quote" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        {!fixedOpportunityId && (
          <Field label="Opportunity" required>
            <select
              required
              value={opportunityId}
              onChange={(e) => setOpportunityId(e.target.value)}
              className={inputClass}
              style={inputStyle}
            >
              <option value="">Select opportunity…</option>
              {opps?.data?.map((o: any) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {formatCurrency(o.amount)}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount %">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Tax %">
            <input
              type="number"
              min="0"
              max="100"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Expiration Date">
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || (!opportunityId && !fixedOpportunityId)}>
            {mutation.isPending ? "Generating…" : "Generate Quote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Lead                                                                     */
/* ---------------------------------------------------------------------- */

export function NewLeadModal({
  onClose,
  onCreated,
  initialCompanyName,
  initialFirstName,
  initialLastName,
  initialEmail,
  initialPhone,
}: {
  onClose: () => void;
  onCreated?: (lead: any) => void;
  initialCompanyName?: string;
  initialFirstName?: string;
  initialLastName?: string;
  initialEmail?: string;
  initialPhone?: string;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: initialFirstName || "",
    lastName: initialLastName || "",
    email: initialEmail || "",
    phone: initialPhone || "",
    companyName: initialCompanyName || "",
    jobTitle: "",
    source: "",
    notes: "",
  });
  const [duplicates, setDuplicates] = useState<DuplicateLeadCandidate[] | null>(null);

  const mutation = useMutation({
    mutationFn: (force: boolean) => api.post("/leads", form, { params: force ? { force: "true" } : {} }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      onCreated?.(res.data);
      onClose();
      if (!onCreated) navigate(`/leads/${res.data.id}`);
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) setDuplicates(err.response.data.duplicates || []);
    },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (duplicates) {
    return (
      <Modal title="Possible duplicate" onClose={onClose}>
        <p className="text-sm mb-3 text-[var(--ink-600)]">A lead that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm border-[var(--ink-100)]">
              <div className="font-medium">{d.firstName} {d.lastName}</div>
              <div className="text-[var(--ink-500)]">{[d.email, d.phone, d.companyName].filter(Boolean).join(" · ")}</div>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(`/leads/${duplicates[0].id}`)}>Use existing</Button>
          <Button onClick={() => mutation.mutate(true)} disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create anyway"}</Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New Lead" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(false); }} className="space-y-4">
        <GeneralError err={mutation.error?.response?.status !== 409 ? mutation.error : undefined} fallback="Could not create lead." />
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
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Company">
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} className={inputClass} style={inputStyle} placeholder="Optional" />
          </Field>
          <Field label="Job title">
            <input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <Field label="Source">
          <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={inputClass} style={inputStyle} placeholder="Website, referral, event…" />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} placeholder="Interested in…" />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Lead"}</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------------------------------------------------------------------- */
/* Task / Log activity                                                     */
/* ---------------------------------------------------------------------- */

type AssocContext = { objectType: "ACCOUNT" | "CONTACT" | "OPPORTUNITY" | "LEAD"; accountId?: string; contactId?: string; opportunityId?: string; leadId?: string; label?: string };

export function NewTaskModal({ onClose, onCreated, context }: { onClose: () => void; onCreated?: () => void; context?: AssocContext }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ subject: "", dueDate: "", body: "" });
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/activities", {
        type: "TASK",
        subject: form.subject,
        body: form.body || null,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        status: "PENDING",
        objectType: context?.objectType || "ACCOUNT",
        accountId: context?.accountId,
        contactId: context?.contactId,
        opportunityId: context?.opportunityId,
        leadId: context?.leadId,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); onCreated?.(); onClose(); },
  });

  return (
    <Modal title="New Task" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <GeneralError err={mutation.error} fallback="Could not create task." />
        {context?.label && <div className="text-xs mb-3.5 text-[var(--ink-500)]">Related to <span className="font-medium text-[var(--ink-700)]">{context.label}</span></div>}
        <Field label="Title" required>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} style={inputStyle} placeholder="Follow up on proposal" />
        </Field>
        <Field label="Due date">
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Task"}</Button>
        </div>
      </form>
    </Modal>
  );
}

