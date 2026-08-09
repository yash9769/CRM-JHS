import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, StageBadge } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { formatCurrency, initials } from "../lib/format";
import type { Contact } from "../lib/types";
import { Mail, Phone, Link2, Building2 } from "lucide-react";

export default function ContactDetailPage() {
  const { id } = useParams();
  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["contact", id],
    queryFn: async () => (await api.get(`/contacts/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !contact) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>;

  return (
    <div className="px-8 py-7 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white" style={{ background: "var(--ink-600)" }}>
          {initials(contact.firstName, contact.lastName)}
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{contact.firstName} {contact.lastName}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
            {contact.jobTitle && <span>{contact.jobTitle}</span>}
            {contact.account && (
              <Link to={`/accounts/${contact.account.id}`} className="flex items-center gap-1" style={{ color: "var(--ledger-700)" }}>
                <Building2 size={13} /> {contact.account.name}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5">
        <Card className="p-5 col-span-2">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Contact information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail size={14} style={{ color: "var(--ink-400)" }} /> {contact.email || "—"}</div>
            <div className="flex items-center gap-2"><Phone size={14} style={{ color: "var(--ink-400)" }} /> {contact.phone || "—"}</div>
            {contact.linkedinUrl && <div className="flex items-center gap-2"><Link2 size={14} style={{ color: "var(--ink-400)" }} /> {contact.linkedinUrl}</div>}
          </div>

          <div className="mt-6">
            <h4 className="text-xs uppercase font-medium mb-2" style={{ color: "var(--ink-400)" }}>Opportunities</h4>
            {!contact.opportunityContacts?.length ? (
              <div className="text-sm" style={{ color: "var(--ink-400)" }}>None yet</div>
            ) : (
              <div className="space-y-2">
                {contact.opportunityContacts.map(({ opportunity: o }) => (
                  <Link key={o.id} to={`/opportunities/${o.id}`} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--ink-50)]" style={{ border: "1px solid var(--ink-100)" }}>
                    <span className="font-medium text-sm">{o.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-sm">{formatCurrency(o.amount)}</span>
                      <StageBadge stage={o.stage as any} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5">
            <h4 className="text-xs uppercase font-medium mb-2" style={{ color: "var(--ink-400)" }}>Deals</h4>
            {!contact.dealContacts?.length ? (
              <div className="text-sm" style={{ color: "var(--ink-400)" }}>None yet</div>
            ) : (
              <div className="space-y-2">
                {contact.dealContacts.map(({ deal: d }) => (
                  <Link key={d.id} to={`/deals/${d.id}`} className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-[var(--ink-50)]" style={{ border: "1px solid var(--ink-100)" }}>
                    <span className="font-medium text-sm">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono-num text-sm">{formatCurrency(d.amount)}</span>
                      <StageBadge stage={d.stage as any} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--ink-800)" }}>Activity</h3>
          <Timeline
            activities={contact.activities}
            notes={contact.notes}
            assoc={{ objectType: "CONTACT", contactId: contact.id }}
            queryKeysToInvalidate={[["contact", id]]}
          />
        </Card>
      </div>
    </div>
  );
}
