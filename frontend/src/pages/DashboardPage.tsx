import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, Button, Badge, Field, Modal, inputClass, inputStyle } from "../components/ui";
import { formatCurrency, formatCurrencyCompact, relativeTime } from "../lib/format";
import { downloadCsvExport } from "../lib/exportCsv";
import { RoleBadge, BirdsEyeModal } from "./OrgChartPage";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
  RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";
import {
  TrendingUp, Target, Trophy, Percent, IndianRupee, BarChart3, Timer, CalendarClock, Flame,
  ShieldAlert, AlertCircle, Download, Eye, FileDown, Gauge,
} from "lucide-react";
import { useAuth, isManager as checkIsManager } from "../hooks/useAuth";
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

interface OwnerBreakdown {
  ownerId: string; ownerName: string;
  totalPipeline: number; weightedPipeline: number; openOpportunities: number;
  closedWonRevenue: number; closedWonCount: number; closedLostCount: number;
  winRate: number; avgOpportunitySize: number; marginValue: number; costIncurred: number;
}

type OwnerMetricKey = Exclude<keyof OwnerBreakdown, "ownerId" | "ownerName" | "closedWonCount" | "closedLostCount">;

interface DashboardData {
  kpis: {
    totalPipeline: number; weightedPipeline: number; openOpportunities: number;
    closedWonRevenue: number; closedWonCount: number; winRate: number; avgOpportunitySize: number; oppsClosingThisMonth: number;
    totalExpectedMargin?: number; totalGrossMargin?: number; totalMarginLoss?: number; totalBottomLineCost?: number;
    pipelineVelocityPct: number | null;
  };
  charts: {
    pipelineByStage: { stageName: string; count: number; amount: number }[];
    revenueByMonth: { month: string; revenue: number }[];
    oppsByOwner: { owner: string; count: number; amount: number }[];
    pipelineVelocity: { month: string; amount: number }[];
  };
  byOwner: OwnerBreakdown[];
}

function Kpi({
  icon: Icon, label, value, url, onClick, tone = "ink", badge, footerLeft, footerRight, bar, sparkline, belowValue,
}: {
  icon: any; label: string; value: ReactNode; url?: string; onClick?: () => void; tone?: "ink" | "green";
  badge?: ReactNode; footerLeft?: ReactNode; footerRight?: ReactNode; bar?: ReactNode; sparkline?: ReactNode; belowValue?: ReactNode;
}) {
  const content = (
    <Card className="p-4 h-full hover:shadow-md transition-all cursor-pointer group flex flex-col">
      <div className="flex items-start justify-between gap-x-2 gap-y-1.5 mb-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
            style={{ background: tone === "green" ? "var(--ledger-100)" : "var(--ink-50)" }}
          >
            <Icon size={14} style={{ color: tone === "green" ? "var(--ledger-700)" : "var(--ink-500)" }} />
          </div>
          <span className="text-xs font-medium text-[var(--ink-500)] group-hover:text-[var(--ledger-700)] transition-colors">{label}</span>
        </div>
        {badge}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="font-mono-num text-xl md:text-2xl font-semibold text-[var(--ink-900)]">{value}</div>
        {sparkline}
      </div>
      {belowValue && <div className="mt-1.5">{belowValue}</div>}
      {bar}
      {(footerLeft || footerRight) && (
        <div className="mt-auto pt-2.5 flex items-center justify-between gap-2 text-[10px] text-[var(--ink-400)]">
          <span className="truncate">{footerLeft}</span>
          <span className="shrink-0 font-medium text-[var(--ink-600)]">{footerRight}</span>
        </div>
      )}
    </Card>
  );

  if (onClick) {
    return <button type="button" onClick={onClick} className="block h-full w-full text-left">{content}</button>;
  }
  if (url) {
    return <Link to={url} className="block h-full">{content}</Link>;
  }
  return content;
}

function KpiPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "rose" }) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--ink-50)", color: "var(--ink-500)" },
    green: { background: "var(--ledger-50)", color: "var(--ledger-700)" },
    amber: { background: "var(--amber-100)", color: "var(--amber-600)" },
    rose: { background: "var(--rose-100)", color: "var(--rose-600)" },
  };
  return (
    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0" style={styles[tone]}>
      {children}
    </span>
  );
}

function KpiBar({ pct, tone = "green" }: { pct: number; tone?: "green" | "ink" }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 rounded-full overflow-hidden mt-2.5" style={{ background: "var(--ink-100)" }}>
      <div className="h-full rounded-full" style={{ width: `${clamped}%`, background: tone === "green" ? "var(--ledger-600)" : "var(--ink-800)" }} />
    </div>
  );
}

function KpiRing({ pct, centerLabel }: { pct: number; centerLabel: string }) {
  return (
    <div className="relative shrink-0" style={{ width: 34, height: 34 }}>
      <ResponsiveContainer width={34} height={34}>
        <RadialBarChart
          cx="50%" cy="50%" innerRadius="65%" outerRadius="100%"
          barSize={5} startAngle={90} endAngle={-270}
          data={[{ value: Math.max(0, Math.min(100, pct)), fill: "var(--ledger-600)" }]}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar background={{ fill: "var(--ink-100)" }} dataKey="value" cornerRadius={4} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span style={{ fontSize: 7 }} className="font-bold text-[var(--ledger-700)]">{centerLabel}</span>
      </div>
    </div>
  );
}

function KpiSparkline({ data, full = false }: { data: { month: string; amount: number }[]; full?: boolean }) {
  const height = full ? 36 : 28;
  return (
    <div className={full ? "w-full" : "shrink-0"} style={full ? { height } : { width: 64, height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <Area type="monotone" dataKey="amount" stroke="var(--ledger-600)" strokeWidth={1.5} fill="var(--ledger-100)" fillOpacity={0.6} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiBreakdownModal({
  title, metricKey, format, byOwner, currentUserId, onClose,
}: {
  title: string; metricKey: OwnerMetricKey; format: (n: number) => string;
  byOwner: OwnerBreakdown[]; currentUserId?: string; onClose: () => void;
}) {
  const rows = [...byOwner].sort((a, b) => (b[metricKey] as number) - (a[metricKey] as number));
  const maxVal = Math.max(...rows.map((r) => r[metricKey] as number), 1);

  return (
    <Modal title={`${title} — by Team Member`} onClose={onClose} width="520px">
      {rows.length === 0 ? (
        <div className="text-sm text-center py-6 text-[var(--ink-400)]">No team data available for this metric.</div>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => {
            const val = r[metricKey] as number;
            const pct = maxVal > 0 ? Math.max((val / maxVal) * 100, val > 0 ? 1 : 0) : 0;
            const isYou = r.ownerId === currentUserId;
            return (
              <div key={r.ownerId}>
                <div className="flex items-center justify-between text-xs mb-1.5 gap-2">
                  <span className="font-medium truncate" style={{ color: isYou ? "var(--ledger-700)" : "var(--ink-700)" }}>
                    {r.ownerName} {isYou && <span className="font-semibold">(You)</span>}
                  </span>
                  <span className="font-mono-num text-[var(--ink-600)] shrink-0">{format(val)}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--ink-100)" }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isYou ? "var(--ledger-700)" : "var(--ledger-500)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
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

/** Indian fiscal year runs April-March; label e.g. "Q2 FY26 Active" for July 2025. */
function fiscalYearQuarterLabel(d: Date) {
  const month = d.getMonth();
  const year = d.getFullYear();
  const fyEndYear = month >= 3 ? year + 1 : year;
  const monthsSinceApril = (month - 3 + 12) % 12;
  const quarter = Math.floor(monthsSinceApril / 3) + 1;
  return `Q${quarter} FY${String(fyEndYear).slice(-2)} Active`;
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
      <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
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

function ForecastSection({ period }: { period: string }) {
  const qc = useQueryClient();
  const [viewType, setViewType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showTarget, setShowTarget] = useState(false);

  const activePeriod = viewType === "YEARLY" ? selectedYear : period;

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
          className="text-sm px-2.5 py-1 rounded-md border font-medium bg-white"
          style={{ borderColor: "var(--ink-200)" }}
        >
          <option value="MONTHLY">Monthly View</option>
          <option value="YEARLY">Yearly View</option>
        </select>
        {viewType === "MONTHLY" ? (
          <span className="text-sm font-medium px-2.5 py-1 rounded-md" style={{ background: "var(--ink-50)", color: "var(--ink-700)" }}>
            {periodLabel(period)} <span className="text-[var(--ink-400)] font-normal">(set via Current Cycle above)</span>
          </span>
        ) : (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="text-sm px-2.5 py-1 rounded-md border bg-white font-medium"
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
  const [cyclePeriod, setCyclePeriod] = useState(currentPeriod());
  const [breakdown, setBreakdown] = useState<{ title: string; key: OwnerMetricKey; format: (n: number) => string } | null>(null);
  const isManager = checkIsManager(user);
  const canDrillDown = !isManager;

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });
  const { data: action } = useQuery<ActionCenterData>({
    queryKey: ["dashboard", "action-center"],
    queryFn: async () => (await api.get("/dashboard/action-center")).data,
  });
  // Cycle-scoped forecast summary — powers the "Target Achieved" badge on Closed Won
  // Revenue for whichever month the Current Cycle picker is set to.
  const { data: cycleForecast } = useQuery<any>({
    queryKey: ["forecast", cyclePeriod],
    queryFn: async () => (await api.get("/forecast", { params: { period: cyclePeriod } })).data,
  });
  // Peer win-rate comparison — leadership-only endpoint (403s for Managers), so only
  // fetch it when the viewer is allowed to see it, matching OwnerPerformanceSection below.
  const { data: ownerPerf } = useQuery<any>({
    queryKey: ["report-owner-perf"],
    queryFn: async () => (await api.get("/reports/owner-performance")).data,
    enabled: !isManager,
  });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";
  const fyBadgeLabel = fiscalYearQuarterLabel(new Date());

  const recentLeads = action?.recentLeads || [];
  const recentActivity = action?.recentActivity || [];
  const opportunitiesAtRisk = action?.opportunitiesAtRisk || [];

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
      <div className="flex flex-wrap items-start justify-between gap-3 px-8 pt-7 pb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>
            {greeting}, {user?.firstName || ""}
          </h1>
          <Badge tone="green">{fyBadgeLabel}</Badge>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)]">
            Current Cycle
            <input
              type="month"
              value={cyclePeriod}
              onChange={(e) => setCyclePeriod(e.target.value)}
              className="text-sm px-2.5 py-1.5 rounded-md border bg-white font-medium"
              style={{ borderColor: "var(--ink-200)" }}
            />
          </label>
          <Button variant="secondary" onClick={downloadPdf} disabled={downloadingPdf}>
            <FileDown size={14} /> {downloadingPdf ? "Generating…" : "Download PDF"}
          </Button>
        </div>
      </div>

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
        ) : (() => {
          const marginValue = (data.kpis.totalGrossMargin || 0) + (data.kpis.totalExpectedMargin || 0);
          const costIncurred = data.kpis.totalBottomLineCost || 0;
          const winRatePct = Math.round(data.kpis.winRate * 100);
          const weightedRatioPct = data.kpis.totalPipeline > 0
            ? Math.round((data.kpis.weightedPipeline / data.kpis.totalPipeline) * 100)
            : 0;
          const realizedBase = marginValue + costIncurred;
          const marginPct = realizedBase > 0 ? Math.round((marginValue / realizedBase) * 100) : 0;
          const costPct = realizedBase > 0 ? 100 - marginPct : 0;
          // Thresholds are ours (not a stored config) — a simple, transparent bucketing of
          // the real margin % computed above, not a fabricated data point.
          const marginHealthLabel = marginPct >= 20 ? "Optimal" : marginPct >= 10 ? "Moderate" : "Low";
          const marginHealthTone = marginPct >= 20 ? "green" : marginPct >= 10 ? "amber" : "rose";

          const topOpenStages = [...(data.charts.pipelineByStage || [])]
            .sort((a, b) => b.count - a.count)
            .slice(0, 2);
          const closingThisWeek = action?.todaysWork?.oppsClosingThisWeek || 0;

          const cycleTarget = cycleForecast?.summary?.target || 0;
          const cycleClosedWon = cycleForecast?.summary?.closedWon || 0;
          const achievedPct = cycleTarget > 0 ? Math.round((cycleClosedWon / cycleTarget) * 100) : null;
          const surplus = cycleClosedWon - cycleTarget;

          const perfRows: any[] = (ownerPerf?.data || []).filter((r: any) => r.metrics.winRate != null);
          const peerAvgWinRatePct = perfRows.length > 0
            ? Math.round((perfRows.reduce((s: number, r: any) => s + r.metrics.winRate, 0) / perfRows.length) * 100)
            : null;
          const winRateDelta = peerAvgWinRatePct !== null ? winRatePct - peerAvgWinRatePct : null;

          const velocityPct = data.kpis.pipelineVelocityPct;

          return (
            <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <Kpi
                icon={BarChart3} label="Total Pipeline" value={formatCurrency(data.kpis.totalPipeline)}
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Total Pipeline", key: "totalPipeline", format: formatCurrency }) : undefined}
                badge={velocityPct !== null ? (
                  <KpiPill tone={velocityPct >= 0 ? "green" : "rose"}>
                    {velocityPct >= 0 ? "+" : ""}{velocityPct.toFixed(1)}% MoM
                  </KpiPill>
                ) : undefined}
                belowValue={data.charts.pipelineVelocity?.length > 0 ? <KpiSparkline data={data.charts.pipelineVelocity} full /> : undefined}
                footerLeft="3-month velocity"
              />

              <Kpi
                icon={TrendingUp} label="Weighted Pipeline" value={formatCurrency(data.kpis.weightedPipeline)}
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Weighted Pipeline", key: "weightedPipeline", format: formatCurrency }) : undefined}
                badge={<KpiPill tone="green">{weightedRatioPct}% ratio</KpiPill>}
                bar={<KpiBar pct={weightedRatioPct} />}
                footerLeft="Risk factored" footerRight={formatCurrencyCompact(data.kpis.weightedPipeline)}
              />

              <Kpi
                icon={Target} label="Open Opportunities" value={String(data.kpis.openOpportunities)}
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Open Opportunities", key: "openOpportunities", format: (n) => String(Math.round(n)) }) : undefined}
                badge={closingThisWeek > 0 ? <KpiPill tone="amber">{closingThisWeek} closing this week</KpiPill> : undefined}
                footerLeft="Stages"
                footerRight={topOpenStages.length > 0 ? (
                  <span className="flex gap-1">
                    {topOpenStages.map((s) => <KpiPill key={s.stageName}>{s.stageName} ({s.count})</KpiPill>)}
                  </span>
                ) : undefined}
              />

              <Kpi
                icon={Trophy} label="Closed Won Revenue" value={formatCurrency(data.kpis.closedWonRevenue)} tone="green"
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Closed Won Revenue", key: "closedWonRevenue", format: formatCurrency }) : undefined}
                badge={achievedPct !== null ? (
                  <KpiPill tone={achievedPct >= 100 ? "green" : "rose"}>Target Achieved: {achievedPct}%</KpiPill>
                ) : undefined}
                bar={achievedPct !== null ? <KpiBar pct={Math.min(achievedPct, 100)} tone={achievedPct >= 100 ? "green" : "ink"} /> : undefined}
                footerLeft={cycleTarget > 0 ? `Target: ${formatCurrencyCompact(cycleTarget)}` : "No target set for this cycle"}
                footerRight={cycleTarget > 0 ? (
                  <span style={{ color: surplus >= 0 ? "var(--ledger-700)" : "var(--rose-600)" }}>
                    {surplus >= 0 ? "+" : ""}{formatCurrencyCompact(surplus)} {surplus >= 0 ? "surplus" : "shortfall"}
                  </span>
                ) : undefined}
              />

              <Kpi
                icon={Percent} label="Win Rate"
                value={<span style={{ color: winRateDelta === null || winRateDelta >= 0 ? "var(--ledger-700)" : "var(--rose-600)" }}>{winRatePct}%</span>}
                onClick={canDrillDown ? () => setBreakdown({ title: "Win Rate", key: "winRate", format: (n) => `${Math.round(n * 100)}%` }) : undefined}
                badge={winRateDelta !== null ? (
                  <KpiPill tone={winRateDelta >= 0 ? "green" : "rose"}>{winRateDelta >= 0 ? "+" : ""}{winRateDelta}% vs peer avg</KpiPill>
                ) : undefined}
                sparkline={<KpiRing pct={winRatePct} centerLabel={`${(winRatePct / 10).toFixed(1)}/10`} />}
                footerLeft={perfRows.length > 0 ? `vs ${perfRows.length} peers` : undefined}
              />

              <Kpi
                icon={IndianRupee} label="Avg Opportunity Size" value={formatCurrency(data.kpis.avgOpportunitySize)}
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Avg Opportunity Size", key: "avgOpportunitySize", format: formatCurrency }) : undefined}
                footerLeft="Based on"
                footerRight={`${data.kpis.closedWonCount} closed-won deal${data.kpis.closedWonCount === 1 ? "" : "s"}`}
              />

              <Kpi
                icon={Gauge} label="Margin Value" value={formatCurrency(marginValue)} tone="green"
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Margin Value", key: "marginValue", format: formatCurrency }) : undefined}
                badge={realizedBase > 0 ? <KpiPill tone="green">{marginPct}% Net</KpiPill> : undefined}
                bar={realizedBase > 0 ? <KpiBar pct={marginPct} /> : undefined}
                footerLeft={realizedBase > 0 ? "Op Margin Health" : undefined}
                footerRight={realizedBase > 0 ? <KpiPill tone={marginHealthTone as any}>{marginHealthLabel}</KpiPill> : undefined}
              />

              <Kpi
                icon={CalendarClock} label="Cost Incurred to Company" value={formatCurrency(costIncurred)}
                url={canDrillDown ? undefined : "/opportunities"}
                onClick={canDrillDown ? () => setBreakdown({ title: "Cost Incurred to Company", key: "costIncurred", format: formatCurrency }) : undefined}
                badge={realizedBase > 0 ? <KpiPill>{costPct}% of value</KpiPill> : undefined}
                bar={realizedBase > 0 ? <KpiBar pct={costPct} tone="ink" /> : undefined}
                footerLeft={realizedBase > 0 ? "Share of realized value" : undefined}
              />
            </div>

            {breakdown && data?.byOwner && (
              <KpiBreakdownModal
                title={breakdown.title}
                metricKey={breakdown.key}
                format={breakdown.format}
                byOwner={data.byOwner}
                currentUserId={user?.id}
                onClose={() => setBreakdown(null)}
              />
            )}
            </>
          );
        })()}

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
          <ForecastSection period={cyclePeriod} />
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
