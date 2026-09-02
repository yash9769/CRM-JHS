import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, inputClass, inputStyle, EmptyState } from "../components/ui";
import { NewAccountModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { formatDate } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Account, Paginated } from "../lib/types";
import { Plus, Search, Building2, Download, UploadCloud } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

const TYPES = ["ALL", "PROSPECT", "CUSTOMER", "PARTNER", "FORMER_CUSTOMER"] as const;

const ACCOUNT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Account Name", permanent: true },
  { key: "industry", label: "Industry" },
  { key: "createdBy", label: "Created By" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunities", label: "Open Opps" },
  { key: "updatedAt", label: "Updated" },
];

export default function AccountsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [accountType, setAccountType] = useState<(typeof TYPES)[number]>("ALL");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "accounts-table",
    ACCOUNT_COLUMNS
  );

  const { data, isLoading } = useQuery<Paginated<Account & { createdBy?: { firstName: string; lastName: string } }>>({
    queryKey: ["accounts", search, accountType, ownerId],
    queryFn: async () =>
      (
        await api.get("/accounts", {
          params: {
            search,
            pageSize: 50,
            ...(accountType !== "ALL" ? { accountType } : {}),
            ...(ownerId ? { ownerId } : {})
          },
        })
      ).data,
  });

  async function exportCsv() {
    await downloadCsvExport(
      "/accounts/export",
      { search, ...(accountType !== "ALL" ? { accountType } : {}), ...(ownerId ? { ownerId } : {}) },
      "accounts.csv"
    );
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
        subtitle="Companies and organizations you sell to."
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={ACCOUNT_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            {user?.orgRole !== "MANAGER" && (
              <Button variant="secondary" onClick={exportCsv}>
                <Download size={14} /> Export CSV
              </Button>
            )}
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Account
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="accounts" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className={`${inputClass} pl-8`}
              style={inputStyle}
            />
          </div>
          <div className="flex gap-1">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setAccountType(t)}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap"
                style={{
                  background: accountType === t ? "var(--ledger-700)" : "var(--ink-50)",
                  color: accountType === t ? "white" : "var(--ink-600)",
                }}
              >
                {t === "ALL" ? "All types" : t.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="w-52">
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
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No accounts yet"
              subtitle="Create your first account to start tracking a customer."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Account</Button>}
            />
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-250px)]">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left border-b bg-white" style={{ borderColor: "var(--ink-100)" }}>
                    {isVisible("name") && (
                      <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide border-b bg-white" style={{ color: "var(--ink-400)", borderColor: "var(--ink-100)" }}>
                        Account Name
                      </th>
                    )}
                  {isVisible("industry") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Industry
                    </th>
                  )}
                  {isVisible("createdBy") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Created By
                    </th>
                  )}
                  {isVisible("assignedTo") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Assigned To
                    </th>
                  )}
                  {isVisible("contacts") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Contacts
                    </th>
                  )}
                  {isVisible("opportunities") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Open Opps
                    </th>
                  )}
                  {isVisible("updatedAt") && (
                    <th className="px-4 py-2.5 font-medium text-xs uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>
                      Updated
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    {isVisible("name") && (
                      <td className="px-4 py-3">
                        <Link to={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-medium" style={{ color: "var(--ink-900)" }}>
                          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--ink-50)" }}>
                            <Building2 size={13} style={{ color: "var(--ink-500)" }} />
                          </div>
                          {a.name}
                        </Link>
                      </td>
                    )}
                    {isVisible("industry") && (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {a.industry || "—"}
                      </td>
                    )}
                    {isVisible("createdBy") && (
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--ink-600)" }}>
                        {a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : "—"}
                      </td>
                    )}
                    {isVisible("assignedTo") && (
                      <td className="px-4 py-3 font-medium text-xs" style={{ color: "var(--ink-700)" }}>
                        {a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : "—"}
                      </td>
                    )}
                    {isVisible("contacts") && (
                      <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-600)" }}>
                        {a._count?.contacts ?? 0}
                      </td>
                    )}
                    {isVisible("opportunities") && (
                      <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-600)" }}>
                        {a._count?.opportunities ?? 0}
                      </td>
                    )}
                    {isVisible("updatedAt") && (
                      <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-400)" }}>
                        {formatDate(a.updatedAt)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </Card>
      </div>
      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
