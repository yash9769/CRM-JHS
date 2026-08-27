import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, EmptyState, inputClass, inputStyle } from "../components/ui";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { formatCurrency, formatDate } from "../lib/format";
import { downloadCsvExport } from "../lib/exportCsv";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import { Trophy, Search, Download, CheckCircle2, TrendingUp } from "lucide-react";

const WON_DEAL_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Deal / Opportunity Name", permanent: true },
  { key: "account", label: "Account" },
  { key: "contact", label: "Contact Person" },
  { key: "amount", label: "Deal Value" },
  { key: "owner", label: "Owner" },
  { key: "wonDate", label: "Won Date" },
  { key: "closeDate", label: "Close Date" },
  { key: "stage", label: "Stage" },
  { key: "type", label: "Type", defaultVisible: false },
];

export interface WonItem {
  id: string;
  name: string;
  amount: string;
  account?: { id: string; name: string } | null;
  contact?: { id: string; firstName: string; lastName: string } | null;
  contacts?: { contact: { firstName: string; lastName: string } }[] | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
  ownerId?: string | null;
  wonDate?: string | null;
  closeDate?: string | null;
  dealType?: string | null;
  stage?: { id: string; name: string; isWon?: boolean; isClosed?: boolean } | null;
  isOpportunity?: boolean;
  opportunityId?: string | null;
}

export default function WonDealsPage() {
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "won-deals-table",
    WON_DEAL_COLUMNS
  );

  const { data: wonList = [], isLoading } = useQuery<WonItem[]>({
    queryKey: ["won-deals", search, ownerId],
    queryFn: async () => {
      const [dealsRes, oppsRes] = await Promise.all([
        api.get("/deals", {
          params: {
            won: "true",
            search,
            pageSize: 1000,
            ...(ownerId ? { ownerId } : {}),
          },
        }),
        api.get("/opportunities", {
          params: {
            won: "true",
            search,
            pageSize: 1000,
            ...(ownerId ? { ownerId } : {}),
          },
        }),
      ]);

      const deals: WonItem[] = dealsRes.data?.data || [];
      const opps: any[] = oppsRes.data?.data || [];

      const convertedDealIds = new Set(opps.map((o) => o.convertedDealId).filter(Boolean));
      const filteredDeals = deals.filter((d) => !d.opportunityId || !convertedDealIds.has(d.id));

      const oppsAsWonItems: WonItem[] = opps.map((o) => ({
        id: o.id,
        name: o.name,
        amount: o.amount,
        account: o.account,
        contact: o.contact,
        contacts: o.contacts,
        owner: o.owner,
        ownerId: o.ownerId,
        wonDate: o.updatedAt,
        closeDate: o.expectedCloseDate || o.updatedAt,
        dealType: o.opportunityType,
        stage: o.stage,
        isOpportunity: true,
        opportunityId: o.id,
      }));

      // Merge and deduplicate (prefer converted deal if both exist)
      const combined = [
        ...filteredDeals,
        ...oppsAsWonItems.filter((o) => {
          const matchingDeal = filteredDeals.find((d) => 
            d.opportunityId === o.id || 
            (d.name === o.name && d.account?.id && o.account?.id && d.account.id === o.account.id)
          );
          return !matchingDeal;
        }),
      ];

      return combined;
    },
  });

  const totalWonRevenue = wonList.reduce((acc, d) => acc + Number(d.amount || 0), 0);
  const avgDealSize = wonList.length > 0 ? totalWonRevenue / wonList.length : 0;

  async function exportCsv() {
    await downloadCsvExport(
      "/deals/export",
      { won: "true", search, ...(ownerId ? { ownerId } : {}) },
      "won_deals.csv"
    );
  }

  return (
    <div>
      <PageHeader
        title="Won Deals"
        subtitle="All successfully closed deals and won proposals across your organization."
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={WON_DEAL_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="px-8 pb-8 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <Trophy size={15} style={{ color: "var(--ledger-600)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--ink-500)" }}>
                Total Won Revenue
              </span>
            </div>
            <div className="font-mono-num text-2xl font-bold" style={{ color: "var(--ledger-700)" }}>
              {formatCurrency(totalWonRevenue)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <CheckCircle2 size={15} style={{ color: "var(--ledger-600)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--ink-500)" }}>
                Won Deals Count
              </span>
            </div>
            <div className="font-mono-num text-2xl font-bold" style={{ color: "var(--ink-900)" }}>
              {wonList.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <TrendingUp size={15} style={{ color: "var(--ledger-600)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--ink-500)" }}>
                Average Deal Size
              </span>
            </div>
            <div className="font-mono-num text-2xl font-bold" style={{ color: "var(--ink-900)" }}>
              {formatCurrency(avgDealSize)}
            </div>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--ink-400)" }}
            />
            <input
              type="text"
              placeholder="Search won deals & proposals…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-8 text-xs`}
              style={inputStyle}
            />
          </div>
          <div className="w-56">
            <RelationshipSelector
              value={ownerId}
              valueLabel={ownerLabel}
              onChange={(id, opt) => {
                setOwnerId(id);
                setOwnerLabel(opt?.label || null);
              }}
              fetchOptions={fetchOwnerOptions}
              placeholder="Filter by owner…"
            />
          </div>
          {(search || ownerId) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setOwnerId(null);
                setOwnerLabel(null);
              }}
              className="text-xs"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Table */}
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-sm text-center" style={{ color: "var(--ink-400)" }}>
              Loading won deals…
            </div>
          ) : wonList.length === 0 ? (
            <EmptyState
              title="No won deals found"
              subtitle={
                search || ownerId
                  ? "No won deals match the current filter criteria."
                  : "Deals and opportunities marked as Proposal Won will appear here."
              }
            />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--ink-100)", background: "var(--ink-50)" }}>
                  {isVisible("name") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Deal / Opportunity Name
                    </th>
                  )}
                  {isVisible("account") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Account
                    </th>
                  )}
                  {isVisible("contact") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Contact Person
                    </th>
                  )}
                  {isVisible("amount") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Deal Value
                    </th>
                  )}
                  {isVisible("owner") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Owner
                    </th>
                  )}
                  {isVisible("wonDate") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Won Date
                    </th>
                  )}
                  {isVisible("closeDate") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Close Date
                    </th>
                  )}
                  {isVisible("stage") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Stage
                    </th>
                  )}
                  {isVisible("type") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium whitespace-nowrap" style={{ color: "var(--ink-400)" }}>
                      Type
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {wonList.map((d) => {
                  const contactName = d.contact
                    ? `${d.contact.firstName} ${d.contact.lastName}`
                    : d.contacts && d.contacts[0]?.contact
                    ? `${d.contacts[0].contact.firstName} ${d.contacts[0].contact.lastName}`
                    : "—";

                  const targetOppId = d.isOpportunity ? d.id : (d.opportunityId || null);

                  return (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                      {isVisible("name") && (
                        <td className="px-4 py-3">
                          {targetOppId ? (
                            <Link to={`/opportunities/${targetOppId}`} className="font-semibold hover:underline" style={{ color: "var(--ledger-700)" }}>
                              {d.name}
                            </Link>
                          ) : (
                            <span className="font-semibold" style={{ color: "var(--ledger-700)" }}>
                              {d.name}
                            </span>
                          )}
                        </td>
                      )}
                      {isVisible("account") && (
                        <td className="px-4 py-3">
                          {d.account ? (
                            <Link to={`/accounts/${d.account.id}`} className="hover:underline font-medium" style={{ color: "var(--ink-800)" }}>
                              {d.account.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      {isVisible("contact") && (
                        <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                          {contactName}
                        </td>
                      )}
                      {isVisible("amount") && (
                        <td className="px-4 py-3 font-mono-num font-semibold" style={{ color: "var(--ledger-700)" }}>
                          {formatCurrency(d.amount)}
                        </td>
                      )}
                      {isVisible("owner") && (
                        <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                          {d.owner ? `${d.owner.firstName} ${d.owner.lastName}` : "—"}
                        </td>
                      )}
                      {isVisible("wonDate") && (
                        <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ledger-700)" }}>
                          {formatDate(d.wonDate || d.closeDate)}
                        </td>
                      )}
                      {isVisible("closeDate") && (
                        <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-500)" }}>
                          {formatDate(d.closeDate || d.wonDate)}
                        </td>
                      )}
                      {isVisible("stage") && (
                        <td className="px-4 py-3">
                          <Badge tone="green">{d.stage?.name || "Proposal Won"}</Badge>
                        </td>
                      )}
                      {isVisible("type") && (
                        <td className="px-4 py-3">
                          <Badge tone="neutral">{(d.dealType || "NEW_BUSINESS").replace("_", " ")}</Badge>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
