import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Target, Handshake, Trophy, Percent, Wallet, Timer, CalendarClock } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

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

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <PageHeader title={`${greeting}, ${user?.firstName}`} subtitle="Here's where your pipeline stands today." />

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
