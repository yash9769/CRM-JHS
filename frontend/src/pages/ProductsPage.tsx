import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatCurrency } from "../lib/format";
import type { Product } from "../lib/types";
import { Plus } from "lucide-react";

function NewProductModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", sku: "", category: "", unitPrice: "" });
  const mutation = useMutation({
    mutationFn: () => api.post("/products", { ...form, unitPrice: Number(form.unitPrice) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products"] }); onClose(); },
  });
  return (
    <Modal title="New Product" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Product name" required>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
          <Field label="Category">
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} style={inputStyle} />
          </Field>
        </div>
        <Field label="Unit price" required>
          <input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} className={inputClass} style={inputStyle} />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Product"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const [showNew, setShowNew] = useState(false);
  const { data, isLoading } = useQuery<{ data: Product[] }>({ queryKey: ["products"], queryFn: async () => (await api.get("/products")).data });

  return (
    <div>
      <PageHeader title="Products" subtitle="Goods and services your team sells." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Product</Button>} />
      <div className="px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState title="No products yet" action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Product</Button>} />
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                {["Name", "SKU", "Category", "Unit Price", "Status"].map((h) => <th key={h} className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{p.sku || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{p.category || "—"}</td>
                    <td className="px-4 py-3 font-mono-num">{formatCurrency(p.unitPrice, p.currency)}</td>
                    <td className="px-4 py-3"><Badge tone={p.active ? "green" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
      {showNew && <NewProductModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
