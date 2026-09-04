import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth, roleLabel, canManageUsers } from "../hooks/useAuth";
import { PageHeader, Card, Button, Badge } from "../components/ui";
import { CsvImportModal, type ImportEntityType } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { initials, formatCurrency } from "../lib/format";
import { Shield, UploadCloud, Download, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";

const roleTone: Record<string, "green" | "amber" | "neutral"> = {
  SENIOR_PARTNER: "green", PARTNER: "amber", MANAGER: "neutral",
};

export default function SettingsPage() {
  const { user: me, tenant } = useAuth();
  const [importEntity, setImportEntity] = useState<ImportEntityType | null>(null);
  const qc = useQueryClient();

  const { data: users } = useQuery<any>({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const { data: stats } = useQuery<any>({ queryKey: ["user-stats"], queryFn: async () => (await api.get("/users/stats")).data });

  const removeUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const canManage = canManageUsers(me);

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader title="Settings" />
      <div className="px-4 md:px-8 pb-10 space-y-6 max-w-4xl">

        {/* Workspace info */}
        <Card className="p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-3 text-[var(--ink-800)]">Workspace</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-[var(--ink-400)]">Company</dt><dd className="font-medium mt-0.5">{tenant?.name}</dd></div>
            <div><dt className="text-xs text-[var(--ink-400)]">Your role</dt><dd className="mt-0.5"><Badge tone={roleTone[me?.orgRole || "MANAGER"]}>{roleLabel(me?.orgRole)}</Badge></dd></div>
          </dl>
        </Card>

        {/* Team */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[var(--ink-800)]">Team members</h3>
            {canManage && (
              <Link to="/org-chart">
                <Button size="sm"><GitBranch size={13} /> Manage in Org Chart</Button>
              </Link>
            )}
          </div>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-[var(--ink-100)]">
                  {["Member", "Role", "Open Opps", "Closed Won", canManage ? "Actions" : ""].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {users?.data?.map((u: any) => {
                    const s = stats?.data?.find((x: any) => x.id === u.id);
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0 bg-[var(--ink-600)]">
                              {initials(u.firstName, u.lastName)}
                            </div>
                            <div>
                              <div className="font-medium text-[var(--ink-900)]">{u.firstName} {u.lastName}</div>
                              <div className="text-xs text-[var(--ink-400)]">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={roleTone[u.orgRole]}>{roleLabel(u.orgRole)}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono-num">{s?.openOpportunities ?? "—"}</td>
                        <td className="px-4 py-3 font-mono-num text-[var(--ledger-700)]">{s ? formatCurrency(s.closedWonRevenue) : "—"}</td>
                        {canManage && (
                          <td className="px-4 py-3">
                            {u.id !== me?.id && (
                              <button
                                onClick={() => { if (confirm(`Remove ${u.firstName}?`)) removeUser.mutate(u.id); }}
                                className="text-xs px-2 py-1 rounded hover:bg-[var(--rose-100)] transition-colors text-[var(--rose-600)]"
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
            </div>
          </Card>
        </div>

        {/* Data Management */}
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--ink-100)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-900)]">Data Management & CSV Center</h3>
              <p className="text-xs text-[var(--ink-500)]">Export your CRM records, import new batch datasets, or download clean CSV templates.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { id: "opportunities" as const, name: "Opportunities", exportPath: "/opportunities/export", file: "opportunities.csv", desc: "Pipeline opportunities with stages, value, forecast categories, and owners." },
              { id: "accounts" as const, name: "Accounts", exportPath: "/accounts/export", file: "accounts.csv", desc: "Company profiles, domains, ARR, and owner assignments." },
              { id: "contacts" as const, name: "Contacts", exportPath: "/contacts/export", file: "contacts.csv", desc: "People, email, phone, job titles, and account links." },
              { id: "leads" as const, name: "Leads", exportPath: "/leads/export", file: "leads.csv", desc: "Prospects, lead sources, scores, and qualification." },
            ].map((item) => (
              <div key={item.id} className="p-3.5 rounded-lg border border-[var(--ink-100)] bg-[var(--ink-50)] flex flex-col justify-between">
                <div>
                  <div className="font-semibold text-sm text-[var(--ink-900)]">{item.name}</div>
                  <p className="text-xs text-[var(--ink-500)] mt-0.5">{item.desc}</p>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--ink-100)]">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setImportEntity(item.id)}
                    className="text-xs"
                  >
                    <UploadCloud size={13} className="mr-1" /> Import
                  </Button>
                  {me?.orgRole !== "MANAGER" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadCsvExport(item.exportPath, {}, item.file)}
                      className="text-xs"
                    >
                      <Download size={13} className="mr-1" /> Export
                    </Button>
                  )}
                </div>
              </div>
            ))}

            <div className="p-3.5 rounded-lg border border-[var(--ink-100)] bg-[var(--ink-50)] flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-[var(--ink-900)]">Quotes & Price Proposals</div>
                <p className="text-xs text-[var(--ink-500)] mt-0.5">Export all formal quotes with line totals and expiration dates.</p>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--ink-100)]">
                {me?.orgRole !== "MANAGER" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadCsvExport("/quotes/export", {}, "quotes.csv")}
                    className="text-xs"
                  >
                    <Download size={13} className="mr-1" /> Export Quotes CSV
                  </Button>
                ) : (
                  <span className="text-xs text-[var(--ink-400)] italic">Export restricted for Manager</span>
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-[var(--ink-100)] bg-[var(--ink-50)] flex flex-col justify-between">
              <div>
                <div className="font-semibold text-sm text-[var(--ink-900)]">Tasks & Activity Log</div>
                <p className="text-xs text-[var(--ink-500)] mt-0.5">Export all tasks, calls, meetings, and follow-ups across the team.</p>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--ink-100)]">
                {me?.orgRole !== "MANAGER" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => downloadCsvExport("/activities/export", {}, "tasks.csv")}
                    className="text-xs"
                  >
                    <Download size={13} className="mr-1" /> Export Tasks CSV
                  </Button>
                ) : (
                  <span className="text-xs text-[var(--ink-400)] italic">Export restricted for Manager</span>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* RBAC info (Only shown to Partner and Senior Partner) */}
        {me?.orgRole !== "MANAGER" && (
          <Card className="p-4 md:p-5">
            <div className="flex items-center gap-2 mb-3"><Shield size={15} className="text-[var(--ledger-600)]" /><h3 className="text-sm font-semibold text-[var(--ink-800)]">Role permissions</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="border-b border-[var(--ink-100)]">
                  {["Permission", "Manager", "Partner", "Senior Partner"].map(h => (
                    <th key={h} className="py-2 px-3 text-left font-medium text-[var(--ink-500)]">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {[
                    ["View assigned / team records", "✓", "✓", "✓"],
                    ["Create / edit records", "✓", "✓", "✓"],
                    ["Export CRM datasets (CSV)", "—", "✓", "✓"],
                    ["View team org chart", "—", "✓", "✓"],
                    ["Manage team members", "—", "✓", "✓"],
                    ["View all tenant reports", "—", "—", "✓"],
                  ].map(([perm, ...vals]) => (
                    <tr key={perm} className="border-b last:border-0 border-[var(--ink-50)]">
                      <td className="py-2 px-3 text-[var(--ink-600)]">{perm}</td>
                      {vals.map((v, i) => <td key={i} className="py-2 px-3 text-center" style={{ color: v === "✓" ? "var(--ledger-600)" : "var(--ink-300)" }}>{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
      {importEntity && <CsvImportModal entity={importEntity} onClose={() => setImportEntity(null)} />}
    </div>
  );
}
