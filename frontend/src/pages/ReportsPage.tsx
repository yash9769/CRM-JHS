import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { downloadCsvExport } from "../lib/exportCsv";
import { RoleBadge, BirdsEyeModal } from "./OrgChartPage";
import { Download, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";
import { useAuth } from "../hooks/useAuth";

const TABS = ["Pipeline Health", "Owner Performance", "Win / Loss"] as const;
type Tab = typeof TABS[number];

function PipelineHealthTab() {
  const { data } = useQuery<any>({ queryKey: ["report-pipeline-health"], queryFn: async () => (await api.get("/reports/pipeline-health")).data });
  if (!data?.data?.length) return <div className="text-sm py-8 text-center" style={{ color: "var(--ink-400)" }}>No open opportunities in pipeline.</div>;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Open opportunity value by stage</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
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
  );
}

function OwnerPerformanceTab() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const { data } = useQuery<any>({ queryKey: ["report-owner-perf"], queryFn: async () => (await api.get("/reports/owner-performance")).data });

  async function exportCsv() {
    await downloadCsvExport("/reports/owner-performance/export", {}, "owner_performance.csv");
  }

  if (!data?.data?.length) return <div className="text-sm py-8 text-center" style={{ color: "var(--ink-400)" }}>No performance data available.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--ink-500)]">Click any representative's name to open their complete Bird's-Eye View activity & performance.</p>
        <Button variant="secondary" onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </Button>
      </div>

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

      {selectedUserId && (
        <BirdsEyeModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
      )}
    </div>
  );
}

function WinLossTab() {
  const { data } = useQuery<any>({ queryKey: ["report-win-loss"], queryFn: async () => (await api.get("/reports/win-loss", { params: { months: 6 } })).data });
  if (!data) return null;
  const s = data.summary;
  const COLORS = ["var(--ledger-600)", "var(--rose-400)"];
  const pieData = [
    { name: "Won", value: s.totalWon },
    { name: "Lost", value: s.totalLost },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
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
      <div className="grid grid-cols-2 gap-5">
        {pieData.length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Won vs. Lost</h3>
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
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Monthly trend</h3>
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

export default function ReportsPage() {
  const { user } = useAuth();
  const visibleTabs = TABS.filter(t => t !== "Owner Performance" || user?.orgRole !== "MANAGER");
  const [tab, setTab] = useState<Tab>("Pipeline Health");

  const activeTab = visibleTabs.includes(tab) ? tab : "Pipeline Health";

  return (
    <div>
      <PageHeader title="Reports" />
      <div className="px-8 pb-10">
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--ink-100)" }}>
          {visibleTabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
              style={{ borderColor: activeTab === t ? "var(--ledger-600)" : "transparent", color: activeTab === t ? "var(--ledger-700)" : "var(--ink-500)" }}>
              {t}
            </button>
          ))}
        </div>
        {activeTab === "Pipeline Health" && <PipelineHealthTab />}
        {activeTab === "Owner Performance" && user?.orgRole !== "MANAGER" && <OwnerPerformanceTab />}
        {activeTab === "Win / Loss" && <WinLossTab />}
      </div>
    </div>
  );
}
