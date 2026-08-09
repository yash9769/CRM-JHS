import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatDate } from "../lib/format";
import type { Account, Paginated } from "../lib/types";
import { Plus, Search, Building2 } from "lucide-react";

const typeTone: Record<string, "neutral" | "green" | "amber"> = {
  PROSPECT: "amber", CUSTOMER: "green", PARTNER: "neutral", FORMER_CUSTOMER: "neutral",
};

function NewAccountModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", domain: "", industry: "", accountType: "PROSPECT" });
  const mutation = useMutation({
    mutationFn: () => api.post("/accounts", form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
  });

  return (
    <Modal title="New Account" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Company name" required>
          <input name="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} placeholder="Acme Technologies" />
        </Field>
        <Field label="Domain">
          <input name="domain" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className={inputClass} style={inputStyle} placeholder="acme.com" />
        </Field>
        <Field label="Industry">
          <input name="industry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className={inputClass} style={inputStyle} placeholder="Technology" />
        </Field>
        <Field label="Type">
          <select name="accountType" value={form.accountType} onChange={(e) => setForm({ ...form, accountType: e.target.value })} className={inputClass} style={inputStyle}>
            <option value="PROSPECT">Prospect</option>
            <option value="CUSTOMER">Customer</option>
            <option value="PARTNER">Partner</option>
            <option value="FORMER_CUSTOMER">Former Customer</option>
          </select>
        </Field>
        {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>Could not create account.</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccountsPage() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const { data, isLoading } = useQuery<Paginated<Account>>({
    queryKey: ["accounts", search],
    queryFn: async () => (await api.get("/accounts", { params: { search, pageSize: 50 } })).data,
  });

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Companies and organizations you sell to."
        action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Account</Button>}
      />
      <div className="px-8">
        <div className="relative w-72 mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts…" className={`${inputClass} pl-8`} style={inputStyle} />
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState title="No accounts yet" subtitle="Create your first account to start tracking a customer." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Account</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {["Account", "Industry", "Type", "Owner", "Contacts", "Open Opps", "Deals", "Updated"].map((h) => (
                    <th key={h} className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3">
                      <Link to={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-medium" style={{ color: "var(--ink-900)" }}>
                        <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--ink-50)" }}>
                          <Building2 size={13} style={{ color: "var(--ink-500)" }} />
                        </div>
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{a.industry || "—"}</td>
                    <td className="px-4 py-3"><Badge tone={typeTone[a.accountType]}>{a.accountType.replace("_", " ")}</Badge></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : "—"}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-600)" }}>{a._count?.contacts ?? 0}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-600)" }}>{a._count?.opportunities ?? 0}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-600)" }}>{a._count?.deals ?? 0}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-400)" }}>{formatDate(a.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
