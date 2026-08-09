import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle } from "../components/ui";
import { initials, formatCurrency } from "../lib/format";
import { UserPlus, Shield } from "lucide-react";

const roleTone: Record<string, "green" | "amber" | "neutral"> = {
  ADMIN: "green", SALES_MANAGER: "amber", SALES_REP: "neutral", VIEWER: "neutral",
};

function InviteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", role: "SALES_REP", password: "" });
  const mutation = useMutation({
    mutationFn: () => api.post("/users/invite", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); onClose(); },
  });
  return (
    <Modal title="Invite team member" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required><input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className={inputClass} style={inputStyle} /></Field>
          <Field label="Last name" required><input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        </div>
        <Field label="Email" required><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        <Field label="Role">
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputClass} style={inputStyle}>
            <option value="SALES_REP">Sales Rep</option>
            <option value="SALES_MANAGER">Sales Manager</option>
            <option value="ADMIN">Admin</option>
            <option value="VIEWER">Viewer</option>
          </select>
        </Field>
        <Field label="Temporary password" required><input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} style={inputStyle} /></Field>
        {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>{(mutation.error as any)?.response?.data?.error || "Could not invite user."}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Inviting…" : "Invite"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function SettingsPage() {
  const { user: me, tenant } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const qc = useQueryClient();

  const { data: users } = useQuery<any>({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const { data: stats } = useQuery<any>({ queryKey: ["user-stats"], queryFn: async () => (await api.get("/users/stats")).data });

  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const isAdmin = me?.role === "ADMIN";

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your workspace and team." />
      <div className="px-8 pb-10 space-y-6 max-w-4xl">

        {/* Workspace info */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Workspace</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Company</dt><dd className="font-medium mt-0.5">{tenant?.name}</dd></div>
            <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Your role</dt><dd className="mt-0.5"><Badge tone={roleTone[me?.role || "VIEWER"]}>{me?.role?.replace("_", " ")}</Badge></dd></div>
          </dl>
        </Card>

        {/* Team */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold" style={{ color: "var(--ink-800)" }}>Team members</h3>
            {isAdmin && <Button size="sm" onClick={() => setShowInvite(true)}><UserPlus size={13} /> Invite</Button>}
          </div>
          <Card>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Member", "Role", "Open Deals", "Pipeline", "Closed Won", isAdmin ? "Actions" : ""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {users?.data?.map((u: any) => {
                  const s = stats?.data?.find((x: any) => x.id === u.id);
                  return (
                    <tr key={u.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0" style={{ background: "var(--ink-600)" }}>
                            {initials(u.firstName, u.lastName)}
                          </div>
                          <div>
                            <div className="font-medium">{u.firstName} {u.lastName}</div>
                            <div className="text-xs" style={{ color: "var(--ink-400)" }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && u.id !== me?.id ? (
                          <select
                            value={u.role}
                            onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value })}
                            className="text-xs px-2 py-1 rounded-md border"
                            style={{ borderColor: "var(--ink-200)" }}
                          >
                            <option value="ADMIN">Admin</option>
                            <option value="SALES_MANAGER">Sales Manager</option>
                            <option value="SALES_REP">Sales Rep</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                        ) : (
                          <Badge tone={roleTone[u.role]}>{u.role.replace("_", " ")}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono-num">{s?.openDeals ?? "—"}</td>
                      <td className="px-4 py-3 font-mono-num">{s ? formatCurrency(s.openDeals * 0) : "—"}</td>
                      <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ledger-700)" }}>{s ? formatCurrency(s.closedWonRevenue) : "—"}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          {u.id !== me?.id && (
                            <button
                              onClick={() => { if (confirm(`Remove ${u.firstName}?`)) removeUser.mutate(u.id); }}
                              className="text-xs px-2 py-1 rounded hover:bg-[var(--rose-100)] transition-colors"
                              style={{ color: "var(--rose-600)" }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        {/* RBAC info */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3"><Shield size={15} style={{ color: "var(--ledger-600)" }} /><h3 className="text-sm font-semibold" style={{ color: "var(--ink-800)" }}>Role permissions</h3></div>
          <table className="w-full text-xs">
            <thead><tr className="border-b" style={{ borderColor: "var(--ink-100)" }}>
              {["Permission", "Viewer", "Sales Rep", "Sales Manager", "Admin"].map(h => (
                <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: "var(--ink-500)" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[
                ["View records", "✓", "✓", "✓", "✓"],
                ["Create / edit own records", "—", "✓", "✓", "✓"],
                ["Edit all records", "—", "—", "✓", "✓"],
                ["Manage pipelines", "—", "—", "✓", "✓"],
                ["Invite / manage users", "—", "—", "—", "✓"],
                ["View all reports", "—", "—", "✓", "✓"],
              ].map(([perm, ...vals]) => (
                <tr key={perm} className="border-b last:border-0" style={{ borderColor: "var(--ink-50)" }}>
                  <td className="py-2 px-3" style={{ color: "var(--ink-600)" }}>{perm}</td>
                  {vals.map((v, i) => <td key={i} className="py-2 px-3 text-center" style={{ color: v === "✓" ? "var(--ledger-600)" : "var(--ink-300)" }}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}
    </div>
  );
}
