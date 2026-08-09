import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Modal, Field, inputClass, inputStyle, EmptyState, Badge } from "../components/ui";
import { initials } from "../lib/format";
import type { Contact, Paginated, Account } from "../lib/types";
import { Plus, Search } from "lucide-react";

function NewContactModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", jobTitle: "", accountId: "" });
  const { data: accounts } = useQuery<Paginated<Account>>({
    queryKey: ["accounts", "picker"],
    queryFn: async () => (await api.get("/accounts", { params: { pageSize: 100 } })).data,
  });
  const mutation = useMutation({
    mutationFn: () => api.post("/contacts", { ...form, accountId: form.accountId || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts"] }); onClose(); },
  });

  return (
    <Modal title="New Contact" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input name="firstName" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Last name" required>
            <input name="lastName" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <Field label="Email">
          <input name="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Job title">
          <input name="jobTitle" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <Field label="Account">
          <select name="accountId" value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className={inputClass} style={inputStyle}>
            <option value="">No account</option>
            {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>Could not create contact.</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Contact"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { data, isLoading } = useQuery<Paginated<Contact>>({
    queryKey: ["contacts", search],
    queryFn: async () => (await api.get("/contacts", { params: { search, pageSize: 50 } })).data,
  });

  return (
    <div>
      <PageHeader title="Contacts" subtitle="People at the accounts you work with." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Contact</Button>} />
      <div className="px-8">
        <div className="relative w-72 mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts…" className={`${inputClass} pl-8`} style={inputStyle} />
        </div>
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState title="No contacts yet" action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Contact</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Title", "Account", "Email", "Stage"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3">
                      <Link to={`/contacts/${c.id}`} className="flex items-center gap-2.5 font-medium">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: "var(--ink-600)" }}>{initials(c.firstName, c.lastName)}</div>
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{c.jobTitle || "—"}</td>
                    <td className="px-4 py-3">{c.account ? <Link to={`/accounts/${c.account.id}`} style={{ color: "var(--ledger-700)" }}>{c.account.name}</Link> : "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{c.email || "—"}</td>
                    <td className="px-4 py-3"><Badge>{c.lifecycleStage.replace("_", " ")}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewContactModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
