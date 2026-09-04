import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatCurrency, formatDate } from "../lib/format";
import { downloadCsvExport } from "../lib/exportCsv";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import { Plus, FileText, Send, CheckCircle, XCircle, Download, Copy } from "lucide-react";

const statusConfig: Record<string, { label: string; tone: "neutral" | "green" | "amber" | "rose"; icon: any }> = {
  DRAFT:    { label: "Draft",    tone: "neutral", icon: FileText },
  SENT:     { label: "Sent",     tone: "amber",   icon: Send },
  VIEWED:   { label: "Viewed",   tone: "amber",   icon: Send },
  ACCEPTED: { label: "Accepted", tone: "green",   icon: CheckCircle },
  REJECTED: { label: "Rejected", tone: "rose",    icon: XCircle },
  EXPIRED:  { label: "Expired",  tone: "rose",    icon: XCircle },
};

const QUOTE_COLUMNS: ColumnDef[] = [
  { key: "quoteNumber", label: "Quote #", permanent: true },
  { key: "opportunity", label: "Opportunity" },
  { key: "account", label: "Account" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
  { key: "expires", label: "Expires" },
  { key: "actions", label: "Actions", permanent: true },
];

function NewQuoteModalPage({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [opportunityId, setOpportunityId] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [taxPct, setTaxPct] = useState("0");

  const { data: opps } = useQuery<any>({
    queryKey: ["opportunities", "picker"],
    queryFn: async () => (await api.get("/opportunities", { params: { pageSize: 100 } })).data,
  });

  const selectedOpp = opps?.data?.find((o: any) => o.id === opportunityId);

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/quotes", {
        opportunityId,
        accountId: selectedOpp?.accountId,
        expirationDate: expirationDate || undefined,
        discountPct: Number(discountPct),
        taxPct: Number(taxPct),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotes"] });
      onClose();
    },
  });

  return (
    <Modal title="New Quote" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (opportunityId) mutation.mutate();
        }}
      >
        <Field label="Opportunity" required>
          <select
            required
            value={opportunityId}
            onChange={(e) => setOpportunityId(e.target.value)}
            className={inputClass}
            style={inputStyle}
          >
            <option value="">Select opportunity…</option>
            {opps?.data?.map((o: any) => (
              <option key={o.id} value={o.id}>
                {o.name} — {formatCurrency(o.amount)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Discount %">
            <input
              type="number"
              min="0"
              max="100"
              value={discountPct}
              onChange={(e) => setDiscountPct(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Tax %">
            <input
              type="number"
              min="0"
              max="100"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>
        <Field label="Expiration date">
          <input
            type="date"
            value={expirationDate}
            onChange={(e) => setExpirationDate(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        {mutation.isError && (
          <div className="text-sm mb-3 text-[var(--rose-600)]">
            {(mutation.error as any)?.response?.data?.error || "Could not create quote."}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || !opportunityId}>
            {mutation.isPending ? "Creating…" : "Create Quote"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function QuotesPage() {
  const [showNew, setShowNew] = useState(false);
  const qc = useQueryClient();

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "quotes-table",
    QUOTE_COLUMNS
  );

  const { data, isLoading } = useQuery<any>({
    queryKey: ["quotes"],
    queryFn: async () => (await api.get("/quotes", { params: { pageSize: 50 } })).data,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/quotes/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/quotes/${id}/duplicate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }),
  });

  async function exportCsv() {
    await downloadCsvExport("/quotes/export", {}, "quotes.csv");
  }

  async function downloadPdf(id: string, quoteNumber: string) {
    const res = await api.get(`/quotes/${id}/pdf`, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${quoteNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Quotes"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnFilterDropdown
              columns={QUOTE_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button variant="secondary" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </Button>
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Quote
            </Button>
          </div>
        }
      />
      <div className="px-4 md:px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading…</div>
          ) : !data?.data?.length ? (
            <EmptyState
              title="No quotes yet"
              subtitle="Create a quote from an opportunity to send a formal price proposal."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Quote</Button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-[var(--ink-100)]">
                    {isVisible("quoteNumber") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Quote #
                      </th>
                    )}
                    {isVisible("opportunity") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Opportunity
                      </th>
                    )}
                    {isVisible("account") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Account
                      </th>
                    )}
                    {isVisible("amount") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Amount
                      </th>
                    )}
                    {isVisible("status") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Status
                      </th>
                    )}
                    {isVisible("expires") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Expires
                      </th>
                    )}
                    {isVisible("actions") && (
                      <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((q: any) => {
                    const sc = statusConfig[q.status] || statusConfig.DRAFT;
                    return (
                      <tr key={q.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        {isVisible("quoteNumber") && (
                          <td className="px-4 py-3 font-mono-num font-medium">{q.quoteNumber}</td>
                        )}
                        {isVisible("opportunity") && (
                          <td className="px-4 py-3">
                            <span className="font-medium text-[var(--ledger-700)]">
                              {q.opportunity?.name || "—"}
                            </span>
                          </td>
                        )}
                        {isVisible("account") && (
                          <td className="px-4 py-3 text-[var(--ink-600)]">{q.account?.name || "—"}</td>
                        )}
                        {isVisible("amount") && (
                          <td className="px-4 py-3 font-mono-num font-medium">{formatCurrency(q.amount)}</td>
                        )}
                        {isVisible("status") && (
                          <td className="px-4 py-3"><Badge tone={sc.tone}>{sc.label}</Badge></td>
                        )}
                        {isVisible("expires") && (
                          <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(q.expirationDate)}</td>
                        )}
                        {isVisible("actions") && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <Button size="sm" variant="secondary" onClick={() => downloadPdf(q.id, q.quoteNumber)}>
                                <Download size={12} /> PDF
                              </Button>
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
                              <Button size="sm" variant="secondary" onClick={() => duplicateMutation.mutate(q.id)} disabled={duplicateMutation.isPending}>
                                <Copy size={12} /> Duplicate
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      {showNew && <NewQuoteModalPage onClose={() => setShowNew(false)} />}
    </div>
  );
}
