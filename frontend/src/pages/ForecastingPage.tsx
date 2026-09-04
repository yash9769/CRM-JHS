import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Field, inputClass, inputStyle, Badge } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Target, TrendingUp, Trophy, AlertCircle } from "lucide-react";

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

export default function ForecastingPage() {
  const [viewType, setViewType] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [monthlyPeriod, setMonthlyPeriod] = useState(currentPeriod());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [showTarget, setShowTarget] = useState(false);
  const qc = useQueryClient();

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
    <div>
      <PageHeader
        title="Forecasting"
        action={<Button onClick={() => setShowTarget(true)}><Target size={15} /> Set Target</Button>}
      />

      <div className="px-8 pb-10 space-y-6">
        {/* Period picker */}
        <div className="flex items-center gap-3">
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
            <input
              type="month"
              value={monthlyPeriod}
              onChange={(e) => setMonthlyPeriod(e.target.value)}
              className="text-sm px-2.5 py-1 rounded-md border bg-white font-medium"
              style={{ borderColor: "var(--ink-200)" }}
            />
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

        {/* Summary KPIs */}
        {s && (
          <div className="grid grid-cols-4 gap-3">
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

        <div className="grid grid-cols-2 gap-5">
          {/* Forecast categories */}
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
                ].map(({ label, value, tone }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge tone={tone}>{label}</Badge>
                    </div>
                    <span className="font-mono-num font-medium text-sm">{formatCurrency(value)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* By owner */}
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

        {/* 12-month trend */}
        {trend?.data?.length > 0 && (
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>12-month: Target vs. Actual</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend.data} margin={{ right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ink-100)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ink-400)" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--ink-400)" }}
                  axisLine={false}
                  tickLine={false}
                  width={75}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip formatter={(v: any) => formatCurrency(Number(v))} contentStyle={{ borderRadius: 8, borderColor: "var(--ink-200)", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="target" name="Target" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="var(--ledger-600)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {showTarget && <SetTargetModal period={activePeriod} users={users?.data || []} onClose={() => { setShowTarget(false); qc.invalidateQueries({ queryKey: ["forecast"] }); }} />}
    </div>
  );
}
