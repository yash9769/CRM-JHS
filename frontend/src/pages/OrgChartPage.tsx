import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, roleLabel, canManageUsers } from "../hooks/useAuth";
import { formatCurrency, relativeTime } from "../lib/format";
import { StageBadge, Badge } from "../components/ui";
import {
  UserPlus, Trash2, Edit2, X, Shield, Users, Star,
  Eye, Trophy, TrendingUp, Target, Building2, Phone, Mail,
  Calendar, FileText, CheckSquare, Activity, ExternalLink,
  Briefcase, Award,
} from "lucide-react";

// ── Role badge ─────────────────────────────────────────────────────────────
export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { bg: string; text: string; icon: any }> = {
    SENIOR_PARTNER: { bg: "#0d2744", text: "#93c5fd", icon: Star },
    PARTNER: { bg: "#14532d", text: "#86efac", icon: Shield },
    MANAGER: { bg: "#1e1b4b", text: "#a5b4fc", icon: Users },
  };
  const cfg = map[role] || { bg: "#1f2937", text: "#9ca3af", icon: Users };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <Icon size={10} />
      {roleLabel(role)}
    </span>
  );
}

// ── User card ──────────────────────────────────────────────────────────────
function UserCard({
  user,
  canEdit,
  onEdit,
  onDelete,
  onSelect,
}: {
  user: any;
  canEdit: boolean;
  onEdit: (u: any) => void;
  onDelete: (u: any) => void;
  onSelect?: (u: any) => void;
}) {
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  return (
    <div
      onClick={() => onSelect && onSelect(user)}
      className="rounded-2xl border flex flex-col gap-3 p-4 transition-all hover:shadow-lg hover:border-[var(--ledger-600)] cursor-pointer group relative"
      style={{
        background: "white",
        borderColor: "var(--ink-100)",
        minWidth: 240,
      }}
    >
      {/* Bird's eye indicator badge */}
      <div
        className="absolute top-3 right-3 text-xs font-semibold px-2 py-0.5 rounded-full opacity-80 group-hover:opacity-100 transition-opacity flex items-center gap-1"
        style={{ background: "var(--ink-100)", color: "var(--ledger-700)" }}
        title="Click to view Bird's-Eye Activity & Performance"
      >
        <Eye size={11} />
        <span className="text-[10px]">Bird's-Eye</span>
      </div>

      {/* Avatar + name */}
      <div className="flex items-center gap-3 pr-16">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 group-hover:scale-105 transition-transform"
          style={{ background: "var(--ledger-700)" }}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate group-hover:text-[var(--ledger-700)] transition-colors">
            {user.firstName} {user.lastName}
          </div>
          <div className="text-[11px] truncate" style={{ color: "var(--ink-400)" }}>
            {user.email}
          </div>
        </div>
      </div>

      <RoleBadge role={user.orgRole} />

      {user.partner && (
        <div className="text-[11px]" style={{ color: "var(--ink-400)" }}>
          Reports to: <span className="font-medium" style={{ color: "var(--ink-600)" }}>{user.partner.firstName} {user.partner.lastName}</span>
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex gap-1.5 pt-2 border-t mt-1" style={{ borderColor: "var(--ink-100)" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(user); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-[var(--ink-50)]"
            style={{ color: "var(--ink-500)" }}
          >
            <Edit2 size={11} /> Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(user); }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-red-50"
            style={{ color: "#dc2626" }}
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bird's-Eye View Modal ──────────────────────────────────────────────────
export function BirdsEyeModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"activity" | "deals" | "opportunities" | "accounts" | "team">("activity");

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["user-bird-eye", userId],
    queryFn: async () => (await api.get(`/users/${userId}/bird-eye`)).data,
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-3">
          <Eye size={32} className="mx-auto animate-pulse" style={{ color: "var(--ledger-600)" }} />
          <p className="text-sm font-semibold" style={{ color: "var(--ink-800)" }}>Loading Bird's-Eye Activity…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-2xl space-y-3">
          <p className="text-sm font-medium" style={{ color: "#dc2626" }}>Could not load user activity details.</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--ink-100)]">Close</button>
        </div>
      </div>
    );
  }

  const { user, teamMembers = [], kpis = {}, recentActivities = [], recentDeals = [], recentOpps = [], accounts = [] } = data;
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();

  const activityIcons: Record<string, any> = {
    CALL: Phone,
    EMAIL: Mail,
    MEETING: Calendar,
    TASK: CheckSquare,
    NOTE: FileText,
    DEMO: Activity,
    PROPOSAL: Award,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border" style={{ borderColor: "var(--ink-100)" }}>
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between" style={{ background: "var(--ink-50)", borderColor: "var(--ink-100)" }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md" style={{ background: "var(--ledger-700)" }}>
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold" style={{ color: "var(--ink-900)" }}>{user.firstName} {user.lastName}</h2>
                <RoleBadge role={user.orgRole} />
              </div>
              <p className="text-xs mt-0.5" style={{ color: "var(--ink-500)" }}>{user.email}</p>
              {user.partner && (
                <p className="text-xs mt-1" style={{ color: "var(--ink-400)" }}>
                  Reports to: <span className="font-semibold" style={{ color: "var(--ink-700)" }}>{user.partner.firstName} {user.partner.lastName}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--ink-100)] transition-colors">
            <X size={18} style={{ color: "var(--ink-400)" }} />
          </button>
        </div>

        {/* Top KPI Summary */}
        <div className="grid grid-cols-4 gap-3 p-6 bg-white border-b" style={{ borderColor: "var(--ink-100)" }}>
          <div className="p-3.5 rounded-xl border bg-emerald-50/40 border-emerald-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 mb-1">
              <Trophy size={14} className="text-emerald-600" />
              <span>Closed Won Revenue</span>
            </div>
            <div className="text-lg font-mono-num font-bold text-emerald-900">
              {formatCurrency(kpis.closedWonRevenue)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              {kpis.closedWonCount} deals closed won
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-blue-50/40 border-blue-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 mb-1">
              <TrendingUp size={14} className="text-blue-600" />
              <span>Open Pipeline</span>
            </div>
            <div className="text-lg font-mono-num font-bold text-blue-900">
              {formatCurrency(kpis.openPipelineRevenue)}
            </div>
            <div className="text-[11px] text-blue-700 font-medium mt-1">
              {kpis.openDealsCount} active deals in progress
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-amber-50/40 border-amber-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1">
              <Target size={14} className="text-amber-600" />
              <span>Opportunities</span>
            </div>
            <div className="text-lg font-mono-num font-bold text-amber-900">
              {kpis.openOpportunitiesCount}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Open qualified opps
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-purple-50/40 border-purple-100">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-800 mb-1">
              <Building2 size={14} className="text-purple-600" />
              <span>Accounts & Activities</span>
            </div>
            <div className="text-lg font-mono-num font-bold text-purple-900">
              {kpis.accountsCount} <span className="text-xs font-normal text-purple-700">Accounts</span>
            </div>
            <div className="text-[11px] text-purple-700 font-medium mt-1">
              {kpis.activitiesCount} activities logged
            </div>
          </div>
        </div>

        {/* Tab Sub-header */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b text-xs font-medium" style={{ background: "var(--ink-50)", borderColor: "var(--ink-100)" }}>
          <button
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === "activity"
                ? "border-[var(--ledger-700)] text-[var(--ledger-700)]"
                : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-800)]"
            }`}
          >
            <Activity size={13} /> Activity Feed ({recentActivities.length})
          </button>

          <button
            onClick={() => setActiveTab("deals")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === "deals"
                ? "border-[var(--ledger-700)] text-[var(--ledger-700)]"
                : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-800)]"
            }`}
          >
            <Briefcase size={13} /> Deals ({recentDeals.length})
          </button>

          <button
            onClick={() => setActiveTab("opportunities")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === "opportunities"
                ? "border-[var(--ledger-700)] text-[var(--ledger-700)]"
                : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-800)]"
            }`}
          >
            <Target size={13} /> Opportunities ({recentOpps.length})
          </button>

          <button
            onClick={() => setActiveTab("accounts")}
            className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
              activeTab === "accounts"
                ? "border-[var(--ledger-700)] text-[var(--ledger-700)]"
                : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-800)]"
            }`}
          >
            <Building2 size={13} /> Accounts ({accounts.length})
          </button>

          {user.orgRole === "PARTNER" && (
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-colors ${
                activeTab === "team"
                  ? "border-[var(--ledger-700)] text-[var(--ledger-700)]"
                  : "border-transparent text-[var(--ink-500)] hover:text-[var(--ink-800)]"
              }`}
            >
              <Users size={13} /> Team Managers ({teamMembers.length})
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 max-h-[480px]">
          {activeTab === "activity" && (
            <div>
              {recentActivities.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--ink-400)" }}>No recent activity logged for this user.</div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((act: any) => {
                    const ActIcon = activityIcons[act.type] || Activity;
                    return (
                      <div key={act.id} className="flex items-start gap-3 p-3 rounded-xl border hover:bg-[var(--ink-50)] transition-colors" style={{ borderColor: "var(--ink-100)" }}>
                        <div className="p-2 rounded-lg shrink-0" style={{ background: "var(--ink-100)", color: "var(--ledger-700)" }}>
                          <ActIcon size={15} />
                        </div>
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate" style={{ color: "var(--ink-900)" }}>{act.subject}</span>
                            <span className="text-[11px] font-mono-num whitespace-nowrap" style={{ color: "var(--ink-400)" }}>{relativeTime(act.createdAt)}</span>
                          </div>
                          {act.body && <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: "var(--ink-600)" }}>{act.body}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                            <Badge tone={act.status === "COMPLETED" ? "green" : "neutral"}>{act.type}</Badge>
                            {act.account && <span className="font-medium" style={{ color: "var(--ink-500)" }}>Account: {act.account.name}</span>}
                            {act.deal && <span className="font-medium" style={{ color: "var(--ink-500)" }}>Deal: {act.deal.name}</span>}
                            {act.opportunity && <span className="font-medium" style={{ color: "var(--ink-500)" }}>Opp: {act.opportunity.name}</span>}
                            {act.owner && (
                              <span className="ml-auto" style={{ color: "var(--ink-400)" }}>By: {act.owner.firstName} {act.owner.lastName}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "deals" && (
            <div>
              {recentDeals.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--ink-400)" }}>No deals assigned to this user or team.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b uppercase font-semibold" style={{ borderColor: "var(--ink-100)", color: "var(--ink-400)" }}>
                      <th className="pb-2">Deal Name</th>
                      <th className="pb-2">Account</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2">Stage</th>
                      <th className="pb-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentDeals.map((d: any) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                        <td className="py-2.5 font-semibold" style={{ color: "var(--ledger-700)" }}>
                          <Link to={`/deals/${d.id}`} className="hover:underline flex items-center gap-1" onClick={onClose}>
                            {d.name} <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-2.5" style={{ color: "var(--ink-700)" }}>{d.account?.name || "—"}</td>
                        <td className="py-2.5 font-mono-num font-bold" style={{ color: "var(--ink-900)" }}>{formatCurrency(d.amount)}</td>
                        <td className="py-2.5"><StageBadge stage={d.stage} /></td>
                        <td className="py-2.5" style={{ color: "var(--ink-500)" }}>{d.owner?.firstName} {d.owner?.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "opportunities" && (
            <div>
              {recentOpps.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--ink-400)" }}>No opportunities assigned.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b uppercase font-semibold" style={{ borderColor: "var(--ink-100)", color: "var(--ink-400)" }}>
                      <th className="pb-2">Opportunity Name</th>
                      <th className="pb-2">Account</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2">Stage</th>
                      <th className="pb-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOpps.map((o: any) => (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                        <td className="py-2.5 font-semibold" style={{ color: "var(--ledger-700)" }}>
                          <Link to={`/opportunities/${o.id}`} className="hover:underline flex items-center gap-1" onClick={onClose}>
                            {o.name} <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-2.5" style={{ color: "var(--ink-700)" }}>{o.account?.name || "—"}</td>
                        <td className="py-2.5 font-mono-num font-bold" style={{ color: "var(--ink-900)" }}>{formatCurrency(o.amount)}</td>
                        <td className="py-2.5"><StageBadge stage={o.stage} /></td>
                        <td className="py-2.5" style={{ color: "var(--ink-500)" }}>{o.owner?.firstName} {o.owner?.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "accounts" && (
            <div>
              {accounts.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--ink-400)" }}>No accounts assigned.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b uppercase font-semibold" style={{ borderColor: "var(--ink-100)", color: "var(--ink-400)" }}>
                      <th className="pb-2">Account Name</th>
                      <th className="pb-2">Industry</th>
                      <th className="pb-2">Annual Revenue</th>
                      <th className="pb-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc: any) => (
                      <tr key={acc.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                        <td className="py-2.5 font-semibold" style={{ color: "var(--ledger-700)" }}>
                          <Link to={`/accounts/${acc.id}`} className="hover:underline flex items-center gap-1" onClick={onClose}>
                            {acc.name} <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-2.5" style={{ color: "var(--ink-600)" }}>{acc.industry || "—"}</td>
                        <td className="py-2.5 font-mono-num font-bold" style={{ color: "var(--ink-900)" }}>{formatCurrency(acc.annualRevenue)}</td>
                        <td className="py-2.5" style={{ color: "var(--ink-500)" }}>{acc.owner?.firstName} {acc.owner?.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === "team" && user.orgRole === "PARTNER" && (
            <div>
              {teamMembers.length === 0 ? (
                <div className="text-center py-10 text-xs" style={{ color: "var(--ink-400)" }}>No managers assigned under this Partner yet.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {teamMembers.map((m: any) => (
                    <div key={m.id} className="p-3.5 rounded-xl border flex items-center gap-3" style={{ borderColor: "var(--ink-100)", background: "var(--ink-50)" }}>
                      <div className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center" style={{ background: "var(--ledger-700)" }}>
                        {m.firstName?.[0]}{m.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[var(--ink-900)]">{m.firstName} {m.lastName}</div>
                        <div className="text-[11px] text-[var(--ink-400)]">{m.email}</div>
                        <div className="mt-1"><RoleBadge role={m.orgRole} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add User modal ─────────────────────────────────────────────────────────
function AddUserModal({
  actorOrgRole,
  partners,
  onClose,
}: {
  actorOrgRole: string;
  partners: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    orgRole: actorOrgRole === "SENIOR_PARTNER" ? "PARTNER" : "MANAGER",
    partnerId: "",
    password: "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/users", {
        ...form,
        partnerId: form.orgRole === "MANAGER" ? (form.partnerId || undefined) : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-chart"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || "Could not create user"),
  });

  const inputCls =
    "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--ledger-600)] focus:border-transparent";
  const inputStyle = { borderColor: "var(--ink-200)", background: "var(--ink-50)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--ink-100)" }}>
          <h2 className="font-semibold text-base flex items-center gap-2">
            <UserPlus size={16} style={{ color: "var(--ledger-600)" }} />
            Add team member
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--ink-50)]">
            <X size={16} style={{ color: "var(--ink-400)" }} />
          </button>
        </div>
        <form
          className="px-6 py-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>First name</label>
              <input required className={inputCls} style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Last name</label>
              <input required className={inputCls} style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Email</label>
            <input required type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {actorOrgRole === "SENIOR_PARTNER" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Role</label>
              <select className={inputCls} style={inputStyle} value={form.orgRole} onChange={(e) => setForm({ ...form, orgRole: e.target.value })}>
                <option value="PARTNER">Partner</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          )}

          {(actorOrgRole === "SENIOR_PARTNER" && form.orgRole === "MANAGER") && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Reports to (Partner)</label>
              <select required className={inputCls} style={inputStyle} value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">— Select Partner —</option>
                {partners.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Temporary password</label>
            <input required type="password" minLength={8} className={inputCls} style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-200)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--ledger-700)" }}
            >
              {mutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit User modal ────────────────────────────────────────────────────────
function EditUserModal({
  user,
  actorOrgRole,
  partners,
  onClose,
}: {
  user: any;
  actorOrgRole: string;
  partners: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email || "",
    orgRole: user.orgRole || "MANAGER",
    partnerId: user.partnerId || "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/users/${user.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        ...(actorOrgRole === "SENIOR_PARTNER"
          ? {
              orgRole: form.orgRole,
              partnerId: form.orgRole === "MANAGER" ? (form.partnerId || null) : null,
            }
          : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-chart"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error || "Could not update user"),
  });

  const inputCls =
    "w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-[var(--ledger-600)] focus:border-transparent";
  const inputStyle = { borderColor: "var(--ink-200)", background: "var(--ink-50)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--ink-100)" }}>
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Edit2 size={16} style={{ color: "var(--ledger-600)" }} />
            Edit team member
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--ink-50)]">
            <X size={16} style={{ color: "var(--ink-400)" }} />
          </button>
        </div>
        <form
          className="px-6 py-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError("");
            mutation.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>First name</label>
              <input required className={inputCls} style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Last name</label>
              <input required className={inputCls} style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Email</label>
            <input required type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {actorOrgRole === "SENIOR_PARTNER" && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Role</label>
              <select className={inputCls} style={inputStyle} value={form.orgRole} onChange={(e) => setForm({ ...form, orgRole: e.target.value })}>
                <option value="PARTNER">Partner</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          )}

          {(actorOrgRole === "SENIOR_PARTNER" && form.orgRole === "MANAGER") && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-600)" }}>Reports to (Partner)</label>
              <select className={inputCls} style={inputStyle} value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {partners.filter((p: any) => p.id !== user.id).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-200)" }}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--ledger-700)" }}
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function OrgChartPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteError, setDeleteError] = useState("");
  const [birdEyeUser, setBirdEyeUser] = useState<any>(null);

  // Redirect Managers away
  if (me?.orgRole === "MANAGER") return <Navigate to="/" replace />;

  const { data, isLoading } = useQuery<any>({
    queryKey: ["org-chart"],
    queryFn: async () => (await api.get("/users/org-chart")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-chart"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
    },
    onError: (e: any) => setDeleteError(e?.response?.data?.error || "Could not remove user"),
  });

  const seniorPartner = data?.seniorPartner;
  const partners: any[] = data?.partners || [];
  const managers: any[] = data?.managers || [];

  const canEdit = canManageUsers(me);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading org chart…</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ink-900)" }}>Org Chart</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-400)" }}>
            Team hierarchy and reporting structure. Click any member card to open their Bird's-Eye View activity & performance.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
            style={{ background: "var(--ledger-700)" }}
          >
            <UserPlus size={15} />
            Add member
          </button>
        )}
      </div>

      {/* Senior Partner */}
      {seniorPartner && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: "var(--ink-400)" }}>Senior Partner</span>
            <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
          </div>
          <div className="flex justify-center">
            <UserCard
              user={seniorPartner}
              canEdit={false}
              onEdit={() => {}}
              onDelete={() => {}}
              onSelect={(u) => setBirdEyeUser(u)}
            />
          </div>
        </div>
      )}

      {/* Connector line */}
      {partners.length > 0 && (
        <div className="flex justify-center mb-4">
          <div className="w-px h-8" style={{ background: "var(--ink-200)" }} />
        </div>
      )}

      {/* Partners row */}
      {partners.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: "var(--ink-400)" }}>Partners</span>
            <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
          </div>

          {/* Horizontal connector */}
          {partners.length > 1 && (
            <div className="flex justify-center mb-4">
              <div
                className="h-px"
                style={{
                  background: "var(--ink-200)",
                  width: `${Math.min(partners.length * 260, 900)}px`,
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-4">
            {partners.map((partner) => (
              <div key={partner.id} className="flex flex-col items-center gap-0">
                <UserCard
                  user={partner}
                  canEdit={canEdit && me?.orgRole === "SENIOR_PARTNER"}
                  onEdit={(u) => setEditUser(u)}
                  onDelete={(u) => { setDeleteTarget(u); setDeleteError(""); }}
                  onSelect={(u) => setBirdEyeUser(u)}
                />

                {/* Partner's managers */}
                {(() => {
                  const myManagers = managers.filter((m) => m.partnerId === partner.id);
                  if (!myManagers.length) return null;
                  return (
                    <div className="flex flex-col items-center gap-0 mt-0">
                      <div className="w-px h-6" style={{ background: "var(--ink-200)" }} />
                      {myManagers.length > 1 && (
                        <div
                          className="h-px mb-0"
                          style={{
                            background: "var(--ink-200)",
                            width: `${myManagers.length * 230}px`,
                            maxWidth: "600px",
                          }}
                        />
                      )}
                      <div className="flex flex-wrap justify-center gap-3 mt-0">
                        {myManagers.map((mgr) => (
                          <div key={mgr.id} className="flex flex-col items-center">
                            <div className="w-px h-4" style={{ background: "var(--ink-200)" }} />
                            <UserCard
                              user={mgr}
                              canEdit={canEdit}
                              onEdit={(u) => setEditUser(u)}
                              onDelete={(u) => { setDeleteTarget(u); setDeleteError(""); }}
                              onSelect={(u) => setBirdEyeUser(u)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unattached managers (SP-created without partnerId) */}
      {(() => {
        const orphans = managers.filter((m) => !m.partnerId);
        if (!orphans.length) return null;
        return (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: "var(--ink-400)" }}>Managers (unassigned)</span>
              <div className="h-px flex-1" style={{ background: "var(--ink-100)" }} />
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {orphans.map((mgr) => (
                <UserCard
                  key={mgr.id}
                  user={mgr}
                  canEdit={canEdit}
                  onEdit={(u) => setEditUser(u)}
                  onDelete={(u) => { setDeleteTarget(u); setDeleteError(""); }}
                  onSelect={(u) => setBirdEyeUser(u)}
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Empty state */}
      {!seniorPartner && !isLoading && (
        <div className="text-center py-20" style={{ color: "var(--ink-400)" }}>
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No team members yet.</p>
        </div>
      )}

      {/* Bird's-Eye View Modal */}
      {birdEyeUser && (
        <BirdsEyeModal
          userId={birdEyeUser.id}
          onClose={() => setBirdEyeUser(null)}
        />
      )}

      {/* Edit user modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          actorOrgRole={me?.orgRole || "PARTNER"}
          partners={partners}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Add user modal */}
      {showAdd && (
        <AddUserModal
          actorOrgRole={me?.orgRole || "PARTNER"}
          partners={partners}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Confirm delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="font-semibold text-base mb-2">Remove {deleteTarget.firstName} {deleteTarget.lastName}?</h2>
            <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
              This will permanently remove this user. Their owned CRM records will be reassigned to you.
            </p>
            {deleteError && <p className="text-xs mb-3" style={{ color: "#dc2626" }}>{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-sm border hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-200)" }}>
                Cancel
              </button>
              <button
                onClick={() => {
                  setDeleteError("");
                  deleteMutation.mutate(deleteTarget.id);
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "#dc2626" }}
              >
                <Trash2 size={13} />
                {deleteMutation.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
