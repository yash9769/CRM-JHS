import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, Modal, Field, inputClass, inputStyle, Badge } from "../components/ui";
import { Timeline } from "../components/Timeline";
import { HistoryPanel } from "../components/HistoryPanel";
import { NewContactModal, NewOpportunityModal, NewAccountModal, NewLeadModal, NewTaskModal, LogActivityModal } from "../components/CreateModals";
import { EditDealModal, ArchiveConfirmModal } from "../components/EditModals";
import { formatCurrency, formatDate } from "../lib/format";
import type { Deal, Product } from "../lib/types";
import { Building2, Trash2, Plus, Trophy, XCircle, Pencil, UserPlus, CheckSquare, PhoneCall, Archive, Target, Users } from "lucide-react";

function AddLineItemModal({ dealId, onClose }: { dealId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: products } = useQuery<{ data: Product[] }>({
    queryKey: ["products", "picker"],
    queryFn: async () => (await api.get("/products", { params: { active: "true" } })).data,
  });
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [discountPct, setDiscountPct] = useState("0");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(`/deals/${dealId}/line-items`, {
        productId,
        quantity: Number(quantity),
        discountPct: Number(discountPct),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deal", dealId] });
      onClose();
    },
  });

  return (
    <Modal title="Add Product" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Product" required>
          <select required value={productId} onChange={(e) => setProductId(e.target.value)} className={inputClass} style={inputStyle}>
            <option value="">Select product…</option>
            {products?.data.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({formatCurrency(p.unitPrice)})</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" required>
            <input required type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Discount %">
            <input type="number" min="0" max="100" value={discountPct} onChange={(e) => setDiscountPct(e.target.value)} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !productId}>{mutation.isPending ? "Adding…" : "Add Product"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [stageError, setStageError] = useState("");
  const [modal, setModal] = useState<"edit" | "contact" | "opportunity" | "account" | "lead" | "task" | "log" | "archive" | null>(null);

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/deals/${id}/archive`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deals"] });
      navigate("/deals");
    },
  });

  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: ["deal", id],
    queryFn: async () => (await api.get(`/deals/${id}`)).data,
    enabled: !!id,
  });

  const stageMutation = useMutation({
    mutationFn: (stageId: string) => api.patch(`/deals/${id}`, { stageId, pipelineId: deal!.pipelineId }),
    onSuccess: () => {
      setStageError("");
      qc.invalidateQueries({ queryKey: ["deal", id] });
    },
    onError: (err: any) => setStageError(err?.response?.data?.error || "Could not update stage"),
  });

  const removeItem = useMutation({
    mutationFn: (lineItemId: string) => api.delete(`/deals/${id}/line-items/${lineItemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deal", id] }),
  });

  if (isLoading || !deal) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>;

  const isWon = deal.stage?.isClosed && deal.stage.isWon;
  const isLost = deal.stage?.isClosed && !deal.stage.isWon;
  const openStages = deal.pipeline?.stages.filter((s) => !s.isClosed) || [];
  const wonStage = deal.pipeline?.stages.find((s) => s.isClosed && s.isWon);
  const lostStage = deal.pipeline?.stages.find((s) => s.isClosed && !s.isWon);
  const primaryContact = deal.contact || (deal.contacts && deal.contacts[0]?.contact) || null;

  return (
    <div className="px-8 py-7 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <Link to={`/accounts/${deal.account?.id}`} className="flex items-center gap-1 text-xs mb-1 hover:underline" style={{ color: "var(--ink-400)" }}>
            <Building2 size={12} /> {deal.account?.name}
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{deal.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="font-mono-num text-lg font-semibold">{formatCurrency(deal.amount)}</span>
            {isWon && <Badge tone="green">Closed Won</Badge>}
            {isLost && <Badge tone="rose">Closed Lost</Badge>}
            {!deal.stage?.isClosed && <Badge>{deal.stage?.name}</Badge>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setModal("edit")}><Pencil size={14} /> Edit</Button>
          <Button variant="secondary" onClick={() => setModal("opportunity")}><Target size={14} /> Create Opportunity</Button>
          <Button variant="secondary" onClick={() => setModal("contact")}><Users size={14} /> Create Contact</Button>
          <Button variant="secondary" onClick={() => setModal("lead")}><UserPlus size={14} /> Create Lead</Button>
          <Button variant="secondary" onClick={() => setModal("task")}><CheckSquare size={14} /> Task</Button>
          <Button variant="secondary" onClick={() => setModal("log")}><PhoneCall size={14} /> Log</Button>
          <Button variant="secondary" onClick={() => setModal("archive")}><Archive size={14} /> Archive</Button>
          {!deal.stage?.isClosed && (
            <>
              <Button variant="danger" onClick={() => lostStage && stageMutation.mutate(lostStage.id)}><XCircle size={14} /> Mark Lost</Button>
              <Button onClick={() => wonStage && stageMutation.mutate(wonStage.id)}><Trophy size={14} /> Mark Won</Button>
            </>
          )}
        </div>
      </div>

      {!deal.stage?.isClosed && (
        <Card className="p-3 mb-5 flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--ink-400)" }}>Move to stage:</span>
          <select
            value={deal.stageId}
            onChange={(e) => stageMutation.mutate(e.target.value)}
            className="text-sm px-2 py-1 rounded-md border"
            style={{ borderColor: "var(--ink-200)" }}
          >
            {openStages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {stageError && <span className="text-xs" style={{ color: "var(--rose-600)" }}>{stageError}</span>}
        </Card>
      )}

      <div className="grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: "var(--ink-800)" }}>Products</h3>
              <Button size="sm" variant="secondary" onClick={() => setShowAddItem(true)}><Plus size={13} /> Add Product</Button>
            </div>
            {!deal.lineItems?.length ? (
              <div className="text-sm" style={{ color: "var(--ink-400)" }}>No products added.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                    <th className="pb-2 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Product</th>
                    <th className="pb-2 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Qty</th>
                    <th className="pb-2 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Unit Price</th>
                    <th className="pb-2 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>Total</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {deal.lineItems.map((li) => (
                    <tr key={li.id} className="border-b last:border-0" style={{ borderColor: "var(--ink-100)" }}>
                      <td className="py-2.5 font-medium">{li.product?.name || "Item"}</td>
                      <td className="py-2.5 font-mono-num">{li.quantity}</td>
                      <td className="py-2.5 font-mono-num">{formatCurrency(li.unitPrice)}</td>
                      <td className="py-2.5 font-mono-num font-semibold">{formatCurrency(li.total)}</td>
                      <td className="py-2.5">
                        <button onClick={() => removeItem.mutate(li.id)} className="p-1 hover:text-[var(--rose-600)]" style={{ color: "var(--ink-400)" }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Contacts</h3>
            {deal.contact && (
              <div className="mb-2 p-2 rounded border" style={{ borderColor: "var(--ink-100)" }}>
                <Link to={`/contacts/${deal.contact.id}`} className="font-medium text-sm text-[var(--ledger-700)]">
                  {deal.contact.firstName} {deal.contact.lastName}
                </Link>
                <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--ledger-100)] text-[var(--ledger-700)]">
                  Primary Contact
                </span>
              </div>
            )}
            {!deal.contacts?.length && !deal.contact ? (
              <div className="text-sm" style={{ color: "var(--ink-400)" }}>No contacts associated.</div>
            ) : (
              <div className="space-y-2">
                {deal.contacts?.filter(c => c.contact.id !== deal.contactId).map(({ contact: c }) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded" style={{ background: "var(--ink-50)" }}>
                    <div>
                      <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                      <div className="text-xs" style={{ color: "var(--ink-400)" }}>{c.jobTitle || c.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Details</h3>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between"><dt style={{ color: "var(--ink-400)" }}>Pipeline</dt><dd>{deal.pipeline?.name}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--ink-400)" }}>Stage</dt><dd>{deal.stage?.name}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--ink-400)" }}>Close date</dt><dd>{formatDate(deal.closeDate)}</dd></div>
              <div className="flex justify-between"><dt style={{ color: "var(--ink-400)" }}>Owner</dt><dd>{deal.owner?.firstName} {deal.owner?.lastName}</dd></div>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>Activity</h3>
            <Timeline
              activities={deal.activities}
              notes={deal.notes}
              assoc={{ objectType: "DEAL", dealId: deal.id }}
              queryKeysToInvalidate={[["deal", id]]}
            />
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--ink-800)" }}>History</h3>
            <HistoryPanel objectType="DEAL" recordId={deal.id} />
          </Card>
        </div>
      </div>

      {showAddItem && <AddLineItemModal dealId={deal.id} onClose={() => setShowAddItem(false)} />}
      {modal === "edit" && <EditDealModal deal={deal} onClose={() => setModal(null)} />}
      {modal === "contact" && <NewContactModal accountId={deal.accountId} accountName={deal.account?.name} onClose={() => setModal(null)} />}
      {modal === "opportunity" && (
        <NewOpportunityModal
          accountId={deal.accountId}
          accountName={deal.account?.name}
          contactId={deal.contactId || primaryContact?.id}
          contactName={primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : undefined}
          initialName={`${deal.name} — Opp`}
          initialAmount={deal.amount}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "account" && <NewAccountModal onClose={() => setModal(null)} />}
      {modal === "lead" && <NewLeadModal initialCompanyName={deal.account?.name} onClose={() => setModal(null)} />}
      {modal === "task" && <NewTaskModal context={{ objectType: "DEAL", dealId: deal.id, label: deal.name }} onClose={() => setModal(null)} />}
      {modal === "log" && <LogActivityModal context={{ objectType: "DEAL", dealId: deal.id, label: deal.name }} onClose={() => setModal(null)} />}
      {modal === "archive" && (
        <ArchiveConfirmModal
          title={deal.name}
          isPending={archiveMutation.isPending}
          onConfirm={() => archiveMutation.mutate()}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
