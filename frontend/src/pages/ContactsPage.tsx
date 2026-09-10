import { useState, Fragment, type ReactElement } from "react";
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
import { Plus, Search, Download, UploadCloud, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

const CONTACT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Name", permanent: true },
  { key: "designation", label: "Designation" },
  { key: "account", label: "Account" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone Number" },
  { key: "owner", label: "Created By" },
  { key: "createdAt", label: "Created Date" },
];

const SORT_OPTIONS = [
  { label: "Name (A → Z)", value: "name_asc" },
  { label: "Name (Z → A)", value: "name_desc" },
  { label: "Account Name (A → Z)", value: "account_asc" },
  { label: "Account Name (Z → A)", value: "account_desc" },
  { label: "Designation (A → Z)", value: "designation_asc" },
  { label: "Designation (Z → A)", value: "designation_desc" },
  { label: "Created By (A → Z)", value: "created_by_asc" },
  { label: "Created By (Z → A)", value: "created_by_desc" },
  { label: "Newest First", value: "created_desc" },
  { label: "Oldest First", value: "created_asc" },
];

export default function ContactsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("name_asc");

  const { visibleKeys, toggle, showAll, reset, isVisible, orderedColumns, reorder } = useColumnVisibility(
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

  const contactsList = data?.data || [];
  const sortedContacts = [...contactsList].sort((a, b) => {
    if (sortBy === "name_asc") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    if (sortBy === "name_desc") return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
    if (sortBy === "account_asc") return (a.account?.name || "").localeCompare(b.account?.name || "");
    if (sortBy === "account_desc") return (b.account?.name || "").localeCompare(a.account?.name || "");
    if (sortBy === "designation_asc") return (a.jobTitle || "").localeCompare(b.jobTitle || "");
    if (sortBy === "designation_desc") return (b.jobTitle || "").localeCompare(a.jobTitle || "");
    if (sortBy === "created_asc") return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    if (sortBy === "created_by_asc") return (a.owner ? `${a.owner.firstName} ${a.owner.lastName}`.toLowerCase() : "").localeCompare(b.owner ? `${b.owner.firstName} ${b.owner.lastName}`.toLowerCase() : "");
    if (sortBy === "created_by_desc") return (b.owner ? `${b.owner.firstName} ${b.owner.lastName}`.toLowerCase() : "").localeCompare(a.owner ? `${a.owner.firstName} ${a.owner.lastName}`.toLowerCase() : "");
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  function handleHeaderSort(key: string) {
    if (key === "name") {
      setSortBy((s) => (s === "name_asc" ? "name_desc" : "name_asc"));
    } else if (key === "account") {
      setSortBy((s) => (s === "account_asc" ? "account_desc" : "account_asc"));
    } else if (key === "designation") {
      setSortBy((s) => (s === "designation_asc" ? "designation_desc" : "designation_asc"));
    } else if (key === "createdAt") {
      setSortBy((s) => (s === "created_desc" ? "created_asc" : "created_desc"));
    } else if (key === "owner") {
      setSortBy((s) => (s === "created_by_asc" ? "created_by_desc" : "created_by_asc"));
    }
  }

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
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={orderedColumns}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              onReorder={reorder}
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className={`${inputClass} font-medium`}
            style={{ ...inputStyle, width: "auto" }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="w-52">
            {user?.orgRole !== "MANAGER" && (
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
            )}
          </div>
        </div>

        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !sortedContacts.length ? (
            <EmptyState
              title="No contacts yet"
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Contact</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {orderedColumns.filter((col) => isVisible(col.key)).map((col) => {
                    const isSortable = ["name", "designation", "account", "createdAt", "owner"].includes(col.key);
                    const isCurrent =
                      (col.key === "name" && (sortBy === "name_asc" || sortBy === "name_desc")) ||
                      (col.key === "account" && (sortBy === "account_asc" || sortBy === "account_desc")) ||
                      (col.key === "designation" && (sortBy === "designation_asc" || sortBy === "designation_desc")) ||
                      (col.key === "createdAt" && (sortBy === "created_desc" || sortBy === "created_asc")) ||
                      (col.key === "owner" && (sortBy === "created_by_asc" || sortBy === "created_by_desc"));
                    const isAsc = sortBy.endsWith("_asc");
                    return (
                      <th
                        key={col.key}
                        onClick={() => isSortable && handleHeaderSort(col.key)}
                        className={`px-4 py-2.5 text-xs uppercase font-medium select-none ${isSortable ? "cursor-pointer hover:text-[var(--ledger-700)]" : ""}`}
                        style={{ color: isCurrent ? "var(--ledger-700)" : "var(--ink-400)" }}
                      >
                        <div className="flex items-center gap-1">
                          <span>{col.label}</span>
                          {isSortable && (
                            <span>
                              {isCurrent ? (
                                isAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={11} className="opacity-40" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedContacts.map((c) => {
                  const cellRenderers: Record<string, () => ReactElement> = {
                    name: () => (
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
                    ),
                    designation: () => (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.jobTitle || "—"}
                      </td>
                    ),
                    account: () => (
                      <td className="px-4 py-3">
                        {c.account ? (
                          <Link to={`/accounts/${c.account.id}`} style={{ color: "var(--ledger-700)" }}>
                            {c.account.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                    ),
                    email: () => (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.email || "—"}
                      </td>
                    ),
                    phone: () => (
                      <td className="px-4 py-3 font-mono-num" style={{ color: "var(--ink-700)" }}>
                        {c.phone || "—"}
                      </td>
                    ),
                    owner: () => (
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>
                        {c.owner ? `${c.owner.firstName} ${c.owner.lastName}` : "—"}
                      </td>
                    ),
                    createdAt: () => (
                      <td className="px-4 py-3 font-mono-num text-xs" style={{ color: "var(--ink-400)" }}>
                        {formatDate(c.createdAt)}
                      </td>
                    ),
                  };
                  return (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                      {orderedColumns.filter((col) => isVisible(col.key)).map((col) => (
                        <Fragment key={col.key}>{cellRenderers[col.key]?.()}</Fragment>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewContactModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
