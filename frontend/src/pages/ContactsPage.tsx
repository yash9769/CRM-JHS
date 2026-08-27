import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, inputClass, inputStyle, EmptyState } from "../components/ui";
import { NewContactModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { initials, formatDate } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Contact, Paginated } from "../lib/types";
import { Plus, Search, Download, UploadCloud } from "lucide-react";

const CONTACT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", permanent: true },
  { key: "designation", label: "Designation" },
  { key: "account", label: "Account" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "owner", label: "Owner" },
  { key: "createdAt", label: "Created Date" },
];

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "contacts-table",
    CONTACT_COLUMNS
  );

  const { data, isLoading } = useQuery<Paginated<Contact>>({
    queryKey: ["contacts", search, ownerId],
    queryFn: async () =>
      (
        await api.get("/contacts", {
          params: { search, pageSize: 50, ...(ownerId ? { ownerId } : {}) },
        })
      ).data,
  });

  async function exportCsv() {
    await downloadCsvExport(
      "/contacts/export",
      { search, ...(ownerId ? { ownerId } : {}) },
      "contacts.csv"
    );
  }

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle="People at the accounts you work with."
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={CONTACT_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={14} /> Import CSV
            </Button>
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Contact
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="contacts" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-400)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className={`${inputClass} pl-8`}
              style={inputStyle}
            />
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
              title="No contacts yet"
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Contact</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {isVisible("name") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Name
                    </th>
                  )}
                  {isVisible("designation") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Designation
                    </th>
                  )}
                  {isVisible("account") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Account
                    </th>
                  )}
                  {isVisible("email") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Email
                    </th>
                  )}
                  {isVisible("phone") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Phone Number
                    </th>
                  )}
                  {isVisible("owner") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Owner
                    </th>
                  )}
                  {isVisible("createdAt") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Created Date
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    {isVisible("name") && (
                      <td className="px-4 py-3">
                        <Link to={`/contacts/${c.id}`} className="flex items-center gap-2.5 font-medium">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white shrink-0"
                            style={{ background: "var(--ink-600)" }}
                          >
                            {initials(c.firstName, c.lastName)}
                          </div>
                          {c.firstName} {c.lastName}
                        </Link>
                      </td>
                    )}
                    {isVisible("designation") && (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.jobTitle || "—"}
                      </td>
                    )}
                    {isVisible("account") && (
                      <td className="px-4 py-3">
                        {c.account ? (
                          <Link to={`/accounts/${c.account.id}`} style={{ color: "var(--ledger-700)" }}>
                            {c.account.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    )}
                    {isVisible("email") && (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.email || "—"}
                      </td>
                    )}
                    {isVisible("phone") && (
                      <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-700)" }}>
                        {c.phone || "—"}
                      </td>
                    )}
                    {isVisible("owner") && (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "—"}
                      </td>
                    )}
                    {isVisible("createdAt") && (
                      <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-400)" }}>
                        {formatDate(c.createdAt)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewContactModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
