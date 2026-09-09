import { useState, Fragment, useMemo, type ReactElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, inputClass, inputStyle, EmptyState, Modal } from "../components/ui";
import { NewAccountModal } from "../components/CreateModals";
import { CsvImportModal } from "../components/CsvImportModal";
import { downloadCsvExport } from "../lib/exportCsv";
import { RelationshipSelector } from "../components/RelationshipSelector";
import { fetchOwnerOptions } from "../lib/pickers";
import { formatDate } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Account, Paginated } from "../lib/types";
import { Plus, Search, Building2, Download, UploadCloud, ArrowUpDown, ArrowUp, ArrowDown, Trash2, AlertTriangle } from "lucide-react";

import { useAuth } from "../hooks/useAuth";

const ACCOUNT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Account Name", permanent: true },
  { key: "industry", label: "Industry" },
  { key: "createdBy", label: "Created By" },
  { key: "assignedTo", label: "Assigned To" },
  { key: "contacts", label: "Contacts" },
  { key: "opportunities", label: "Open Opps" },
  { key: "updatedAt", label: "Updated" },
];

const SORT_OPTIONS = [
  { label: "Name (A → Z)", sortBy: "name", sortDir: "asc" },
  { label: "Name (Z → A)", sortBy: "name", sortDir: "desc" },
  { label: "Newest First", sortBy: "createdAt", sortDir: "desc" },
  { label: "Oldest First", sortBy: "createdAt", sortDir: "asc" },
  { label: "Recently Updated", sortBy: "updatedAt", sortDir: "desc" },
  { label: "Industry (A → Z)", sortBy: "industry", sortDir: "asc" },
  { label: "Industry (Z → A)", sortBy: "industry", sortDir: "desc" },
  { label: "Most Open Opps", sortBy: "opportunities", sortDir: "desc" },
  { label: "Least Open Opps", sortBy: "opportunities", sortDir: "asc" },
  { label: "Most Contacts", sortBy: "contacts", sortDir: "desc" },
  { label: "Least Contacts", sortBy: "contacts", sortDir: "asc" },
];

export default function AccountsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerLabel, setOwnerLabel] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const qc = useQueryClient();

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => api.post("/accounts/bulk-delete", { ids }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    },
  });

  const { visibleKeys, toggle, showAll, reset, isVisible, orderedColumns, reorder } = useColumnVisibility(
    "accounts-table",
    ACCOUNT_COLUMNS
  );

  const { data, isLoading } = useQuery<Paginated<Account & { createdBy?: { firstName: string; lastName: string } }>>({
    queryKey: ["accounts", search, ownerId, sortBy, sortDir],
    queryFn: async () =>
      (
        await api.get("/accounts", {
          params: {
            search,
            pageSize: 100,
            ...(ownerId ? { ownerId } : {}),
            sortBy: ["name", "createdAt", "updatedAt", "industry"].includes(sortBy) ? sortBy : undefined,
            sortDir,
          },
        })
      ).data,
  });

  // Client-side sorting fallback for non-Prisma database relations (e.g. _count.contacts, _count.opportunities) and createdBy
  const sortedAccounts = useMemo(() => {
    const raw = data?.data ? [...data.data] : [];
    if (sortBy === "opportunities") {
      raw.sort((a: any, b: any) => {
        const countA = a._count?.opportunities ?? 0;
        const countB = b._count?.opportunities ?? 0;
        return sortDir === "asc" ? countA - countB : countB - countA;
      });
    } else if (sortBy === "contacts") {
      raw.sort((a: any, b: any) => {
        const countA = a._count?.contacts ?? 0;
        const countB = b._count?.contacts ?? 0;
        return sortDir === "asc" ? countA - countB : countB - countA;
      });
    } else if (sortBy === "createdBy") {
      raw.sort((a: any, b: any) => {
        const nameA = a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}`.toLowerCase() : "";
        const nameB = b.createdBy ? `${b.createdBy.firstName} ${b.createdBy.lastName}`.toLowerCase() : "";
        return sortDir === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }
    return raw;
  }, [data?.data, sortBy, sortDir]);

  function handleHeaderSort(key: string) {
    if (key === "name") {
      if (sortBy === "name") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("name");
        setSortDir("asc");
      }
    } else if (key === "industry") {
      if (sortBy === "industry") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("industry");
        setSortDir("asc");
      }
    } else if (key === "updatedAt") {
      if (sortBy === "updatedAt") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("updatedAt");
        setSortDir("desc");
      }
    } else if (key === "opportunities") {
      if (sortBy === "opportunities") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("opportunities");
        setSortDir("desc");
      }
    } else if (key === "contacts") {
      if (sortBy === "contacts") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("contacts");
        setSortDir("desc");
      }
    } else if (key === "createdBy") {
      if (sortBy === "createdBy") {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortBy("createdBy");
        setSortDir("asc");
      }
    }
  }

  async function exportCsv() {
    await downloadCsvExport(
      "/accounts/export",
      {
        search,
        ...(ownerId ? { ownerId } : {}),
      },
      "accounts.csv"
    );
  }

  return (
    <div>
      <PageHeader
        title="Accounts"
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
              <Plus size={15} /> New Account
            </Button>
          </div>
        }
      />
      {showImport && <CsvImportModal entity="accounts" onClose={() => setShowImport(false)} />}
      <div className="px-8 pb-8 space-y-4">
        {/* Filters and Sorting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts…"
                className={`${inputClass} pl-8`}
                style={inputStyle}
              />
            </div>

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

          {/* Sort Order Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--ink-500)] flex items-center gap-1">
              <ArrowUpDown size={13} /> Sort By:
            </span>
            <select
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [sb, sd] = e.target.value.split(":");
                setSortBy(sb);
                setSortDir(sd as "asc" | "desc");
              }}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-white text-[var(--ink-800)] border-[var(--ink-200)] outline-none cursor-pointer hover:border-[var(--ledger-600)] transition-colors"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={`${opt.sortBy}:${opt.sortDir}`} value={`${opt.sortBy}:${opt.sortDir}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Card>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--ink-100)] bg-rose-50/50">
              <span className="text-xs font-medium text-[var(--ink-700)]">{selectedIds.size} account{selectedIds.size > 1 ? "s" : ""} selected</span>
              <Button variant="danger" size="sm" onClick={() => setShowBulkDeleteConfirm(true)} disabled={bulkDeleteMutation.isPending}>
                <Trash2 size={13} /> Delete Selected
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading…</div>
          ) : !sortedAccounts.length ? (
            <EmptyState
              title="No accounts found"
              subtitle="Create your first account or try searching with a different term."
              action={
                <Button onClick={() => setShowNew(true)}>
                  <Plus size={15} /> New Account
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-sm border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left border-b bg-white border-[var(--ink-100)]">
                    <th className="px-3 py-2.5 w-10">
                      <input
                        type="checkbox"
                        checked={sortedAccounts.length > 0 && sortedAccounts.every(a => selectedIds.has(a.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(sortedAccounts.map(a => a.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded border-[var(--ink-300)]"
                      />
                    </th>
                    {orderedColumns.filter((c) => isVisible(c.key)).map((col) => {
                      const isSortable = ["name", "industry", "updatedAt", "opportunities", "contacts", "createdBy"].includes(col.key);
                      const isCurrentSort = sortBy === col.key;
                      return (
                        <th
                          key={col.key}
                          onClick={() => isSortable && handleHeaderSort(col.key)}
                          className={`px-4 py-2.5 font-medium text-xs uppercase tracking-wide border-b bg-white select-none ${
                            isSortable ? "cursor-pointer hover:text-[var(--ledger-700)]" : ""
                          }`}
                          style={{ color: isCurrentSort ? "var(--ledger-700)" : "var(--ink-400)", borderColor: "var(--ink-100)" }}
                        >
                          <div className="flex items-center gap-1">
                            <span>{col.label}</span>
                            {isSortable && (
                              <span className="text-[var(--ink-400)]">
                                {isCurrentSort ? (
                                  sortDir === "asc" ? <ArrowUp size={12} className="text-[var(--ledger-700)]" /> : <ArrowDown size={12} className="text-[var(--ledger-700)]" />
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
                  {sortedAccounts.map((a: any) => {
                    const cellRenderers: Record<string, () => ReactElement> = {
                      name: () => (
                        <td className="px-4 py-3">
                          <Link to={`/accounts/${a.id}`} className="flex items-center gap-2.5 font-medium text-[var(--ink-900)] hover:text-[var(--ledger-700)]">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-[var(--ink-50)]">
                              <Building2 size={13} className="text-[var(--ink-500)]" />
                            </div>
                            {a.name}
                          </Link>
                        </td>
                      ),
                      industry: () => (
                        <td className="px-4 py-3 text-[var(--ink-600)]">
                          {a.industry || "—"}
                        </td>
                      ),
                      createdBy: () => (
                        <td className="px-4 py-3 text-xs text-[var(--ink-600)]">
                          {a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : "—"}
                        </td>
                      ),
                      assignedTo: () => (
                        <td className="px-4 py-3 font-medium text-xs text-[var(--ink-700)]">
                          {a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : "—"}
                        </td>
                      ),
                      contacts: () => (
                        <td className="px-4 py-3 font-mono-num text-[var(--ink-600)]">
                          {a._count?.contacts ?? 0}
                        </td>
                      ),
                      opportunities: () => (
                        <td className="px-4 py-3 font-mono-num text-[var(--ink-600)]">
                          {a._count?.opportunities ?? 0}
                        </td>
                      ),
                      updatedAt: () => (
                        <td className="px-4 py-3 font-mono-num text-xs text-[var(--ink-400)]">
                          {formatDate(a.updatedAt)}
                        </td>
                      ),
                    };
                    return (
                      <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        <td className="px-3 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(a.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(a.id); else next.delete(a.id);
                              setSelectedIds(next);
                            }}
                            className="rounded border-[var(--ink-300)]"
                          />
                        </td>
                        {orderedColumns.filter((c) => isVisible(c.key)).map((col) => (
                          <Fragment key={col.key}>{cellRenderers[col.key]?.()}</Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {showNew && <NewAccountModal onClose={() => setShowNew(false)} />}
      {showBulkDeleteConfirm && (
        <Modal title="Delete Accounts" onClose={() => setShowBulkDeleteConfirm(false)} width="480px">
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-0.5">Permanent Deletion</div>
                <div>This will permanently delete {selectedIds.size} account{selectedIds.size > 1 ? "s" : ""} and all associated records. This action cannot be undone.</div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
              <Button variant="secondary" onClick={() => setShowBulkDeleteConfirm(false)} disabled={bulkDeleteMutation.isPending}>Cancel</Button>
              <Button variant="danger" onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))} disabled={bulkDeleteMutation.isPending}>
                {bulkDeleteMutation.isPending ? "Deleting…" : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
