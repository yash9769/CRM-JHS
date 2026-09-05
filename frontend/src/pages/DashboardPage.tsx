import { useState, useEffect, useRef, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useReducedMotion } from "motion/react";
import { gsap } from "gsap";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Field, inputClass, inputStyle } from "../components/ui";
import { formatCurrency, relativeTime } from "../lib/format";
import { downloadCsvExport } from "../lib/exportCsv";
import { RoleBadge, BirdsEyeModal } from "./OrgChartPage";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  TrendingUp, Target, Trophy, Percent, Wallet, Timer, CalendarClock, Flame,
  ShieldAlert, AlertCircle, Download, Eye, FileDown,
} from "lucide-react";
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

/** Animates a KPI's displayed number counting up from 0 on mount -- draws attention to the figure that just loaded. */
function useCountUp(target: number, format: (n: number) => string) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduceMotion) {
      el.textContent = format(target);
      return;
    }
    const obj = { value: 0 };
    const tween = gsap.to(obj, {
      value: target,
      duration: 0.9,
      ease: "power2.out",
      onUpdate: () => {
        el.textContent = format(obj.value);
      },
    });
    return () => {
      tween.kill();
    };
  }, [target, format, reduceMotion]);

  return ref;
}

function Kpi({ icon: Icon, label, value, format, url, tone = "ink" }: { icon: any; label: string; value: number; format: (n: number) => string; url?: string; tone?: "ink" | "green" }) {
  const countRef = useCountUp(value, format);
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
      <div ref={countRef} className="font-mono-num text-xl md:text-2xl font-semibold text-[var(--ink-900)]">{format(0)}</div>
    </Card>
  );

  if (url) {
    return <Link to={url} className="block">{content}</Link>;
  }
  return content;
}

function SectionHeader({ icon: Icon, title, action, tone = "ink" }: { icon: any; title: string; action?: ReactNode; tone?: "ink" | "rose" }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: tone === "rose" ? "var(--rose-700)" : "var(--ink-800)" }}>
        <Icon size={16} style={{ color: tone === "rose" ? "var(--rose-600)" : "var(--ledger-600)" }} />
        {title}
      </h3>
      {action}
    </div>
  );
}

/* ---------- Forecast section (merged from ForecastingPage) ---------- */

function periodLabel(p: string) {
  const [y, m] = p.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("default", { month: "short", year: "2-digit" });
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7);
}

function SetTargetModal({ period, users, onClose }: { period: string; users: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [ownerId, setOwnerId] = useState("");
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.post("/forecast/targets", { period, targetAmount: Number(amount), ownerId: ownerId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["forecast"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,23,26,0.5)" }} onClick={onClose}>
      <div className="bg-[var(--surface-raised)] rounded-xl shadow-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4">Set Forecast Target — {periodLabel(period)}</h3>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <Field label="Team member (leave blank for team total)">
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputClass} style={inputStyle}>
              <option value="">Team total</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
          </Field>
          <Field label="Target amount" required>
            <input required type="number" min="0" step="1000" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} style={inputStyle} placeholder="100000" />
          </Field>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending || !amount}>{mutation.isPending ? "Saving…" : "Set Target"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ForecastSection() {
  const qc = useQueryClient();
  const [viewType, setViewType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [monthlyPeriod, setMonthlyPeriod] = useState(currentPeriod());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showTarget, setShowTarget] = useState(false);

  const activePeriod = viewType === "YEARLY" ? selectedYear : monthlyPeriod;

  const { data: forecast } = useQuery<any>({
    queryKey: ["forecast", activePeriod],
    queryFn: async () => (await api.get("/forecast", { params: { period: activePeriod } })).data,
  });
  const { data: trend } = useQuery<any>({
    queryKey: ["forecast-trend"],
    queryFn: async () => (await api.get("/forecast/trend")).data,
  });
  const { data: users } = useQuery<any>({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/users")).data,
  });

  const s = forecast?.summary;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Target}
        title="Forecast"
        action={<Button size="sm" onClick={() => setShowTarget(true)}><Target size={13} /> Set Target</Button>}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium" style={{ color: "var(--ink-500)" }}>View Mode:</span>
        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value as "MONTHLY" | "YEARLY")}
          className="text-sm px-2.5 py-1 rounded-md border font-medium bg-[var(--surface-raised)]"
          style={{ borderColor: "var(--ink-200)" }}
        >
          <option value="MONTHLY">Monthly View</option>
          <option value="YEARLY">Yearly View</option>
        </select>
        {viewType === "MONTHLY" ? (
          <input
            type="month"
            value={monthlyPeriod}
            onChange={(e) => setMonthlyPeriod(e.target.value)}
            className="text-sm px-2.5 py-1 rounded-md border bg-[var(--surface-raised)] font-medium"
            style={{ borderColor: "var(--ink-200)" }}
          />
        ) : (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-sm px-2.5 py-1 rounded-md border bg-[var(--surface-raised)] font-medium"
            style={{ borderColor: "var(--ink-200)" }}
          >
            {[2026, 2025, 2024, 2023].map((y) => (
              <option key={y} value={y.toString()}>{y} (Full Year)</option>
            ))}
          </select>
        )}
      </div>

      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5"><Target size={14} style={{ color: "var(--ink-400)" }} /><span className="text-xs" style={{ color: "var(--ink-400)" }}>Total Target</span></div>
            <div className="font-mono-num text-2xl font-semibold">{s.target > 0 ? formatCurrency(s.target) : "Not set"}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5"><Trophy size={14} style={{ color: "var(--ledger-500)" }} /><span className="text-xs" style={{ color: "var(--ink-400)" }}>Closed Won</span></div>
            <div className="font-mono-num text-2xl font-semibold" style={{ color: "var(--ledger-700)" }}>{formatCurrency(s.closedWon)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5"><TrendingUp size={14} style={{ color: "var(--ink-400)" }} /><span className="text-xs" style={{ color: "var(--ink-400)" }}>Weighted Pipeline</span></div>
            <div className="font-mono-num text-2xl font-semibold">{formatCurrency(s.weighted)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertCircle size={14} style={{ color: "var(--rose-500)" }} />
              <span className="text-xs" style={{ color: "var(--ink-400)" }}>Lost Opportunity</span>
            </div>
            <div className="font-mono-num text-2xl font-semibold" style={{ color: "var(--rose-600)" }}>
              {formatCurrency(s.lostOpportunity || 0)}
            </div>
            {s.gap > 0 && <div className="text-xs mt-0.5" style={{ color: "var(--ink-400)" }}>{formatCurrency(s.gap)} gap to target</div>}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {s && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Pipeline categories</h3>
            <div className="space-y-3">
              {[
                { label: "Closed Won", value: s.closedWon, tone: "green" as const },
                { label: "Lost Opportunity", value: s.lostOpportunity || 0, tone: "rose" as const },
                { label: "Commit", value: s.commit, tone: "amber" as const },
                { label: "Best Case", value: s.bestCase, tone: "neutral" as const },
                { label: "Total Pipeline", value: s.pipeline, tone: "neutral" as const },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--ink-600)]">{label}</span>
                  <span className="font-mono-num font-medium text-sm">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {forecast?.byOwner?.length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>By Sales Representative</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Sales Representative", "Target", "Closed Won", "Lost Opportunity"].map(h => <th key={h} className="py-1.5 text-xs" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {forecast.byOwner.map((row: any) => (
                  <tr key={row.owner.id} className="border-b last:border-0" style={{ borderColor: "var(--ink-50)" }}>
                    <td className="py-2">{row.owner.firstName} {row.owner.lastName}</td>
                    <td className="py-2 font-mono-num">{row.target > 0 ? formatCurrency(row.target) : "—"}</td>
                    <td className="py-2 font-mono-num" style={{ color: "var(--ledger-700)" }}>{formatCurrency(row.closedWon)}</td>
                    <td className="py-2 font-mono-num" style={{ color: "var(--rose-600)" }}>
                      {row.lostOpportunity > 0 ? formatCurrency(row.lostOpportunity) : "₹0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {trend?.data?.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>12-month: Target vs. Actual</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trend.data} margin={{ right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="target" name="Target" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="var(--ledger-600)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {showTarget && (
        <SetTargetModal
          period={activePeriod}
          users={users?.data || []}
          onClose={() => { setShowTarget(false); qc.invalidateQueries({ queryKey: ["forecast"] }); }}
        />
      )}
    </div>
  );
}

/* ---------- Pipeline Health section (merged from ReportsPage) ---------- */

function PipelineHealthSection() {
  const { data } = useQuery<any>({ queryKey: ["report-pipeline-health"], queryFn: async () => (await api.get("/reports/pipeline-health")).data });
  return (
    <div className="space-y-4">
      <SectionHeader icon={Timer} title="Pipeline Health" />
      {!data?.data?.length ? (
        <Card className="p-8 text-sm text-center text-[var(--ink-400)]">No open opportunities in pipeline.</Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-5">
            <h4 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Open opportunity value by stage</h4>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.data} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="stage.name" tick={{ fontSize: 12, fill: "var(--ink-500)" }} axisLine={false} tickLine={false} width={120} />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
                <Bar dataKey="amount" name="Opportunity Value" fill="var(--ledger-600)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {["Stage", "Value", "Overdue", "Avg Age (days)"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row: any) => (
                  <tr key={row.stage.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3 font-medium">{row.stage.name}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: row.overdue > 0 ? "var(--rose-600)" : undefined }}>{row.overdue}</td>
                    <td className="px-4 py-3 font-mono-num">{row.avgAgeDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ---------- Win / Loss section (merged from ReportsPage) ---------- */

function WinLossSection() {
  const { data } = useQuery<any>({ queryKey: ["report-win-loss"], queryFn: async () => (await api.get("/reports/win-loss", { params: { months: 6 } })).data });
  if (!data) return null;
  const s = data.summary;
  const COLORS = ["var(--ledger-600)", "var(--rose-400)"];
  const pieData = [
    { name: "Won", value: s.totalWon },
    { name: "Lost", value: s.totalLost },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <SectionHeader icon={Trophy} title="Win / Loss (last 6 months)" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Opportunities Won", value: String(s.totalWon), sub: formatCurrency(s.wonRevenue) },
          { label: "Opportunities Lost", value: String(s.totalLost), sub: formatCurrency(s.lostRevenue) },
          { label: "Win Rate", value: `${Math.round(s.winRate * 100)}%`, sub: "by count" },
          { label: "Won Revenue", value: formatCurrency(s.wonRevenue), sub: "last 6 months" },
        ].map(({ label, value, sub }) => (
          <Card key={label} className="p-4">
            <div className="text-xs mb-1" style={{ color: "var(--ink-400)" }}>{label}</div>
            <div className="font-mono-num text-xl font-semibold">{value}</div>
            <div className="text-xs" style={{ color: "var(--ink-400)" }}>{sub}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pieData.length > 0 && (
          <Card className="p-5">
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Won vs. Lost</h4>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
        {data.monthly?.length > 0 && (
          <Card className="p-5">
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Monthly trend</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
                <Bar dataKey="won" name="Won" fill="var(--ledger-600)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill="var(--rose-400)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ---------- Owner Performance section (merged from ReportsPage, leadership-only) ---------- */

function OwnerPerformanceSection() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data } = useQuery<any>({ queryKey: ["report-owner-perf"], queryFn: async () => (await api.get("/reports/owner-performance")).data });

  async function exportCsv() {
    await downloadCsvExport("/reports/owner-performance/export", {}, "owner_performance.csv");
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Percent}
        title="Owner Performance"
        action={<Button size="sm" variant="secondary" onClick={exportCsv}><Download size={13} /> Export CSV</Button>}
      />
      {!data?.data?.length ? (
        <Card className="p-8 text-sm text-center text-[var(--ink-400)]">No performance data available.</Card>
      ) : (
        <>
          <p className="text-xs text-[var(--ink-500)]">Click any representative's name to open their complete Bird's-Eye View activity & performance.</p>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--ink-100)]">
                  {["Rep", "Role", "Open Opps", "Pipeline", "Weighted", "Closed Won", "Win Rate"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((row: any) => (
                  <tr key={row.user.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedUserId(row.user.id)}
                        className="font-semibold text-left flex items-center gap-1.5 hover:underline group text-[var(--ledger-700)]"
                        title="Click to view Bird's-Eye Activity & Performance"
                      >
                        <Eye size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                        {row.user.firstName} {row.user.lastName}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={row.user.orgRole} />
                    </td>
                    <td className="px-4 py-3 font-mono-num">{row.metrics.openOpportunities}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(row.metrics.pipeline)}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(row.metrics.weighted)}</td>
                    <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ledger-700)" }}>{formatCurrency(row.metrics.closedWon)}</td>
                    <td className="px-4 py-3 font-mono-num">
                      {row.metrics.winRate != null ? `${Math.round(row.metrics.winRate * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {selectedUserId && (
        <BirdsEyeModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}

/* ---------- Main Dashboard page ---------- */

export default function DashboardPage() {
  const { user } = useAuth();
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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
  const isManager = user?.orgRole === "MANAGER";

  async function downloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await api.get("/dashboard/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title={`${greeting}, ${user?.firstName || ""}`}
        action={
          <Button variant="secondary" onClick={downloadPdf} disabled={downloadingPdf}>
            <FileDown size={14} /> {downloadingPdf ? "Generating…" : "Download PDF"}
          </Button>
        }
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
            <Kpi icon={Wallet} label="Total Pipeline" value={data.kpis.totalPipeline} format={formatCurrency} url="/opportunities" />
            <Kpi icon={TrendingUp} label="Weighted Pipeline" value={data.kpis.weightedPipeline} format={formatCurrency} url="/opportunities" />
            <Kpi icon={Target} label="Open Opportunities" value={data.kpis.openOpportunities} format={(n) => String(Math.round(n))} url="/opportunities" />
            <Kpi icon={Trophy} label="Closed Won Revenue" value={data.kpis.closedWonRevenue} format={formatCurrency} tone="green" url="/opportunities" />
            <Kpi icon={Percent} label="Win Rate" value={data.kpis.winRate * 100} format={(n) => `${Math.round(n)}%`} />
            <Kpi icon={Wallet} label="Avg Opportunity Size" value={data.kpis.avgOpportunitySize} format={formatCurrency} url="/opportunities" />
            <Kpi icon={TrendingUp} label="Margin Value" value={(data.kpis.totalGrossMargin || 0) + (data.kpis.totalExpectedMargin || 0)} format={formatCurrency} tone="green" url="/opportunities" />
            <Kpi icon={CalendarClock} label="Cost Incurred to Company" value={data.kpis.totalBottomLineCost || 0} format={formatCurrency} url="/opportunities" />
          </div>
        )}

        {/* RECENT ACTIVITY */}
        <div className="space-y-3">
          <SectionHeader icon={Timer} title="Recent Activity" action={<span className="text-xs text-[var(--ink-400)]">Latest updates</span>} />
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

        {/* OPPORTUNITIES AT RISK */}
        <div className="space-y-3">
          <SectionHeader
            icon={Flame}
            title="Opportunities at Risk"
            tone="rose"
            action={<Link to="/opportunities" className="text-xs text-[var(--rose-600)] hover:underline font-medium">Review All Opportunities</Link>}
          />
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

        {/* RECENT LEADS */}
        <div className="space-y-3">
          <SectionHeader icon={Target} title="Recent Leads" action={<Link to="/contacts" className="text-xs text-[var(--ledger-700)] hover:underline font-medium">View Contacts</Link>} />
          <Card className="p-4">
            {!recentLeads.length ? (
              <div className="py-6 text-center text-sm text-[var(--ink-400)]">No new leads registered</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {recentLeads.map((l) => (
                  <div key={l.id} className="p-3 rounded-lg border border-[var(--ink-100)] bg-[var(--surface-raised)]">
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

        {/* STAGE APPROVAL QUEUE */}
        <div className="space-y-3 pt-2 border-t border-[var(--ink-100)]">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--ink-800)]">
            <ShieldAlert size={16} className="text-[var(--ledger-600)]" />
            {isManager ? "My Stage Approval Requests" : "Pending Stage Approvals"}
          </h3>
          <ApprovalQueueTable limit={10} />
        </div>

        {/* CHARTS: Revenue by Month, Pipeline by Stage */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[var(--ink-100)]">
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

        {/* FORECAST (merged from Forecasting page) */}
        <div className="pt-2 border-t border-[var(--ink-100)]">
          <ForecastSection />
        </div>

        {/* PIPELINE HEALTH (merged from Reports) */}
        <div className="pt-2 border-t border-[var(--ink-100)]">
          <PipelineHealthSection />
        </div>

        {/* WIN / LOSS (merged from Reports) */}
        <div className="pt-2 border-t border-[var(--ink-100)]">
          <WinLossSection />
        </div>

        {/* OWNER PERFORMANCE (merged from Reports, leadership-only) */}
        {!isManager && (
          <div className="pt-2 border-t border-[var(--ink-100)]">
            <OwnerPerformanceSection />
          </div>
        )}
      </div>
    </div>
  );
}
