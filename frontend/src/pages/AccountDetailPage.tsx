import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient as useQC2 } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Badge, StageBadge, EmptyState, Button } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { NewContactModal, NewOpportunityModal, LogActivityModal } from "../components/CreateModals";
import { EditAccountModal, ArchiveConfirmModal } from "../components/EditModals";
import { HistoryPanel } from "../components/HistoryPanel";
import { formatCurrency, formatDate, initials } from "../lib/format";
import type { Account } from "../lib/types";
import { Building2, Globe, Phone, MapPin, Users, Target, Plus, PhoneCall, Pencil, Archive } from "lucide-react";

const tabs = ["Overview", "Contacts", "Opportunities", "Activity", "History"] as const;

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qcArchive = useQC2();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [modal, setModal] = useState<"contact" | "opportunity" | "log" | "edit" | "archive" | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/archive`),
    onSuccess: () => { qcArchive.invalidateQueries({ queryKey: ["accounts"] }); navigate("/accounts"); },
  });

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["account", id],
    queryFn: async () => (await api.get(`/accounts/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !account) return <div className="p-8 text-sm text-[var(--ink-400)]">Loading…</div>;

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-6xl mx-auto space-y-5 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center bg-[var(--ink-50)]">
            <Building2 size={20} className="text-[var(--ink-500)]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink-900)]">{account.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-[var(--ink-500)]">
              <Badge tone={account.accountType === "CUSTOMER" ? "green" : "amber"}>{account.accountType.replace("_", " ")}</Badge>
              {account.owner && <span>Owner: {account.owner.firstName} {account.owner.lastName}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
          <Button variant="secondary" onClick={() => setModal("opportunity")}><Target size={14} /> Create Opportunity</Button>
          <Button variant="secondary" onClick={() => setModal("contact")}><Users size={14} /> Create Contact</Button>
          <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log Activity</Button>
          <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--ink-100)] overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap"
            style={{ borderColor: tab === t ? "var(--ledger-600)" : "transparent", color: tab === t ? "var(--ledger-700)" : "var(--ink-500)" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="p-4 md:p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">Account information</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 text-sm">
              <div><dt className="text-xs text-[var(--ink-400)]">Industry</dt><dd className="mt-0.5">{account.industry || "—"}</dd></div>
              <div><dt className="text-xs text-[var(--ink-400)]">Employees</dt><dd className="mt-0.5 font-mono-num">{account.employeeCount || "—"}</dd></div>
              <div><dt className="text-xs text-[var(--ink-400)]">Annual Revenue</dt><dd className="mt-0.5 font-mono-num">{account.annualRevenue ? formatCurrency(account.annualRevenue) : "—"}</dd></div>
              <div><dt className="text-xs text-[var(--ink-400)]">Domain</dt><dd className="mt-0.5">{account.domain || "—"}</dd></div>
              <div className="flex items-start gap-1.5"><Globe size={13} className="mt-0.5 text-[var(--ink-400)]" /><div><dt className="text-xs text-[var(--ink-400)]">Website</dt><dd className="mt-0.5">{account.website || "—"}</dd></div></div>
              <div className="flex items-start gap-1.5"><Phone size={13} className="mt-0.5 text-[var(--ink-400)]" /><div><dt className="text-xs text-[var(--ink-400)]">Phone</dt><dd className="mt-0.5">{account.phone || "—"}</dd></div></div>
              <div className="sm:col-span-2 flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 text-[var(--ink-400)]" /><div><dt className="text-xs text-[var(--ink-400)]">Billing Address</dt><dd className="mt-0.5">{account.billingAddress || "—"}</dd></div></div>
            </dl>
            {account.description && (
              <>
                <div className="text-xs mt-4 mb-1 text-[var(--ink-400)]">Description</div>
                <p className="text-sm text-[var(--ink-600)]">{account.description}</p>
              </>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs mb-1 text-[var(--ink-400)]"><Users size={13} /> Contacts</div>
              <div className="text-2xl font-mono-num font-semibold text-[var(--ink-900)]">{account.contacts?.length ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs mb-1 text-[var(--ink-400)]"><Target size={13} /> Open Opportunities</div>
              <div className="text-2xl font-mono-num font-semibold text-[var(--ink-900)]">{account.opportunities?.filter((o) => !o.stage?.isClosed).length ?? 0}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Contacts" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)]">
            <span className="text-xs uppercase font-medium text-[var(--ink-400)]">Contacts</span>
            <Button size="sm" onClick={() => setModal("contact")}><Plus size={13} /> Add Contact</Button>
          </div>
          {!account.contacts?.length ? (
            <EmptyState title="No contacts yet" action={<Button onClick={() => setModal("contact")}><Plus size={15} /> Add Contact</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-[var(--ink-100)]">
                  {["Name", "Title", "Email", "Phone"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {account.contacts.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                      <td className="px-4 py-3">
                        <Link to={`/contacts/${c.id}`} className="flex items-center gap-2 font-medium hover:underline">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white bg-[var(--ink-600)]">{initials(c.firstName, c.lastName)}</div>
                          {c.firstName} {c.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-600)]">{c.jobTitle || "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-600)]">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-600)]">{c.phone || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Opportunities" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)]">
            <span className="text-xs uppercase font-medium text-[var(--ink-400)]">Opportunities</span>
            <Button size="sm" onClick={() => setModal("opportunity")}><Plus size={13} /> Add Opportunity</Button>
          </div>
          {!account.opportunities?.length ? (
            <EmptyState title="No opportunities yet" subtitle="Start tracking potential business." action={<Button onClick={() => setModal("opportunity")}><Plus size={15} /> Create Opportunity</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left border-b border-[var(--ink-100)]">
                  {["Opportunity", "Stage", "Expected Value", "Actual Value", "Margin", "Close Date"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">{h}</th>)}
                </tr></thead>
                <tbody>
                  {account.opportunities.map((o) => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                      <td className="px-4 py-3"><Link to={`/opportunities/${o.id}`} className="font-medium hover:underline text-[var(--ledger-700)]">{o.name}</Link></td>
                      <td className="px-4 py-3"><StageBadge stage={o.stage as any} /></td>
                      <td className="px-4 py-3 font-mono-num font-semibold text-slate-800">{o.expectedDealValue !== null && o.expectedDealValue !== undefined ? formatCurrency(o.expectedDealValue) : formatCurrency(o.amount)}</td>
                      <td className="px-4 py-3 font-mono-num font-semibold text-slate-900">{o.actualDealValue !== null && o.actualDealValue !== undefined ? formatCurrency(o.actualDealValue) : "—"}</td>
                      <td className={`px-4 py-3 font-mono-num font-bold ${o.grossMargin !== null && o.grossMargin !== undefined && Number(o.grossMargin) < 0 ? "text-rose-600" : "text-emerald-700"}`}>
                        {o.grossMargin !== null && o.grossMargin !== undefined ? formatCurrency(o.grossMargin) : (o.expectedMargin !== null && o.expectedMargin !== undefined ? formatCurrency(o.expectedMargin) : "—")}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(o.expectedCloseDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "Activity" && (
        <Card className="p-4 md:p-5">
          <Timeline
            activities={account.activities}
            notes={account.notes}
            assoc={{ objectType: "ACCOUNT", accountId: account.id }}
            queryKeysToInvalidate={[["account", id]]}
          />
        </Card>
      )}

      {tab === "History" && (
        <Card className="p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">History</h3>
          <HistoryPanel objectType="ACCOUNT" recordId={account.id} />
        </Card>
      )}

      {modal === "edit" && <EditAccountModal account={account} onClose={() => setModal(null)} />}
      {modal === "archive" && (
        <ArchiveConfirmModal
          title={account.name}
          impactUrl={`/accounts/${account.id}/impact`}
          isPending={archiveMutation.isPending}
          onConfirm={() => archiveMutation.mutate()}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "contact" && <NewContactModal accountId={account.id} accountName={account.name} onClose={() => setModal(null)} />}
      {modal === "opportunity" && <NewOpportunityModal accountId={account.id} accountName={account.name} onClose={() => setModal(null)} />}
      {modal === "log" && <LogActivityModal context={{ objectType: "ACCOUNT", accountId: account.id, label: account.name }} onClose={() => setModal(null)} />}
    </div>
  );
}
