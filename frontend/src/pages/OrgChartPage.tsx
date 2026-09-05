import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth, roleLabel, canManageUsers } from "../hooks/useAuth";
import { formatCurrency, relativeTime } from "../lib/format";
import { StageBadge, Badge } from "../components/ui";
import {
  UserPlus, Trash2, Edit2, X, Users,
  Eye, Trophy, TrendingUp, Target, Building2, Phone, Mail,
  Calendar, FileText, CheckSquare, Activity, ExternalLink,
  Award, Search, Network, Grid, ChevronDown, ChevronRight,
  Sparkles, Crown, ShieldCheck, UserCheck
} from "lucide-react";

// ── Role Config & Badge ──────────────────────────────────────────────────────
const roleConfig: Record<string, { bg: string; text: string; border: string; accent: string; icon: any; title: string }> = {
  SENIOR_PARTNER: {
    bg: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    text: "#f8fafc",
    border: "#3b82f6",
    accent: "#60a5fa",
    icon: Crown,
    title: "Senior Partner / Executive",
  },
  PARTNER: {
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 100%)",
    text: "#ecfdf5",
    border: "#10b981",
    accent: "#34d399",
    icon: ShieldCheck,
    title: "Partner / Sales Lead",
  },
  MANAGER: {
    bg: "linear-gradient(135deg, #312e81 0%, #4338ca 100%)",
    text: "#eef2ff",
    border: "#6366f1",
    accent: "#818cf8",
    icon: Users,
    title: "Sales Manager / Rep",
  },
};

export function RoleBadge({ role }: { role: string }) {
  const cfg = roleConfig[role] || {
    bg: "#1f2937",
    text: "#f3f4f6",
    border: "#4b5563",
    accent: "#9ca3af",
    icon: Users,
    title: role,
  };
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shadow-xs transition-transform hover:scale-105"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}40` }}
    >
      <Icon size={12} style={{ color: cfg.accent }} />
      <span>{roleLabel(role)}</span>
    </span>
  );
}

// ── User card ──────────────────────────────────────────────────────────────
function EnhancedUserCard({
  user,
  canEdit,
  isExpanded,
  hasChildren,
  onToggleExpand,
  onEdit,
  onDelete,
  onSelect,
}: {
  user: any;
  canEdit: boolean;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggleExpand?: () => void;
  onEdit: (u: any) => void;
  onDelete: (u: any) => void;
  onSelect?: (u: any) => void;
}) {
  const initials = `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase();
  const cfg = roleConfig[user.orgRole] || roleConfig.MANAGER;

  return (
    <div
      onClick={() => onSelect && onSelect(user)}
      className="group relative rounded-2xl border bg-white p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer overflow-hidden"
      style={{
        borderColor: "var(--ink-100)",
        minWidth: 270,
        maxWidth: 320,
        boxShadow: "0 4px 20px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      {/* Top Gradient Header Line */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 transition-all group-hover:h-2"
        style={{ background: cfg.bg }}
      />

      {/* Card Header & Avatar */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md transition-transform group-hover:scale-110"
            style={{ background: cfg.bg }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate text-[var(--ink-900)] group-hover:text-[var(--ledger-700)] transition-colors">
              {user.firstName} {user.lastName}
            </h4>
            <p className="text-[11px] truncate text-[var(--ink-400)] font-medium">
              {user.email}
            </p>
          </div>
        </div>

        {/* Bird's eye button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect && onSelect(user);
          }}
          className="p-1.5 rounded-lg bg-[var(--ink-50)] text-[var(--ledger-700)] hover:bg-[var(--ledger-50)] hover:text-[var(--ledger-800)] border border-[var(--ink-100)] transition-all shrink-0"
          title="Open Bird's-Eye Performance & Activity Modal"
        >
          <Eye size={14} />
        </button>
      </div>

      {/* Role Badge & Reporting info */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 border-[var(--ink-100)]">
        <RoleBadge role={user.orgRole} />

        {hasChildren && onToggleExpand && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[var(--ink-50)] text-[var(--ink-600)] hover:bg-[var(--ink-100)] transition-colors border border-[var(--ink-200)]"
          >
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span>{isExpanded ? "Collapse" : "Team"}</span>
          </button>
        )}
      </div>

      {user.partner && (
        <div className="mt-2 text-[11px] flex items-center gap-1 text-[var(--ink-500)]">
          <span>Reports to:</span>
          <span className="font-semibold text-[var(--ink-700)] truncate">
            {user.partner.firstName} {user.partner.lastName}
          </span>
        </div>
      )}

      {/* Quick Action Footer */}
      {canEdit && (
        <div
          className="flex items-center gap-1.5 pt-2.5 mt-3 border-t border-[var(--ink-100)]"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(user);
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium text-[var(--ink-600)] hover:bg-[var(--ink-50)] transition-colors"
          >
            <Edit2 size={12} /> Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(user);
            }}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors"
            title="Remove team member"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Bird's-Eye View Modal ──────────────────────────────────────────────────
export function BirdsEyeModal({
  userId,
  onClose,
  onSelectUser,
}: {
  userId: string;
  onClose: () => void;
  onSelectUser?: (user: any) => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"activity" | "opportunities" | "accounts" | "team">("activity");

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["user-bird-eye", userId],
    queryFn: async () => (await api.get(`/users/${userId}/bird-eye`)).data,
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs" onClick={onClose}>
        <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
          <Eye size={32} className="mx-auto animate-pulse text-[var(--ledger-600)]" />
          <p className="text-sm font-semibold text-[var(--ink-800)]">Loading Bird's-Eye Activity…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 max-w-sm text-center shadow-2xl space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm font-medium text-rose-600">Could not load user activity details.</p>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--ink-100)]">Close</button>
        </div>
      </div>
    );
  }

  const { user, teamMembers = [], kpis = {}, recentActivities = [], recentOpps = [], accounts = [] } = data;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-[var(--ink-100)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between bg-[var(--ink-50)] border-[var(--ink-100)]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-md bg-[var(--ledger-700)]">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[var(--ink-900)]">{user.firstName} {user.lastName}</h2>
                <RoleBadge role={user.orgRole} />
              </div>
              <p className="text-xs mt-0.5 text-[var(--ink-500)]">{user.email}</p>
              {user.partner && (
                <p className="text-xs mt-1 text-[var(--ink-400)]">
                  Reports to: <span className="font-semibold text-[var(--ink-700)]">{user.partner.firstName} {user.partner.lastName}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--ink-100)] transition-colors">
            <X size={18} className="text-[var(--ink-400)]" />
          </button>
        </div>

        {/* Top KPI Summary — Clickable Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-6 bg-white border-b border-[var(--ink-100)]">
          <div
            onClick={() => {
              navigate(`/opportunities?ownerId=${user.id}`);
              onClose();
            }}
            className="p-3.5 rounded-xl border bg-emerald-50/40 border-emerald-100 hover:bg-emerald-100/60 hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-800 mb-1">
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className="text-emerald-600" />
                <span>Closed Won Revenue</span>
              </div>
              <ExternalLink size={12} className="text-emerald-600 opacity-70 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-lg font-mono-num font-bold text-emerald-900">
              {formatCurrency(kpis.closedWonRevenue)}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-1">
              {kpis.closedWonCount} opportunities won
            </div>
          </div>

          <div
            onClick={() => {
              navigate(`/opportunities?ownerId=${user.id}`);
              onClose();
            }}
            className="p-3.5 rounded-xl border bg-blue-50/40 border-blue-100 hover:bg-blue-100/60 hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-blue-800 mb-1">
              <div className="flex items-center gap-1.5">
                <TrendingUp size={14} className="text-blue-600" />
                <span>Open Pipeline</span>
              </div>
              <ExternalLink size={12} className="text-blue-600 opacity-70 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-lg font-mono-num font-bold text-blue-900">
              {formatCurrency(kpis.openPipelineRevenue)}
            </div>
            <div className="text-[11px] text-blue-700 font-medium mt-1">
              {kpis.openOpportunitiesCount} active opportunities in progress
            </div>
          </div>

          <div
            onClick={() => {
              navigate(`/opportunities?ownerId=${user.id}`);
              onClose();
            }}
            className="p-3.5 rounded-xl border bg-amber-50/40 border-amber-100 hover:bg-amber-100/60 hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-amber-800 mb-1">
              <div className="flex items-center gap-1.5">
                <Target size={14} className="text-amber-600" />
                <span>Opportunities</span>
              </div>
              <ExternalLink size={12} className="text-amber-600 opacity-70 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="text-lg font-mono-num font-bold text-amber-900">
              {kpis.openOpportunitiesCount}
            </div>
            <div className="text-[11px] text-amber-700 font-medium mt-1">
              Open qualified opps
            </div>
          </div>

          <div
            onClick={() => {
              navigate(`/accounts?ownerId=${user.id}`);
              onClose();
            }}
            className="p-3.5 rounded-xl border bg-purple-50/40 border-purple-100 hover:bg-purple-100/60 hover:shadow-md cursor-pointer transition-all hover:scale-[1.01] group"
          >
            <div className="flex items-center justify-between text-xs font-semibold text-purple-800 mb-1">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-purple-600" />
                <span>Accounts & Activities</span>
              </div>
              <ExternalLink size={12} className="text-purple-600 opacity-70 group-hover:opacity-100 transition-opacity" />
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
        <div className="flex items-center gap-2 px-6 pt-3 border-b text-xs font-medium bg-[var(--ink-50)] border-[var(--ink-100)]">
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
                <div className="text-center py-10 text-xs text-[var(--ink-400)]">No recent activity logged for this user.</div>
              ) : (
                <div className="space-y-3">
                  {recentActivities.map((act: any) => {
                    const ActIcon = activityIcons[act.type] || Activity;
                    const targetUrl = act.opportunity
                      ? `/opportunities/${act.opportunity.id}`
                      : act.account
                      ? `/accounts/${act.account.id}`
                      : null;

                    return (
                      <div
                        key={act.id}
                        onClick={() => {
                          if (targetUrl) {
                            navigate(targetUrl);
                            onClose();
                          }
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all border-[var(--ink-100)] ${
                          targetUrl ? "hover:bg-[var(--ink-50)] hover:border-[var(--ledger-300)] cursor-pointer group" : ""
                        }`}
                      >
                        <div className="p-2 rounded-lg shrink-0 bg-[var(--ink-100)] text-[var(--ledger-700)]">
                          <ActIcon size={15} />
                        </div>
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold truncate text-[var(--ink-900)] group-hover:text-[var(--ledger-700)] transition-colors">
                              {act.subject}
                            </span>
                            <span className="text-[11px] font-mono-num whitespace-nowrap text-[var(--ink-400)]">{relativeTime(act.createdAt)}</span>
                          </div>
                          {act.body && <p className="text-[11px] mt-0.5 line-clamp-2 text-[var(--ink-600)]">{act.body}</p>}
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px]">
                            <Badge tone={act.status === "COMPLETED" ? "green" : "neutral"}>{act.type}</Badge>
                            {act.account && (
                              <Link
                                to={`/accounts/${act.account.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                }}
                                className="font-semibold text-[var(--ledger-700)] hover:underline flex items-center gap-0.5"
                              >
                                Account: {act.account.name} <ExternalLink size={9} />
                              </Link>
                            )}
                            {act.opportunity && (
                              <Link
                                to={`/opportunities/${act.opportunity.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onClose();
                                }}
                                className="font-semibold text-[var(--ledger-700)] hover:underline flex items-center gap-0.5"
                              >
                                Opp: {act.opportunity.name} <ExternalLink size={9} />
                              </Link>
                            )}
                            {act.owner && (
                              <span className="ml-auto text-[var(--ink-400)]">By: {act.owner.firstName} {act.owner.lastName}</span>
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

          {activeTab === "opportunities" && (
            <div>
              {recentOpps.length === 0 ? (
                <div className="text-center py-10 text-xs text-[var(--ink-400)]">No opportunities assigned.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b uppercase font-semibold border-[var(--ink-100)] text-[var(--ink-400)]">
                      <th className="pb-2">Opportunity Name</th>
                      <th className="pb-2">Account</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2">Stage</th>
                      <th className="pb-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOpps.map((o: any) => (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        <td className="py-2.5 font-semibold text-[var(--ledger-700)]">
                          <Link to={`/opportunities/${o.id}`} className="hover:underline flex items-center gap-1" onClick={onClose}>
                            {o.name} <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-2.5">
                          {o.account ? (
                            <Link to={`/accounts/${o.account.id}`} className="font-medium text-[var(--ledger-700)] hover:underline flex items-center gap-1" onClick={onClose}>
                              {o.account.name} <ExternalLink size={10} />
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="py-2.5 font-mono-num font-bold text-[var(--ink-900)]">{formatCurrency(o.amount)}</td>
                        <td className="py-2.5"><StageBadge stage={o.stage} /></td>
                        <td className="py-2.5 text-[var(--ink-500)]">{o.owner?.firstName} {o.owner?.lastName}</td>
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
                <div className="text-center py-10 text-xs text-[var(--ink-400)]">No accounts assigned.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b uppercase font-semibold border-[var(--ink-100)] text-[var(--ink-400)]">
                      <th className="pb-2">Account Name</th>
                      <th className="pb-2">Industry</th>
                      <th className="pb-2">Annual Revenue</th>
                      <th className="pb-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc: any) => (
                      <tr key={acc.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        <td className="py-2.5 font-semibold text-[var(--ledger-700)]">
                          <Link to={`/accounts/${acc.id}`} className="hover:underline flex items-center gap-1" onClick={onClose}>
                            {acc.name} <ExternalLink size={10} />
                          </Link>
                        </td>
                        <td className="py-2.5 text-[var(--ink-600)]">{acc.industry || "—"}</td>
                        <td className="py-2.5 font-mono-num font-bold text-[var(--ink-900)]">{formatCurrency(acc.annualRevenue)}</td>
                        <td className="py-2.5 text-[var(--ink-500)]">{acc.owner?.firstName} {acc.owner?.lastName}</td>
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
                <div className="text-center py-10 text-xs text-[var(--ink-400)]">No managers assigned under this Partner yet.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {teamMembers.map((m: any) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        if (onSelectUser) {
                          onSelectUser(m);
                        }
                      }}
                      className="p-3.5 rounded-xl border flex items-center justify-between gap-3 border-[var(--ink-100)] bg-[var(--ink-50)] hover:bg-white hover:border-[var(--ledger-500)] hover:shadow-md cursor-pointer transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center bg-[var(--ledger-700)]">
                          {m.firstName?.[0]}{m.lastName?.[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-xs text-[var(--ink-900)] group-hover:text-[var(--ledger-700)] transition-colors">{m.firstName} {m.lastName}</div>
                          <div className="text-[11px] text-[var(--ink-400)]">{m.email}</div>
                          <div className="mt-1"><RoleBadge role={m.orgRole} /></div>
                        </div>
                      </div>
                      <Eye size={14} className="text-[var(--ink-400)] group-hover:text-[var(--ledger-700)] transition-colors shrink-0" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-100)]">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <UserPlus size={16} className="text-[var(--ledger-600)]" />
            Add team member
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--ink-50)]">
            <X size={16} className="text-[var(--ink-400)]" />
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
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">First name</label>
              <input required className={inputCls} style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Last name</label>
              <input required className={inputCls} style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Email</label>
            <input required type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {actorOrgRole === "SENIOR_PARTNER" && (
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Role</label>
              <select className={inputCls} style={inputStyle} value={form.orgRole} onChange={(e) => setForm({ ...form, orgRole: e.target.value })}>
                <option value="PARTNER">Partner</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          )}

          {(actorOrgRole === "SENIOR_PARTNER" && form.orgRole === "MANAGER") && (
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Reports to (Partner)</label>
              <select required className={inputCls} style={inputStyle} value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">— Select Partner —</option>
                {partners.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Temporary password</label>
            <input required type="password" minLength={8} className={inputCls} style={inputStyle} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border hover:bg-[var(--ink-50)] border-[var(--ink-200)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--ledger-700)]"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ink-100)]">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Edit2 size={16} className="text-[var(--ledger-600)]" />
            Edit team member
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--ink-50)]">
            <X size={16} className="text-[var(--ink-400)]" />
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
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">First name</label>
              <input required className={inputCls} style={inputStyle} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Last name</label>
              <input required className={inputCls} style={inputStyle} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Email</label>
            <input required type="email" className={inputCls} style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {actorOrgRole === "SENIOR_PARTNER" && (
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Role</label>
              <select className={inputCls} style={inputStyle} value={form.orgRole} onChange={(e) => setForm({ ...form, orgRole: e.target.value })}>
                <option value="PARTNER">Partner</option>
                <option value="MANAGER">Manager</option>
              </select>
            </div>
          )}

          {(actorOrgRole === "SENIOR_PARTNER" && form.orgRole === "MANAGER") && (
            <div>
              <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Reports to (Partner)</label>
              <select className={inputCls} style={inputStyle} value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">— Unassigned —</option>
                {partners.filter((p: any) => p.id !== user.id).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm border hover:bg-[var(--ink-50)] border-[var(--ink-200)]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--ledger-700)]"
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
  
  // Interactive UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"tree" | "grid">("tree");
  const [collapsedPartners, setCollapsedPartners] = useState<Record<string, boolean>>({});

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

  // Toggle collapse state for partner sub-trees
  const togglePartnerCollapse = (partnerId: string) => {
    setCollapsedPartners((prev) => ({ ...prev, [partnerId]: !prev[partnerId] }));
  };

  // Filtered members list for search/grid view
  const filteredUsers = useMemo(() => {
    const allUsers: any[] = [];
    if (seniorPartner) allUsers.push(seniorPartner);
    allUsers.push(...partners);
    allUsers.push(...managers);

    return allUsers.filter((u) => {
      const matchesSearch =
        !searchQuery ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesRole = roleFilter === "ALL" || u.orgRole === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [seniorPartner, partners, managers, searchQuery, roleFilter]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-80 space-y-3">
        <Network size={36} className="animate-pulse text-[var(--ledger-600)]" />
        <div className="text-sm font-semibold text-[var(--ink-700)]">Rendering organization hierarchy…</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header & Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[var(--ink-100)] shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--ink-900)]">Organization Hierarchy</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--ledger-50)] text-[var(--ledger-700)] border border-[var(--ledger-100)]">
              {filteredUsers.length} Members
            </span>
          </div>
          <p className="text-xs mt-1 text-[var(--ink-500)]">
            Visual reporting tree & team structure. Click any member to launch their <strong>Bird's-Eye View</strong> activity feed & performance metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member or email..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-[var(--ledger-600)] border-[var(--ink-200)] bg-[var(--ink-50)]"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border text-xs outline-none border-[var(--ink-200)] bg-white font-medium"
          >
            <option value="ALL">All Roles</option>
            <option value="SENIOR_PARTNER">Senior Partner</option>
            <option value="PARTNER">Partner</option>
            <option value="MANAGER">Manager</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-200)]">
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "tree" ? "bg-white text-[var(--ledger-700)] shadow-xs" : "text-[var(--ink-500)] hover:text-[var(--ink-800)]"
              }`}
            >
              <Network size={13} /> Tree
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "grid" ? "bg-white text-[var(--ledger-700)] shadow-xs" : "text-[var(--ink-500)] hover:text-[var(--ink-800)]"
              }`}
            >
              <Grid size={13} /> Grid
            </button>
          </div>

          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs hover:opacity-90 transition-opacity bg-[var(--ledger-700)]"
            >
              <UserPlus size={15} />
              Add Member
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border bg-white border-[var(--ink-100)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 text-white">
            <Crown size={18} className="text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold text-[var(--ink-400)]">Senior Executive</div>
            <div className="text-sm font-bold text-[var(--ink-900)]">
              {seniorPartner ? `${seniorPartner.firstName} ${seniorPartner.lastName}` : "1 Senior Partner"}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-white border-[var(--ink-100)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-700 text-white">
            <ShieldCheck size={18} className="text-emerald-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold text-[var(--ink-400)]">Partners</div>
            <div className="text-sm font-bold text-[var(--ink-900)]">{partners.length} Active Partners</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-white border-[var(--ink-100)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-700 text-white">
            <Users size={18} className="text-indigo-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold text-[var(--ink-400)]">Sales Managers</div>
            <div className="text-sm font-bold text-[var(--ink-900)]">{managers.length} Reporting Reps</div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl border bg-white border-[var(--ink-100)] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-700 text-white">
            <Sparkles size={18} className="text-purple-300" />
          </div>
          <div>
            <div className="text-[11px] uppercase font-semibold text-[var(--ink-400)]">Hierarchy Health</div>
            <div className="text-sm font-bold text-emerald-700 flex items-center gap-1">
              <UserCheck size={14} /> 100% Active
            </div>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === "grid" ? (
        /* GRID VIEW */
        <div className="bg-white p-6 rounded-2xl border border-[var(--ink-100)]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-xs text-[var(--ink-400)]">
              No organization members match your search filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredUsers.map((user) => (
                <EnhancedUserCard
                  key={user.id}
                  user={user}
                  canEdit={canEdit}
                  onEdit={(u) => setEditUser(u)}
                  onDelete={(u) => { setDeleteTarget(u); setDeleteError(""); }}
                  onSelect={(u) => setBirdEyeUser(u)}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* HIERARCHY TREE VIEW */
        <div className="bg-white p-6 md:p-10 rounded-2xl border border-[var(--ink-100)] shadow-xs overflow-x-auto">
          {/* Senior Partner Level */}
          {seniorPartner && (
            <div className="flex flex-col items-center">
              <div className="text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-full bg-slate-900 text-slate-100 mb-3 shadow-xs flex items-center gap-1.5">
                <Crown size={12} className="text-amber-400" /> Senior Partner
              </div>
              <EnhancedUserCard
                user={seniorPartner}
                canEdit={false}
                onEdit={() => {}}
                onDelete={() => {}}
                onSelect={(u) => setBirdEyeUser(u)}
              />
            </div>
          )}

          {/* Connector down from SP to Partners */}
          {seniorPartner && partners.length > 0 && (
            <div className="flex flex-col items-center my-4">
              <div className="w-0.5 h-8 bg-gradient-to-b from-slate-800 to-emerald-600" />
            </div>
          )}

          {/* Partners Level */}
          {partners.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="h-px w-24 bg-emerald-200" />
                <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-emerald-800 text-emerald-100 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-300" /> Partners ({partners.length})
                </span>
                <div className="h-px w-24 bg-emerald-200" />
              </div>

              {/* Horizontal Connecting Line across Partners */}
              {partners.length > 1 && (
                <div className="flex justify-center -mt-2 mb-4">
                  <div
                    className="h-0.5 bg-emerald-400/60 rounded-full"
                    style={{ width: `${Math.min(partners.length * 280, 1000)}px` }}
                  />
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-8 items-start">
                {partners.map((partner) => {
                  const myManagers = managers.filter((m) => m.partnerId === partner.id);
                  const isCollapsed = !!collapsedPartners[partner.id];

                  return (
                    <div key={partner.id} className="flex flex-col items-center">
                      <EnhancedUserCard
                        user={partner}
                        canEdit={canEdit && me?.orgRole === "SENIOR_PARTNER"}
                        hasChildren={myManagers.length > 0}
                        isExpanded={!isCollapsed}
                        onToggleExpand={() => togglePartnerCollapse(partner.id)}
                        onEdit={(u) => setEditUser(u)}
                        onDelete={(u) => { setDeleteTarget(u); setDeleteError(""); }}
                        onSelect={(u) => setBirdEyeUser(u)}
                      />

                      {/* Partner's Sub-Tree of Managers */}
                      {myManagers.length > 0 && !isCollapsed && (
                        <div className="flex flex-col items-center mt-3 w-full">
                          <div className="w-0.5 h-6 bg-emerald-400" />
                          {myManagers.length > 1 && (
                            <div
                              className="h-0.5 bg-indigo-300 rounded-full mb-3"
                              style={{ width: `${Math.min(myManagers.length * 260, 800)}px` }}
                            />
                          )}
                          <div className="flex flex-wrap justify-center gap-4">
                            {myManagers.map((mgr) => (
                              <div key={mgr.id} className="flex flex-col items-center">
                                {myManagers.length > 1 && <div className="w-0.5 h-3 bg-indigo-300" />}
                                <EnhancedUserCard
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unassigned Managers */}
          {(() => {
            const orphans = managers.filter((m) => !m.partnerId);
            if (!orphans.length) return null;
            return (
              <div className="mt-12 pt-8 border-t border-[var(--ink-100)]">
                <div className="flex items-center justify-center gap-2 mb-6">
                  <div className="h-px w-24 bg-indigo-200" />
                  <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-900 text-indigo-100 flex items-center gap-1.5">
                    <Users size={12} className="text-indigo-300" /> Unassigned Sales Managers ({orphans.length})
                  </span>
                  <div className="h-px w-24 bg-indigo-200" />
                </div>
                <div className="flex flex-wrap gap-5 justify-center">
                  {orphans.map((mgr) => (
                    <EnhancedUserCard
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
        </div>
      )}

      {/* Bird's-Eye View Modal */}
      {birdEyeUser && (
        <BirdsEyeModal
          userId={birdEyeUser.id}
          onClose={() => setBirdEyeUser(null)}
          onSelectUser={(u) => setBirdEyeUser(u)}
        />
      )}

      {/* Edit User Modal */}
      {editUser && (
        <EditUserModal
          user={editUser}
          actorOrgRole={me?.orgRole || "PARTNER"}
          partners={partners}
          onClose={() => setEditUser(null)}
        />
      )}

      {/* Add User Modal */}
      {showAdd && (
        <AddUserModal
          actorOrgRole={me?.orgRole || "PARTNER"}
          partners={partners}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* Confirm Delete Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-bold text-base mb-2 text-[var(--ink-900)]">Remove {deleteTarget.firstName} {deleteTarget.lastName}?</h2>
            <p className="text-xs mb-4 text-[var(--ink-500)]">
              This will permanently remove this user. Their owned CRM records will be reassigned to you.
            </p>
            {deleteError && <p className="text-xs mb-3 text-rose-600">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-[var(--ink-50)] border-[var(--ink-200)]">
                Cancel
              </button>
              <button
                onClick={() => {
                  setDeleteError("");
                  deleteMutation.mutate(deleteTarget.id);
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors"
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
