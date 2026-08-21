import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Badge, StageBadge, EmptyState, Button } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { NewContactModal, NewOpportunityModal, NewDealModal, NewLeadModal, NewTaskModal, LogActivityModal } from "../components/CreateModals";
import { EditAccountModal, ArchiveConfirmModal } from "../components/EditModals";
import { HistoryPanel } from "../components/HistoryPanel";
import { useMutation, useQueryClient as useQC2 } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate, initials } from "../lib/format";
import type { Account } from "../lib/types";
import { Building2, Globe, Phone, MapPin, Users, Target, Handshake, Plus, CheckSquare, PhoneCall, Pencil, Archive, UserPlus } from "lucide-react";

const tabs = ["Overview", "Contacts", "Opportunities", "Deals", "Activity", "History"] as const;

export default function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qcArchive = useQC2();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Overview");
  const [modal, setModal] = useState<"contact" | "opportunity" | "deal" | "lead" | "task" | "log" | "edit" | "archive" | null>(null);
  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/accounts/${id}/archive`),
    onSuccess: () => { qcArchive.invalidateQueries({ queryKey: ["accounts"] }); navigate("/accounts"); },
  });

  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ["account", id],
    queryFn: async () => (await api.get(`/accounts/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !account) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>;

  return (
    <div className="px-8 py-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: "var(--ink-50)" }}>
            <Building2 size={20} style={{ color: "var(--ink-500)" }} />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{account.name}</h1>
            <div className="flex items-center gap-2 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
              <Badge tone={account.accountType === "CUSTOMER" ? "green" : "amber"}>{account.accountType.replace("_", " ")}</Badge>
              {account.owner && <span>Owner: {account.owner.firstName} {account.owner.lastName}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
          <Button variant="secondary" onClick={() => setModal("opportunity")}><Target size={14} /> Create Opportunity</Button>
          <Button variant="secondary" onClick={() => setModal("contact")}><Users size={14} /> Create Contact</Button>
          <Button variant="secondary" onClick={() => setModal("deal")}><Handshake size={14} /> Create Deal</Button>
          <Button variant="secondary" onClick={() => setModal("lead")}><UserPlus size={14} /> Create Lead</Button>
          <Button variant="secondary" onClick={() => setModal("task")}><CheckSquare size={14} /> Task</Button>
          <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log Activity</Button>
          <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--ink-100)" }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3.5 py-2.5 text-sm font-medium border-b-2 -mb-px"
            style={{ borderColor: tab === t ? "var(--ledger-600)" : "transparent", color: tab === t ? "var(--ledger-700)" : "var(--ink-500)" }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid grid-cols-3 gap-5">
          <Card className="p-5 col-span-2">
            <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Account information</h3>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Industry</dt><dd className="mt-0.5">{account.industry || "—"}</dd></div>
              <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Employees</dt><dd className="mt-0.5 font-mono-num">{account.employeeCount || "—"}</dd></div>
              <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Annual Revenue</dt><dd className="mt-0.5 font-mono-num">{account.annualRevenue ? formatCurrency(account.annualRevenue) : "—"}</dd></div>
              <div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Domain</dt><dd className="mt-0.5">{account.domain || "—"}</dd></div>
              <div className="flex items-start gap-1.5"><Globe size={13} className="mt-0.5" style={{ color: "var(--ink-400)" }} /><div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Website</dt><dd className="mt-0.5">{account.website || "—"}</dd></div></div>
              <div className="flex items-start gap-1.5"><Phone size={13} className="mt-0.5" style={{ color: "var(--ink-400)" }} /><div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Phone</dt><dd className="mt-0.5">{account.phone || "—"}</dd></div></div>
              <div className="col-span-2 flex items-start gap-1.5"><MapPin size={13} className="mt-0.5" style={{ color: "var(--ink-400)" }} /><div><dt className="text-xs" style={{ color: "var(--ink-400)" }}>Billing Address</dt><dd className="mt-0.5">{account.billingAddress || "—"}</dd></div></div>
            </dl>
            {account.description && (
              <>
                <div className="text-xs mt-4 mb-1" style={{ color: "var(--ink-400)" }}>Description</div>
                <p className="text-sm" style={{ color: "var(--ink-600)" }}>{account.description}</p>
              </>
            )}
          </Card>
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--ink-400)" }}><Users size={13} /> Contacts</div>
              <div className="text-2xl font-mono-num font-semibold">{account.contacts?.length ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--ink-400)" }}><Target size={13} /> Open Opportunities</div>
              <div className="text-2xl font-mono-num font-semibold">{account.opportunities?.filter((o) => !o.isConverted).length ?? 0}</div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-xs mb-1" style={{ color: "var(--ink-400)" }}><Handshake size={13} /> Deals</div>
              <div className="text-2xl font-mono-num font-semibold">{account.deals?.length ?? 0}</div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Contacts" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Contacts</span>
            <Button size="sm" onClick={() => setModal("contact")}><Plus size={13} /> Add Contact</Button>
          </div>
          {!account.contacts?.length ? (
            <EmptyState title="No contacts yet" action={<Button onClick={() => setModal("contact")}><Plus size={15} /> Add Contact</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Title", "Email", "Phone"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {account.contacts.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3">
                      <Link to={`/contacts/${c.id}`} className="flex items-center gap-2 font-medium">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white" style={{ background: "var(--ink-600)" }}>{initials(c.firstName, c.lastName)}</div>
                        {c.firstName} {c.lastName}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{c.jobTitle || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{c.email || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{c.phone || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "Opportunities" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Opportunities</span>
            <Button size="sm" onClick={() => setModal("opportunity")}><Plus size={13} /> Add Opportunity</Button>
          </div>
          {!account.opportunities?.length ? (
            <EmptyState title="No opportunities yet" subtitle="Start tracking potential business." action={<Button onClick={() => setModal("opportunity")}><Plus size={15} /> Create Opportunity</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Amount", "Stage", "Close Date"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {account.opportunities.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3"><Link to={`/opportunities/${o.id}`} className="font-medium">{o.name}</Link></td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(o.amount)}</td>
                    <td className="px-4 py-3"><StageBadge stage={o.stage as any} /></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{formatDate(o.expectedCloseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "Deals" && (
        <Card>
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--ink-100)" }}>
            <span className="text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Deals</span>
            <Button size="sm" onClick={() => setModal("deal")}><Plus size={13} /> Add Deal</Button>
          </div>
          {!account.deals?.length ? (
            <EmptyState title="No deals yet" subtitle="Start tracking a deal for this account." action={<Button onClick={() => setModal("deal")}><Plus size={15} /> Create Deal</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "Amount", "Stage", "Close Date"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {account.deals.map((d) => (
                  <tr key={d.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3"><Link to={`/deals/${d.id}`} className="font-medium">{d.name}</Link></td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(d.amount)}</td>
                    <td className="px-4 py-3"><StageBadge stage={d.stage as any} /></td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{formatDate(d.closeDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === "Activity" && (
        <Card className="p-5">
          <Timeline
            activities={account.activities}
            notes={account.notes}
            assoc={{ objectType: "ACCOUNT", accountId: account.id }}
            queryKeysToInvalidate={[["account", id]]}
          />
        </Card>
      )}

      {tab === "History" && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>History</h3>
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
      {modal === "deal" && <NewDealModal accountId={account.id} accountName={account.name} onClose={() => setModal(null)} />}
      {modal === "lead" && <NewLeadModal initialCompanyName={account.name} onClose={() => setModal(null)} />}
      {modal === "task" && <NewTaskModal context={{ objectType: "ACCOUNT", accountId: account.id, label: account.name }} onClose={() => setModal(null)} />}
      {modal === "log" && <LogActivityModal context={{ objectType: "ACCOUNT", accountId: account.id, label: account.name }} onClose={() => setModal(null)} />}
    </div>
  );
}
