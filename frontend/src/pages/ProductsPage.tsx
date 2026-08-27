import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Product } from "../lib/types";
import { Plus } from "lucide-react";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Product Name", permanent: true },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "status", label: "Status" },
];

function NewProductModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    unitPrice: "",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/products", {
        ...form,
        description: form.description || null,
        unitPrice: Number(form.unitPrice),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      onClose();
    },
  });

  return (
    <Modal title="New Product" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Field label="Product name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Cloud Security Audit"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU">
            <input
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="SKU-SEC-01"
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
              style={inputStyle}
              placeholder="Security Services"
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            style={inputStyle}
            placeholder="Detailed scope, features, or specifications..."
          />
        </Field>
        <Field label="Unit price (₹ / USD)" required>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
            className={inputClass}
            style={inputStyle}
            placeholder="50000"
          />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create Product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductsPage() {
  const [showNew, setShowNew] = useState(false);
  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "products-table",
    PRODUCT_COLUMNS
  );

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Goods and services your team sells."
        action={
          <div className="flex items-center gap-2">
            <ColumnFilterDropdown
              columns={PRODUCT_COLUMNS}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              label="Columns"
            />
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Product
            </Button>
          </div>
        }
      />
      <div className="px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No products yet"
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Product</Button>}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: "var(--ink-100)" }}>
                  {isVisible("name") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Name
                    </th>
                  )}
                  {isVisible("sku") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      SKU
                    </th>
                  )}
                  {isVisible("category") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Category
                    </th>
                  )}
                  {isVisible("description") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Description
                    </th>
                  )}
                  {isVisible("unitPrice") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Unit Price
                    </th>
                  )}
                  {isVisible("status") && (
                    <th className="px-4 py-2.5 text-xs uppercase font-medium" style={{ color: "var(--ink-400)" }}>
                      Status
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.data.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-[var(--ink-50)]" style={{ borderColor: "var(--ink-100)" }}>
                    {isVisible("name") && <td className="px-4 py-3 font-medium">{p.name}</td>}
                    {isVisible("sku") && <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{p.sku || "—"}</td>}
                    {isVisible("category") && <td className="px-4 py-3" style={{ color: "var(--ink-600)" }}>{p.category || "—"}</td>}
                    {isVisible("description") && (
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: "var(--ink-600)" }}>
                        {p.description || "—"}
                      </td>
                    )}
                    {isVisible("unitPrice") && (
                      <td className="px-4 py-3 font-mono-num">{formatCurrency(p.unitPrice, p.currency)}</td>
                    )}
                    {isVisible("status") && (
                      <td className="px-4 py-3">
                        <Badge tone={p.active ? "green" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge>
                      </td>
                    )}
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
