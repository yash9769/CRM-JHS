import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card } from "../components/ui";
import { Building2, Users, Target, Handshake, Search } from "lucide-react";

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  account:     { label: "Account",     icon: Building2, color: "var(--ink-500)" },
  contact:     { label: "Contact",     icon: Users,     color: "var(--ledger-600)" },
  opportunity: { label: "Opportunity", icon: Target,    color: "var(--amber-600)" },
  deal:        { label: "Deal",        icon: Handshake, color: "var(--ledger-600)" },
};

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";

  const { data, isLoading } = useQuery<any>({
    queryKey: ["search", q],
    queryFn: async () => (await api.get("/search", { params: { q, limit: 20 } })).data,
    enabled: q.length >= 2,
  });

  const results: any[] = data?.results || [];
  const grouped = results.reduce((acc: Record<string, any[]>, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  return (
    <div className="px-8 py-7 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Search size={18} style={{ color: "var(--ink-400)" }} />
        <h1 className="text-xl font-semibold">
          {q ? <>Results for <span style={{ color: "var(--ledger-700)" }}>"{q}"</span></> : "Search"}
        </h1>
      </div>

      {!q || q.length < 2 ? (
        <div className="text-sm" style={{ color: "var(--ink-400)" }}>Type at least 2 characters to search accounts, contacts, opportunities, and deals.</div>
      ) : isLoading ? (
        <div className="text-sm" style={{ color: "var(--ink-400)" }}>Searching…</div>
      ) : results.length === 0 ? (
        <div className="text-sm" style={{ color: "var(--ink-400)" }}>No results found for "{q}".</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, items]) => {
            const tc = typeConfig[type];
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-2">
                  <tc.icon size={14} style={{ color: tc.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>{tc.label}s</span>
                  <span className="text-xs font-mono-num" style={{ color: "var(--ink-400)" }}>({items.length})</span>
                </div>
                <Card>
                  {items.map((r: any, i: number) => (
                    <Link
                      key={r.id}
                      to={r.url}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-[var(--ink-50)] ${i < items.length - 1 ? "border-b" : ""}`}
                      style={{ borderColor: "var(--ink-100)" }}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--ink-50)" }}>
                        <tc.icon size={15} style={{ color: tc.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-medium">{r.title}</div>
                        {r.subtitle && <div className="text-xs" style={{ color: "var(--ink-400)" }}>{r.subtitle}</div>}
                      </div>
                    </Link>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
