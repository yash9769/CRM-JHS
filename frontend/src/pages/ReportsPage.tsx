import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from "recharts";

const TABS = ["Pipeline Health", "Owner Performance", "Win / Loss", "Conversion Funnel"] as const;
type Tab = typeof TABS[number];

function PipelineHealthTab() {
  const { data } = useQuery<any>({ queryKey: ["report-pipeline-health"], queryFn: async () => (await api.get("/reports/pipeline-health")).data });
  if (!data?.data?.length) return <div className="text-sm py-8 text-center" style={{ color: "var(--ink-400)" }}>No open deals in pipeline.</div>;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Open deal value by stage</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.data} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="stage.name" tick={{ fontSize: 12, fill: "var(--ink-500)" }} axisLine={false} tickLine={false} width={120} />
            <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
            <Bar dataKey="amount" name="Deal Value" fill="var(--ledger-600)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
            {["Stage", "Deals", "Value", "Overdue", "Avg Age (days)"].map(h => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {data.data.map((row: any) => (
              <tr key={row.stage.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                <td className="px-4 py-3 font-medium">{row.stage.name}</td>
                <td className="px-4 py-3 font-mono-num">{row.count}</td>
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
  const { data } = useQuery<any>({ queryKey: ["report-owner-perf"], queryFn: async () => (await api.get("/reports/owner-performance")).data });
  if (!data?.data?.length) return <div className="text-sm py-8 text-center" style={{ color: "var(--ink-400)" }}>No data yet.</div>;
  return (
    <Card>
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
          {["Rep", "Open Opps", "Open Deals", "Pipeline", "Weighted", "Closed Won", "Win Rate"].map(h => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
        </tr></thead>
        <tbody>
          {data.data.map((row: any) => (
            <tr key={row.user.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
              <td className="px-4 py-3 font-medium">{row.user.firstName} {row.user.lastName}</td>
              <td className="px-4 py-3 font-mono-num">{row.metrics.openOpportunities}</td>
              <td className="px-4 py-3 font-mono-num">{row.metrics.openDeals}</td>
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
          { label: "Deals Won", value: String(s.totalWon), sub: formatCurrency(s.wonRevenue) },
          { label: "Deals Lost", value: String(s.totalLost), sub: formatCurrency(s.lostRevenue) },
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

function ConversionFunnelTab() {
  const { data } = useQuery<any>({ queryKey: ["report-funnel"], queryFn: async () => (await api.get("/reports/conversion-funnel")).data });
  if (!data?.data?.length) return <div className="text-sm py-8 text-center" style={{ color: "var(--ink-400)" }}>No data yet.</div>;
  const max = Math.max(...data.data.map((s: any) => s.count), 1);
  return (
    <Card className="p-6">
      <h3 className="text-sm font-semibold mb-5" style={{ color: "var(--ink-800)" }}>Opportunity funnel by stage</h3>
      <div className="space-y-3">
        {data.data.map((row: any, i: number) => {
          const pct = (row.count / max) * 100;
          return (
            <div key={row.stage.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{row.stage.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num text-sm">{formatCurrency(row.amount)}</span>
                  <span className="font-mono-num text-sm w-8 text-right" style={{ color: "var(--ink-500)" }}>{row.count}</span>
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--ink-100)" }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: `var(--ledger-${Math.max(400, 700 - i * 50)})` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("Pipeline Health");
  return (
    <div>
      <PageHeader title="Reports" subtitle="Pipeline health, rep performance, and win/loss trends." />
      <div className="px-8 pb-10">
        <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--ink-100)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className="px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
              style={{ borderColor: tab === t ? "var(--ledger-600)" : "transparent", color: tab === t ? "var(--ledger-700)" : "var(--ink-500)" }}>
              {t}
            </button>
          ))}
        </div>
        {tab === "Pipeline Health"     && <PipelineHealthTab />}
        {tab === "Owner Performance"   && <OwnerPerformanceTab />}
        {tab === "Win / Loss"          && <WinLossTab />}
        {tab === "Conversion Funnel"   && <ConversionFunnelTab />}
      </div>
    </div>
  );
}
