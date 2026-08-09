import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, StageBadge, Badge, EmptyState } from "../components/ui";
import { formatCurrency, formatDate } from "../lib/format";
import type { Opportunity, Paginated } from "../lib/types";

export default function OpportunitiesPage() {
  const { data, isLoading } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "list"],
    queryFn: async () => (await api.get("/opportunities", { params: { pageSize: 100 } })).data,
  });

  return (
    <div>
      <PageHeader title="Opportunities" subtitle="Qualified potential business, before they become deals." />
      <div className="px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState title="No opportunities yet" subtitle="Create one from the Pipeline board." />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Account", "Amount", "Stage", "Owner", "Close Date", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {data.data.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3"><Link to={`/opportunities/${o.id}`} className="font-medium">{o.name}</Link></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{o.account?.name}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(o.amount)}</td>
                    <td className="px-4 py-3"><StageBadge stage={o.stage as any} /></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{formatDate(o.expectedCloseDate)}</td>
                    <td className="px-4 py-3">{o.isConverted ? <Badge tone="green">Converted</Badge> : <Badge>Open</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
