import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/ui";
import { formatCurrency, formatDate, relativeTime } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Target, Handshake, Trophy, Percent, Wallet, Timer, CalendarClock, AlertTriangle, CheckSquare, UserPlus, FileText, Flame } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface ActionCenterData {
  todaysWork: { overdueTasks: number; tasksDueToday: number; newLeads: number; uncontactedLeads: number; dealsClosingThisWeek: number; quotesAwaiting: number };
  recentLeads: { id: string; firstName: string; lastName: string; companyName?: string | null; status: string; createdAt: string }[];
  upcomingTasks: { id: string; subject: string; dueDate: string | null; accountId?: string | null; contactId?: string | null; opportunityId?: string | null; dealId?: string | null; leadId?: string | null }[];
  recentActivity: { id: string; type: string; subject: string; createdAt: string; owner?: { firstName: string; lastName: string } | null; account?: { id: string; name: string } | null; deal?: { id: string; name: string } | null; opportunity?: { id: string; name: string } | null; lead?: { id: string; firstName: string; lastName: string } | null }[];
  dealsAtRisk: { id: string; name: string; amount: number; reason: string; account?: { id: string; name: string } | null }[];
}

function taskLink(t: ActionCenterData["upcomingTasks"][number]) {
  if (t.leadId) return `/leads/${t.leadId}`;
  if (t.accountId) return `/accounts/${t.accountId}`;
  if (t.contactId) return `/contacts/${t.contactId}`;
  if (t.opportunityId) return `/opportunities/${t.opportunityId}`;
  if (t.dealId) return `/deals/${t.dealId}`;
  return "/tasks";
}

function activityRelated(a: ActionCenterData["recentActivity"][number]) {
  if (a.lead) return { label: `${a.lead.firstName} ${a.lead.lastName}`, url: `/leads/${a.lead.id}` };
  if (a.deal) return { label: a.deal.name, url: `/deals/${a.deal.id}` };
  if (a.opportunity) return { label: a.opportunity.name, url: `/opportunities/${a.opportunity.id}` };
  if (a.account) return { label: a.account.name, url: `/accounts/${a.account.id}` };
  return null;
}

function ActionTile({ icon: Icon, label, value, url, tone = "ink" }: { icon: any; label: string; value: number; url: string; tone?: "ink" | "rose" }) {
  return (
    <Link to={url} className="block">
      <Card className="p-4 h-full hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: tone === "rose" && value > 0 ? "var(--rose-100)" : "var(--ink-50)" }}>
            <Icon size={15} style={{ color: tone === "rose" && value > 0 ? "var(--rose-600)" : "var(--ink-500)" }} />
          </div>
          <div className="font-mono-num text-2xl font-semibold" style={{ color: tone === "rose" && value > 0 ? "var(--rose-600)" : "var(--ink-900)" }}>{value}</div>
        </div>
        <div className="text-xs font-medium mt-2" style={{ color: "var(--ink-500)" }}>{label}</div>
      </Card>
    </Link>
  );
}


interface DashboardData {
  kpis: {
    totalPipeline: number; weightedPipeline: number; openOpportunities: number; openDeals: number;
    closedWonRevenue: number; winRate: number; avgDealSize: number; dealsClosingThisMonth: number;
  };
  charts: {
    pipelineByStage: { stageName: string; count: number; amount: number }[];
    revenueByMonth: { month: string; revenue: number }[];
    dealsByOwner: { owner: string; count: number; amount: number }[];
  };
}

function Kpi({ icon: Icon, label, value, tone = "ink" }: { icon: any; label: string; value: string; tone?: "ink" | "green" }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center"
          style={{ background: tone === "green" ? "var(--ledger-100)" : "var(--ink-50)" }}
        >
          <Icon size={14} style={{ color: tone === "green" ? "var(--ledger-700)" : "var(--ink-500)" }} />
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--ink-500)" }}>{label}</span>
      </div>
      <div className="font-mono-num text-2xl font-semibold" style={{ color: "var(--ink-900)" }}>{value}</div>
    </Card>
  );
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

  return (
    <div>
      <PageHeader title={`${greeting}, ${user?.firstName}`} subtitle="Here's where your pipeline stands today." />

      {action && (
        <div className="px-8 pb-6">
          <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Today's Work</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
            <ActionTile icon={AlertTriangle} label="Overdue Tasks" value={action.todaysWork.overdueTasks} url="/tasks" tone="rose" />
            <ActionTile icon={CheckSquare} label="Tasks Due Today" value={action.todaysWork.tasksDueToday} url="/tasks" />
            <ActionTile icon={UserPlus} label="New Leads" value={action.todaysWork.newLeads} url="/leads" />
            <ActionTile icon={UserPlus} label="Uncontacted Leads" value={action.todaysWork.uncontactedLeads} url="/leads" />
            <ActionTile icon={CalendarClock} label="Deals Closing This Week" value={action.todaysWork.dealsClosingThisWeek} url="/deals" />
            <ActionTile icon={FileText} label="Quotes Awaiting Response" value={action.todaysWork.quotesAwaiting} url="/quotes" />
          </div>

          <div className="grid grid-cols-4 gap-4 mb-2">
            <Card className="p-4 col-span-1">
              <h4 className="text-xs uppercase font-medium mb-3" style={{ color: "var(--ink-400)" }}>Recent Leads</h4>
              {!action.recentLeads.length ? (
                <div className="text-sm" style={{ color: "var(--ink-400)" }}>No leads yet</div>
              ) : (
                <div className="space-y-2.5">
                  {action.recentLeads.map((l) => (
                    <Link key={l.id} to={`/leads/${l.id}`} className="block text-sm">
                      <div className="font-medium">{l.firstName} {l.lastName}</div>
                      <div className="text-xs" style={{ color: "var(--ink-400)" }}>{l.companyName || l.status.replace("_", " ")}</div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4 col-span-1">
              <h4 className="text-xs uppercase font-medium mb-3" style={{ color: "var(--ink-400)" }}>Upcoming Tasks</h4>
              {!action.upcomingTasks.length ? (
                <div className="text-sm" style={{ color: "var(--ink-400)" }}>Nothing scheduled</div>
              ) : (
                <div className="space-y-2.5">
                  {action.upcomingTasks.map((t) => (
                    <Link key={t.id} to={taskLink(t)} className="block text-sm">
                      <div className="font-medium">{t.subject}</div>
                      <div className="text-xs" style={{ color: "var(--ink-400)" }}>{t.dueDate ? formatDate(t.dueDate) : "No due date"}</div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
            <Card className="p-4 col-span-1">
              <h4 className="text-xs uppercase font-medium mb-3" style={{ color: "var(--ink-400)" }}>Recent Activity</h4>
              {!action.recentActivity.length ? (
                <div className="text-sm" style={{ color: "var(--ink-400)" }}>Nothing logged yet</div>
              ) : (
                <div className="space-y-2.5">
                  {action.recentActivity.slice(0, 5).map((a) => {
                    const related = activityRelated(a);
                    return (
                      <div key={a.id} className="text-sm">
                        <div className="font-medium">{a.subject}</div>
                        <div className="text-xs" style={{ color: "var(--ink-400)" }}>
                          {a.owner ? `${a.owner.firstName} ${a.owner.lastName} · ` : ""}
                          {related ? <Link to={related.url} style={{ color: "var(--ledger-700)" }}>{related.label}</Link> : relativeTime(a.createdAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card className="p-4 col-span-1">
              <h4 className="text-xs uppercase font-medium mb-3 flex items-center gap-1.5" style={{ color: "var(--ink-400)" }}><Flame size={13} /> Deals at Risk</h4>
              {!action.dealsAtRisk.length ? (
                <div className="text-sm" style={{ color: "var(--ink-400)" }}>No deals need attention</div>
              ) : (
                <div className="space-y-2.5">
                  {action.dealsAtRisk.map((d) => (
                    <Link key={d.id} to={`/deals/${d.id}`} className="block text-sm">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs font-mono-num" style={{ color: "var(--ink-600)" }}>{formatCurrency(d.amount)}</div>
                      <div className="text-xs" style={{ color: "var(--rose-600)" }}>{d.reason}</div>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {isLoading || !data ? (
        <div className="px-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
      ) : (
        <div className="px-8 pb-10 space-y-6">
          <div className="grid grid-cols-4 gap-3">
            <Kpi icon={Wallet} label="Total Pipeline" value={formatCurrency(data.kpis.totalPipeline)} />
            <Kpi icon={TrendingUp} label="Weighted Pipeline" value={formatCurrency(data.kpis.weightedPipeline)} />
            <Kpi icon={Target} label="Open Opportunities" value={String(data.kpis.openOpportunities)} />
            <Kpi icon={Handshake} label="Open Deals" value={String(data.kpis.openDeals)} />
            <Kpi icon={Trophy} label="Closed Won Revenue" value={formatCurrency(data.kpis.closedWonRevenue)} tone="green" />
            <Kpi icon={Percent} label="Win Rate" value={`${Math.round(data.kpis.winRate * 100)}%`} />
            <Kpi icon={Wallet} label="Avg Deal Size" value={formatCurrency(data.kpis.avgDealSize)} />
            <Kpi icon={CalendarClock} label="Closing This Month" value={String(data.kpis.dealsClosingThisMonth)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Revenue by Month</h3>
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

            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Pipeline by Stage</h3>
              {data.charts.pipelineByStage.length === 0 ? (
                <div className="flex items-center justify-center h-[220px] text-sm" style={{ color: "var(--ink-400)" }}>
                  <Timer size={16} className="mr-2" /> No open deals yet
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
        </div>
      )}
    </div>
  );
}
