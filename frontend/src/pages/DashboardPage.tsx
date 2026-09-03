import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/ui";
import { formatCurrency, relativeTime } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Target, Trophy, Percent, Wallet, Timer, CalendarClock, Flame, ShieldAlert } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { ApprovalQueueTable } from "../components/ApprovalQueueTable";

interface ActionCenterData {
  todaysWork: { overdueTasks: number; tasksDueToday: number; newLeads: number; uncontactedLeads: number; oppsClosingThisWeek: number; quotesAwaiting: number };
  recentLeads: { id: string; firstName: string; lastName: string; companyName?: string | null; status: string; createdAt: string }[];
  upcomingTasks: { id: string; subject: string; dueDate: string | null; accountId?: string | null; contactId?: string | null; opportunityId?: string | null; leadId?: string | null }[];
  recentActivity: { id: string; type: string; subject: string; createdAt: string; owner?: { firstName: string; lastName: string } | null; account?: { id: string; name: string } | null; opportunity?: { id: string; name: string } | null; lead?: { id: string; firstName: string; lastName: string } | null }[];
  opportunitiesAtRisk: { id: string; name: string; amount: number; reason: string; account?: { id: string; name: string } | null }[];
}

function activityRelated(a: ActionCenterData["recentActivity"][number]) {
  if (a.opportunity) return { label: a.opportunity.name, url: `/opportunities/${a.opportunity.id}` };
  if (a.account) return { label: a.account.name, url: `/accounts/${a.account.id}` };
  return null;
}

interface DashboardData {
  kpis: {
    totalPipeline: number; weightedPipeline: number; openOpportunities: number;
    closedWonRevenue: number; winRate: number; avgOpportunitySize: number; oppsClosingThisMonth: number;
    totalExpectedMargin?: number; totalGrossMargin?: number; totalMarginLoss?: number; totalBottomLineCost?: number;
  };
  charts: {
    pipelineByStage: { stageName: string; count: number; amount: number }[];
    revenueByMonth: { month: string; revenue: number }[];
    oppsByOwner: { owner: string; count: number; amount: number }[];
  };
}

function Kpi({ icon: Icon, label, value, url, tone = "ink" }: { icon: any; label: string; value: string; url?: string; tone?: "ink" | "green" }) {
  const content = (
    <Card className="p-4 h-full hover:shadow-md transition-all cursor-pointer group">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center transition-transform group-hover:scale-110"
          style={{ background: tone === "green" ? "var(--ledger-100)" : "var(--ink-50)" }}
        >
          <Icon size={14} style={{ color: tone === "green" ? "var(--ledger-700)" : "var(--ink-500)" }} />
        </div>
        <span className="text-xs font-medium text-[var(--ink-500)] group-hover:text-[var(--ledger-700)] transition-colors">{label}</span>
      </div>
      <div className="font-mono-num text-xl md:text-2xl font-semibold text-[var(--ink-900)]">{value}</div>
    </Card>
  );

  if (url) {
    return <Link to={url} className="block">{content}</Link>;
  }
  return content;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });
  const { data: action } = useQuery<ActionCenterData>({
    queryKey: ["dashboard", "action-center"],
    queryFn: async () => (await api.get("/dashboard/action-center")).data,
  });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  const recentLeads = action?.recentLeads || [];
  const recentActivity = action?.recentActivity || [];
  const opportunitiesAtRisk = action?.opportunitiesAtRisk || [];

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title={`${greeting}, ${user?.firstName || ""}`}
        subtitle="Here is your real-time sales pipeline and activity dashboard."
      />

      <div className="px-4 md:px-8 space-y-8">
        {/* TOP: MAIN KPI METRICS CARDS */}
        {isLoading || !data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="p-4 h-24 bg-gray-100/50">
                <div />
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <Kpi icon={Wallet} label="Total Pipeline" value={formatCurrency(data.kpis.totalPipeline)} url="/opportunities" />
            <Kpi icon={TrendingUp} label="Weighted Pipeline" value={formatCurrency(data.kpis.weightedPipeline)} url="/opportunities" />
            <Kpi icon={Target} label="Open Opportunities" value={String(data.kpis.openOpportunities)} url="/opportunities" />
            <Kpi icon={Trophy} label="Closed Won Revenue" value={formatCurrency(data.kpis.closedWonRevenue)} tone="green" url="/opportunities" />
            <Kpi icon={Percent} label="Win Rate" value={`${Math.round(data.kpis.winRate * 100)}%`} url="/reports" />
            <Kpi icon={Wallet} label="Avg Opportunity Size" value={formatCurrency(data.kpis.avgOpportunitySize)} url="/opportunities" />
            <Kpi icon={TrendingUp} label="Margin Value" value={formatCurrency((data.kpis.totalGrossMargin || 0) + (data.kpis.totalExpectedMargin || 0))} tone="green" url="/opportunities" />
            <Kpi icon={CalendarClock} label="Cost Incurred to Company" value={formatCurrency(data.kpis.totalBottomLineCost || 0)} url="/opportunities" />
          </div>
        )}

        {/* 1. RECENT ACTIVITY */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ink-800)]">
              <Timer size={16} className="text-[var(--ledger-600)]" />
              1. Recent Activity
            </h3>
            <span className="text-xs text-[var(--ink-400)]">Latest updates</span>
          </div>
          <Card className="p-4">
            {!recentActivity.length ? (
              <div className="py-6 text-center text-sm text-[var(--ink-400)]">No recent activity recorded</div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((a) => {
                  const related = activityRelated(a);
                  return (
                    <div key={a.id} className="flex items-start justify-between border-b border-[var(--ink-50)] pb-2.5 last:border-none last:pb-0">
                      <div>
                        <div className="text-sm font-medium text-[var(--ink-900)]">{a.subject}</div>
                        <div className="text-xs text-[var(--ink-500)] mt-0.5">
                          {a.owner ? `${a.owner.firstName} ${a.owner.lastName} · ` : ""}
                          {related ? (
                            <Link to={related.url} className="text-[var(--ledger-700)] hover:underline font-medium">
                              {related.label}
                            </Link>
                          ) : (
                            <span className="capitalize">{a.type?.toLowerCase()}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-[var(--ink-400)] shrink-0 ml-4">{relativeTime(a.createdAt)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* 2. OPPORTUNITIES AT RISK */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--rose-700)]">
              <Flame size={16} className="text-[var(--rose-600)]" />
              2. Opportunities at Risk
            </h3>
            <Link to="/opportunities" className="text-xs text-[var(--rose-600)] hover:underline font-medium">Review All Opportunities</Link>
          </div>
          <Card className="p-4 border-l-4 border-l-[var(--rose-500)]">
            {!opportunitiesAtRisk.length ? (
              <div className="py-6 text-center text-sm text-[var(--ink-400)]">No opportunities currently flagged as at-risk</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {opportunitiesAtRisk.map((o) => (
                  <Link
                    key={o.id}
                    to={`/opportunities/${o.id}`}
                    className="p-3 rounded-lg border border-[var(--ink-100)] bg-[var(--rose-50)]/30 hover:border-[var(--rose-300)] transition-all block"
                  >
                    <div className="font-semibold text-sm text-[var(--ink-900)] truncate">{o.name}</div>
                    <div className="text-xs font-mono-num text-[var(--ink-700)] font-medium mt-1">{formatCurrency(o.amount)}</div>
                    <div className="text-xs text-[var(--rose-600)] font-medium mt-1 flex items-center gap-1">
                      <span>⚠️ {o.reason}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* 3. RECENT LEADS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ink-800)]">
              <Target size={16} className="text-[var(--ledger-600)]" />
              3. Recent Leads
            </h3>
            <Link to="/contacts" className="text-xs text-[var(--ledger-700)] hover:underline font-medium">View Contacts</Link>
          </div>
          <Card className="p-4">
            {!recentLeads.length ? (
              <div className="py-6 text-center text-sm text-[var(--ink-400)]">No new leads registered</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {recentLeads.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-[var(--ink-100)] bg-white">
                    <div className="font-medium text-sm text-[var(--ink-900)] truncate">{l.firstName} {l.lastName}</div>
                    <div className="text-xs text-[var(--ink-500)] truncate mt-0.5">{l.companyName || "Independent"}</div>
                    <div className="text-[10px] mt-2 inline-block px-2 py-0.5 rounded-full bg-[var(--ledger-50)] text-[var(--ledger-700)] font-medium">
                      {l.status?.replace("_", " ") || "NEW"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* STAGE APPROVAL QUEUE (If manager or partner) */}
        <div className="space-y-3 pt-2 border-t border-[var(--ink-100)]">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ink-800)]">
            <ShieldAlert size={16} className="text-[var(--ledger-600)]" />
            {user?.orgRole === "MANAGER" ? "My Stage Approval Requests" : "Pending Stage Approvals"}
          </h3>
          <ApprovalQueueTable limit={10} />
        </div>

        {/* CHARTS */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            <Card className="p-4 md:p-5">
              <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">Revenue by Month</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.charts.revenueByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} width={60} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
                  <Bar dataKey="revenue" fill="var(--ledger-600)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className="p-4 md:p-5">
              <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">Pipeline by Stage</h3>
              {data.charts.pipelineByStage.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] text-sm text-[var(--ink-400)]">
                  <Timer size={16} className="mr-2" /> No open opportunities yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.charts.pipelineByStage} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="stageName" tick={{ fontSize: 12, fill: "var(--ink-500)" }} axisLine={false} tickLine={false} width={110} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
                    <Bar dataKey="amount" fill="var(--ledger-500)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
