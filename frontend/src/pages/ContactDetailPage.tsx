import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient as useQC2 } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, BackButton } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { NewOpportunityModal } from "../components/CreateModals";
import { EditContactModal, ArchiveConfirmModal } from "../components/EditModals";
import { initials } from "../lib/format";
import type { Contact } from "../lib/types";
import { Mail, Phone, Link2, Building2, Target, Pencil, Archive } from "lucide-react";

export default function ContactDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qcArchive = useQC2();
  const [modal, setModal] = useState<"opportunity" | "edit" | "archive" | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/contacts/${id}/archive`),
    onSuccess: () => { qcArchive.invalidateQueries({ queryKey: ["contacts"] }); navigate("/contacts"); },
  });

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["contact", id],
    queryFn: async () => (await api.get(`/contacts/${id}`)).data,
    enabled: !!id,
  });

  if (isLoading || !contact) return <div className="p-8 text-sm text-[var(--ink-400)]">Loading…</div>;
  const contactLabel = `${contact.firstName} ${contact.lastName}`;

  return (
    <div className="px-4 md:px-8 py-5 md:py-7 max-w-6xl mx-auto space-y-5 pb-24 md:pb-8">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton />
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white bg-[var(--ink-600)]">
            {initials(contact.firstName, contact.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[var(--ink-900)]">{contact.firstName} {contact.lastName}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--ink-500)]">
              {contact.jobTitle && <span>{contact.jobTitle}</span>}
              {contact.account && (
                <Link to={`/accounts/${contact.account.id}`} className="flex items-center gap-1 text-[var(--ledger-700)] hover:underline">
                  <Building2 size={13} /> {contact.account.name}
                </Link>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
          <Button variant="secondary" onClick={() => setModal("opportunity")}><Target size={14} /> Create Opportunity</Button>
          <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-4 md:p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">Contact information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2"><Mail size={14} className="text-[var(--ink-400)]" /> {contact.email || "—"}</div>
            <div className="flex items-center gap-2"><Phone size={14} className="text-[var(--ink-400)]" /> {contact.phone || "—"}</div>
            {contact.linkedinUrl && <div className="flex items-center gap-2"><Link2 size={14} className="text-[var(--ink-400)]" /> {contact.linkedinUrl}</div>}
          </div>
        </Card>

        <Card className="p-4 md:p-5">
          <h3 className="text-sm font-semibold mb-4 text-[var(--ink-800)]">Activity</h3>
          <Timeline
            activities={contact.activities}
            notes={contact.notes}
            assoc={{ objectType: "CONTACT", contactId: contact.id }}
            queryKeysToInvalidate={[["contact", id]]}
          />
        </Card>
      </div>

      {modal === "edit" && <EditContactModal contact={contact} onClose={() => setModal(null)} />}
      {modal === "archive" && (
        <ArchiveConfirmModal
          title={`${contact.firstName} ${contact.lastName}`}
          isPending={archiveMutation.isPending}
          onConfirm={() => archiveMutation.mutate()}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "opportunity" && (
        <NewOpportunityModal
          accountId={contact.account?.id}
          accountName={contact.account?.name}
          contactId={contact.id}
          contactName={contactLabel}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
