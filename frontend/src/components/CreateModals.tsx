import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { Modal, Field, Button, inputClass, inputStyle } from "./ui";
import { RelationshipSelector, type RelationshipOption } from "./RelationshipSelector";
import { fetchAccountOptions, fetchContactOptions, fetchOpportunityOptions, fetchOwnerOptions } from "../lib/pickers";
import type { Pipeline, DuplicateLeadCandidate } from "../lib/types";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="text-xs mt-1" style={{ color: "var(--rose-600)" }}>{message}</div>;
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
  return <div className="text-sm mb-3 px-3 py-2 rounded-md" style={{ color: "var(--rose-600)", background: "var(--rose-100)" }}>{msg}</div>;
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
        <p className="text-sm mb-3" style={{ color: "var(--ink-600)" }}>An account that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm" style={{ borderColor: "var(--ink-100)" }}>
              <div className="font-medium">{d.name}</div>
              <div style={{ color: "var(--ink-500)" }}>{[d.domain, d.industry].filter(Boolean).join(" · ")}</div>
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

  const mutation = useMutation({
    mutationFn: (force: boolean) => api.post("/contacts", { ...form, accountId: accountId || null }, { params: force ? { force: "true" } : {} }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["contacts"] }); if (accountId) qc.invalidateQueries({ queryKey: ["account", accountId] }); onCreated?.(res.data); onClose(); },
    onError: (err: any) => { if (err?.response?.status === 409) setDuplicates(err.response.data.duplicates || []); },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (duplicates) {
    return (
      <Modal title="Possible duplicate" onClose={onClose}>
        <p className="text-sm mb-3" style={{ color: "var(--ink-600)" }}>A contact that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm" style={{ borderColor: "var(--ink-100)" }}>
              <div className="font-medium">{d.firstName} {d.lastName}</div>
              <div style={{ color: "var(--ink-500)" }}>{[d.email, d.phone, d.account?.name].filter(Boolean).join(" · ")}</div>
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
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(false); }}>
          <GeneralError err={mutation.error?.response?.status !== 409 ? mutation.error : undefined} fallback="Could not create contact." />
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
            <Field label="Phone Number">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} style={inputStyle} placeholder="+91 98765 43210" />
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
            accountLabel && <div className="text-xs mb-3.5" style={{ color: "var(--ink-500)" }}>Will be linked to <span className="font-medium" style={{ color: "var(--ink-700)" }}>{accountLabel}</span> automatically.</div>
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

  // Query for Opportunity pipeline
  const { data: oppPipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "OPPORTUNITY"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data,
  });

  const oppPipeline = oppPipelines?.data[0];

  // 1. Account & Account Owner state
  const [accountId, setAccountId] = useState<string | null>(fixedAccountId || null);
  const [accountLabel, setAccountLabel] = useState<string | null>(accountName || null);
  const [accountOwnerId, setAccountOwnerId] = useState<string | null>(fixedAccountOwnerId || null);
  const [accountOwnerLabel, setAccountOwnerLabel] = useState<string | null>(fixedAccountOwnerLabel || null);

  // 2. Contact Person state
  const [contactId, setContactId] = useState<string | null>(fixedContactId || null);
  const [contactLabel, setContactLabel] = useState<string | null>(contactName || null);

  // Inline modal drawers
  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);
  const [showNewContact, setShowNewContact] = useState<string | null>(null);

  // 3. Assigned To (Opportunity Owner)
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  // 4. Primary fields
  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: initialName || "",
    amount: initialAmount ? String(initialAmount) : "",
    stageId: "",
    remarks: initialRemarks || "",
    createdDate: todayStr,
    closeDate: "",
  });

  const [clientError, setClientError] = useState<string | null>(null);

  // Default stage resolution
  const effectiveStageId = form.stageId || oppPipeline?.stages[0]?.id || "";

  // When an account is selected, auto-populate Account Owner and clear mismatching contact if any
  function handleAccountSelect(id: string | null, opt?: RelationshipOption) {
    setAccountId(id);
    setAccountLabel(opt?.label || null);
    if (opt?.ownerId) {
      setAccountOwnerId(opt.ownerId);
      setAccountOwnerLabel(opt.ownerLabel || null);
    }
    // Also if ownerId (Assigned To) is not set yet, default to Account Owner
    if (!ownerId && opt?.ownerId) {
      setOwnerId(opt.ownerId);
      setOwnerLabel(opt.ownerLabel || null);
    }
    // Reset contact if not linked to new account
    if (contactId && opt && id) {
      setContactId(null);
      setContactLabel(null);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      // Validate dates
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
      if (Number(form.amount) < 0) {
        throw new Error("Deal Value must be non-negative");
      }

      return api.post("/opportunities", {
        name: form.name,
        accountId: accountId,
        contactId: contactId || null,
        amount: Number(form.amount || 0),
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
            <div className="text-sm px-3 py-2 rounded-md" style={{ color: "var(--rose-600)", background: "var(--rose-100)" }}>
              {clientError}
            </div>
          )}
          <GeneralError err={mutation.error} fallback="Could not create opportunity." />

          {/* 1. Account Owner */}
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

          {/* 2. Account */}
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

          {/* 3. Contact Person */}
          <Field label="Contact Person">
            <RelationshipSelector
              value={contactId}
              valueLabel={contactLabel}
              onChange={(id, opt) => {
                setContactId(id);
                setContactLabel(opt?.label || null);
                // If contact has account and account not selected yet, auto-select account
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

          {/* 4. Opportunity Name */}
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

          {/* 5. Opportunity Stage & Deal Value */}
          <div className="grid grid-cols-2 gap-3">
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

            <Field label="Deal Value" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium" style={{ color: "var(--ink-500)" }}>
                  ₹
                </span>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={`${inputClass} pl-8`}
                  style={inputStyle}
                  placeholder="12,00,000"
                />
              </div>
              <FieldError message={fieldErrors.amount} />
            </Field>
          </div>

          {/* 8. Remarks */}
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

          {/* 9. Assigned To */}
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

          {/* 10 & 11. Created Date & Close Date */}
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

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--ink-100)" }}>
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !accountId || !ownerId || !form.name}>
              {mutation.isPending ? "Creating…" : "Create Opportunity"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Inline Account Creation Modal */}
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

      {/* Inline Contact Creation Modal */}
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
/* Deal                                                                    */
/* ---------------------------------------------------------------------- */

export function NewDealModal({
  onClose,
  onCreated,
  accountId: fixedAccountId,
  accountName,
  contactId: fixedContactId,
  contactName,
  opportunityId: fixedOpportunityId,
  opportunityName,
  initialAmount,
  initialRemarks,
}: {
  onClose: () => void;
  onCreated?: (deal: any) => void;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  opportunityId?: string;
  opportunityName?: string;
  initialAmount?: string | number;
  initialRemarks?: string;
}) {
  const qc = useQueryClient();
  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({
    queryKey: ["pipelines", "DEAL"],
    queryFn: async () => (await api.get("/pipelines", { params: { type: "DEAL" } })).data,
  });
  const pipeline = pipelines?.data[0];

  const [accountId, setAccountId] = useState<string | null>(fixedAccountId || null);
  const [accountLabel, setAccountLabel] = useState<string | null>(accountName || null);
  const [showNewAccount, setShowNewAccount] = useState<string | null>(null);

  const [contactId, setContactId] = useState<string | null>(fixedContactId || null);
  const [contactLabel, setContactLabel] = useState<string | null>(contactName || null);
  const [showNewContact, setShowNewContact] = useState<string | null>(null);

  const [opportunityId, setOpportunityId] = useState<string | null>(fixedOpportunityId || null);
  const [opportunityLabel, setOpportunityLabel] = useState<string | null>(opportunityName || null);

  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: opportunityName ? `${opportunityName} - Deal` : "",
    amount: initialAmount ? String(initialAmount) : "",
    stageId: "",
    closeDate: "",
    remarks: initialRemarks || "",
  });

  const stageId = form.stageId || pipeline?.stages.find((s) => !s.isClosed)?.id || "";

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/deals", {
        name: form.name,
        amount: Number(form.amount || 0),
        pipelineId: pipeline!.id,
        stageId,
        ownerId,
        accountId: accountId || undefined,
        contactId: contactId || undefined,
        opportunityId: opportunityId || undefined,
        closeDate: form.closeDate ? new Date(form.closeDate).toISOString() : null,
        description: form.remarks || null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      if (accountId) qc.invalidateQueries({ queryKey: ["account", accountId] });
      onCreated?.(res.data);
      onClose();
    },
  });
  const fieldErrors = fieldErrorsFrom(mutation.error);

  if (!pipeline) return null;

  return (
    <>
      <Modal title="Create Deal" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <GeneralError err={mutation.error} fallback="Could not create deal." />
          <Field label="Deal Name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="e.g. Acme Enterprise License Deal"
            />
            <FieldError message={fieldErrors.name} />
          </Field>

          <Field label="Account" required>
            <RelationshipSelector
              value={accountId}
              valueLabel={accountLabel}
              onChange={(id, opt) => {
                setAccountId(id);
                setAccountLabel(opt?.label || null);
                if (opt?.ownerId && !ownerId) {
                  setOwnerId(opt.ownerId);
                  setOwnerLabel(opt.ownerLabel || null);
                }
              }}
              fetchOptions={fetchAccountOptions}
              placeholder="Search or select company…"
              onCreateNew={(term) => setShowNewAccount(term)}
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
              fetchOptions={(s) => fetchContactOptions(s, accountId || undefined)}
              placeholder={accountId ? `Search contacts for ${accountLabel}…` : "Search contacts…"}
              onCreateNew={(term) => setShowNewContact(term)}
              createLabel="+ Create new contact"
            />
          </Field>

          {!fixedOpportunityId && (
            <Field label="Source Opportunity (Optional)">
              <RelationshipSelector
                value={opportunityId}
                valueLabel={opportunityLabel}
                onChange={(id, opt) => {
                  setOpportunityId(id);
                  setOpportunityLabel(opt?.label || null);
                }}
                fetchOptions={(s) => fetchOpportunityOptions(s, accountId || undefined)}
                placeholder="Link to an existing opportunity…"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Deal Value" required>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium" style={{ color: "var(--ink-500)" }}>
                  ₹
                </span>
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className={`${inputClass} pl-8`}
                  style={inputStyle}
                  placeholder="12,00,000"
                />
              </div>
              <FieldError message={fieldErrors.amount} />
            </Field>

            <Field label="Deal Stage" required>
              <select
                value={stageId}
                onChange={(e) => setForm({ ...form, stageId: e.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                {pipeline.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

            <Field label="Close Date">
              <input
                type="date"
                value={form.closeDate}
                onChange={(e) => setForm({ ...form, closeDate: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Remarks">
            <textarea
              rows={2}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              className={inputClass}
              style={{ ...inputStyle, minHeight: 60 }}
              placeholder="Deal terms, notes, and milestones…"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--ink-100)" }}>
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !accountId || !ownerId || !form.name}>
              {mutation.isPending ? "Creating…" : "Create Deal"}
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
          initialFirstName={showNewContact.split(" ")[0] || ""}
          initialLastName={showNewContact.split(" ").slice(1).join(" ") || ""}
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
        <p className="text-sm mb-3" style={{ color: "var(--ink-600)" }}>A lead that looks like this may already exist:</p>
        <div className="space-y-2 mb-4">
          {duplicates.map((d) => (
            <div key={d.id} className="p-3 rounded-md border text-sm" style={{ borderColor: "var(--ink-100)" }}>
              <div className="font-medium">{d.firstName} {d.lastName}</div>
              <div style={{ color: "var(--ink-500)" }}>{[d.email, d.phone, d.companyName].filter(Boolean).join(" · ")}</div>
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
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--ink-100)" }}>
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

type AssocContext = { objectType: "ACCOUNT" | "CONTACT" | "OPPORTUNITY" | "DEAL" | "LEAD"; accountId?: string; contactId?: string; opportunityId?: string; dealId?: string; leadId?: string; label?: string };

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
        dealId: context?.dealId,
        leadId: context?.leadId,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); onCreated?.(); onClose(); },
  });

  return (
    <Modal title="New Task" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <GeneralError err={mutation.error} fallback="Could not create task." />
        {context?.label && <div className="text-xs mb-3.5" style={{ color: "var(--ink-500)" }}>Related to <span className="font-medium" style={{ color: "var(--ink-700)" }}>{context.label}</span></div>}
        <Field label="Title" required>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} style={inputStyle} placeholder="Follow up on proposal" />
        </Field>
        <Field label="Due date">
          <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--ink-100)" }}>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Task"}</Button>
        </div>
      </form>
    </Modal>
  );
}

const LOGGABLE_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE", "FOLLOW_UP", "DEMO", "PROPOSAL", "OTHER"] as const;

export function LogActivityModal({ onClose, onCreated, context }: { onClose: () => void; onCreated?: () => void; context?: AssocContext }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ type: (typeof LOGGABLE_TYPES)[number]; subject: string; body: string }>({ type: "CALL", subject: "", body: "" });
  const mutation = useMutation({
    mutationFn: () =>
      api.post("/activities", {
        type: form.type,
        subject: form.subject,
        body: form.body || null,
        status: "COMPLETED",
        objectType: context?.objectType || "ACCOUNT",
        accountId: context?.accountId,
        contactId: context?.contactId,
        opportunityId: context?.opportunityId,
        dealId: context?.dealId,
        leadId: context?.leadId,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); onCreated?.(); onClose(); },
  });

  return (
    <Modal title="Log Activity" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        <GeneralError err={mutation.error} fallback="Could not log activity." />
        {context?.label && <div className="text-xs mb-3.5" style={{ color: "var(--ink-500)" }}>Related to <span className="font-medium" style={{ color: "var(--ink-700)" }}>{context.label}</span></div>}
        <Field label="Type" required>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className={inputClass} style={inputStyle}>
            {LOGGABLE_TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Subject" required>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inputClass} style={{ ...inputStyle, minHeight: 70 }} />
        </Field>
        <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--ink-100)" }}>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Logging…" : "Log Activity"}</Button>
        </div>
      </form>
    </Modal>
  );
}
