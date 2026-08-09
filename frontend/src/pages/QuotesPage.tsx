import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatCurrency, formatDate } from "../lib/format";
import { Plus, FileText, Send, CheckCircle, XCircle } from "lucide-react";

const statusConfig: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "rose"; icon: any }> = {
  DRAFT:    { label: "Draft",    tone: "neutral", icon: FileText },
  SENT:     { label: "Sent",     tone: "amber",   icon: Send },
  VIEWED:   { label: "Viewed",   tone: "amber",   icon: Send },
  ACCEPTED: { label: "Accepted", tone: "green",   icon: CheckCircle },
  REJECTED: { label: "Rejected", tone: "rose",    icon: XCircle },
  EXPIRED:  { label: "Expired",  tone: "rose",    icon: XCircle },
};

function NewQuoteModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [dealId, setDealId] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [taxPct, setTaxPct] = useState("0");

  const { data: deals } = useQuery<any>({
    queryKey: ["deals", "picker"],
    queryFn: async () => (await api.get("/deals", { params: { pageSize: 100 } })).data,
  });

  const selectedDeal = deals?.data?.find((d: any) => d.id === dealId);

  const mutation = useMutation({
    mutationFn: () => api.post("/quotes", {
      dealId,
      accountId: selectedDeal?.accountId,
      expirationDate: expirationDate || undefined,
      discountPct: Number(discountPct),
      taxPct: Number(taxPct),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); onClose(); },
  });

  return (
    <Modal title="New Quote" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (dealId) mutation.mutate(); }}>
        <Field label="Deal" required>
          <select required value={dealId} onChange={(e) => setDealId(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">Select deal…</option>
            {deals?.data?.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name} — {formatCurrency(d.amount)}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount %">
            <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Tax %">
            <input type="number" min="0" max="100" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <Field label="Expiration date">
          <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={inputClass} style={inputStyle} />
        </Field>
        {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>{(mutation.error as any)?.response?.data?.error || "Could not create quote."}</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !dealId}>{mutation.isPending ? "Creating…" : "Create Quote"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function QuotesPage() {
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["quotes"],
    queryFn: async () => (await api.get("/quotes", { params: { pageSize: 50 } })).data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/quotes/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  return (
    <div>
      <PageHeader
        title="Quotes"
        subtitle="Formal price proposals linked to deals."
        action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Quote</Button>}
      />
      <div className="px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data?.length ? (
            <EmptyState
              title="No quotes yet"
              subtitle="Create a quote from a deal to send a formal price proposal."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Quote</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {["Quote #", "Deal", "Account", "Amount", "Status", "Expires", "Actions"].map(h => (
                    <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((q: any) => {
                  const sc = statusConfig[q.status] || statusConfig.DRAFT;
                  return (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                      <td className="px-4 py-3 font-mono-num font-medium">{q.quoteNumber}</td>
                      <td className="px-4 py-3">
                        <Link to={`/deals/${q.deal?.id}`} className="hover:underline" style={{ color: "var(--ledger-700)" }}>
                          {q.deal?.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{q.account?.name}</td>
                      <td className="px-4 py-3 font-mono-num font-medium">{formatCurrency(q.amount)}</td>
                      <td className="px-4 py-3"><Badge tone={sc.tone}>{sc.label}</Badge></td>
                      <td className="px-4 py-3" style={{ color: "var(--ink-500)" }}>{formatDate(q.expirationDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {q.status === "DRAFT" && (
                            <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: q.id, status: "SENT" })}>
                              <Send size={12} /> Send
                            </Button>
                          )}
                          {q.status === "SENT" && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => updateStatus.mutate({ id: q.id, status: "ACCEPTED" })}>
                                <CheckCircle size={12} /> Accept
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => updateStatus.mutate({ id: q.id, status: "REJECTED" })}>
                                <XCircle size={12} /> Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewQuoteModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
