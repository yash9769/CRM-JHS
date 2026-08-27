import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { formatCurrency } from "../lib/format";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import { useAuth } from "../hooks/useAuth";
import { NewServiceModal } from "./ServicesPage";
import type { Product, Service } from "../lib/types";
import { Plus, Pencil, Layers, Info } from "lucide-react";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Product Name", permanent: true },
  { key: "service", label: "Service" },
  { key: "sku", label: "SKU" },
  { key: "category", label: "Category" },
  { key: "description", label: "Description" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

function NewProductModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showNewService, setShowNewService] = useState(false);

  const [form, setForm] = useState({
    name: "",
    serviceId: "",
    sku: "",
    category: "",
    description: "",
    unitPrice: "",
  });

  const { data: servicesData } = useQuery<{ data: Service[] }>({
    queryKey: ["services"],
    queryFn: async () => (await api.get("/services")).data,
  });
  const services = servicesData?.data || [];

  // Permission check for unit price: allowed for SENIOR_PARTNER, PARTNER, MANAGER
  const canEditUnitPrice = ["SENIOR_PARTNER", "PARTNER", "MANAGER"].includes(user?.orgRole || "MANAGER");

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
    <>
      <Modal title="New Product" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
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

          {/* Service Dropdown + Inline Creator */}
          <Field label="Service Category" required>
            <div className="flex gap-2">
              <select
                required
                value={form.serviceId}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— Select Service —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNewService(true)}
                className="shrink-0 text-xs"
              >
                <Plus size={13} /> New Service
              </Button>
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <div className="relative">
              <input
                required
                disabled={!canEditUnitPrice}
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className={`${inputClass} ${!canEditUnitPrice ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""}`}
                style={inputStyle}
                placeholder="50000"
              />
              {!canEditUnitPrice && (
                <p className="text-2xs text-[var(--ink-500)] flex items-center gap-1 mt-1">
                  <Info size={12} /> Unit price editing is restricted to Senior Partner, Partner, and Manager roles.
                </p>
              )}
            </div>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !form.serviceId}>
              {mutation.isPending ? "Creating…" : "Create Product"}
            </Button>
          </div>
        </form>
      </Modal>

      {showNewService && (
        <NewServiceModal
          onClose={() => setShowNewService(false)}
          onCreated={(created) => setForm((prev) => ({ ...prev, serviceId: created.id }))}
        />
      )}
    </>
  );
}

function EditProductModal({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showNewService, setShowNewService] = useState(false);

  const [form, setForm] = useState({
    name: product.name,
    serviceId: product.serviceId,
    sku: product.sku || "",
    category: product.category || "",
    description: product.description || "",
    unitPrice: String(product.unitPrice),
    active: product.active,
  });

  const { data: servicesData } = useQuery<{ data: Service[] }>({
    queryKey: ["services"],
    queryFn: async () => (await api.get("/services")).data,
  });
  const services = servicesData?.data || [];

  const canEditUnitPrice = ["SENIOR_PARTNER", "PARTNER", "MANAGER"].includes(user?.orgRole || "MANAGER");

  const mutation = useMutation({
    mutationFn: () =>
      api.patch(`/products/${product.id}`, {
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
    <>
      <Modal title="Edit Product" onClose={onClose}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-4"
        >
          <Field label="Product name" required>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              style={inputStyle}
            />
          </Field>

          <Field label="Service Category" required>
            <div className="flex gap-2">
              <select
                required
                value={form.serviceId}
                onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">— Select Service —</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowNewService(true)}
                className="shrink-0 text-xs"
              >
                <Plus size={13} /> New Service
              </Button>
            </div>
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="SKU">
              <input
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className={inputClass}
                style={inputStyle}
              />
            </Field>
            <Field label="Category">
              <input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className={inputClass}
                style={inputStyle}
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
            />
          </Field>

          <Field label="Unit price (₹ / USD)" required>
            <div className="relative">
              <input
                required
                disabled={!canEditUnitPrice}
                type="number"
                min="0"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
                className={`${inputClass} ${!canEditUnitPrice ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""}`}
                style={inputStyle}
              />
              {!canEditUnitPrice && (
                <p className="text-2xs text-[var(--ink-500)] flex items-center gap-1 mt-1">
                  <Info size={12} /> Unit price editing is restricted to Senior Partner, Partner, and Manager roles.
                </p>
              )}
            </div>
          </Field>

          <Field label="Status">
            <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="rounded text-[var(--ledger-600)]"
              />
              <span>Active Product</span>
            </label>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {showNewService && (
        <NewServiceModal
          onClose={() => setShowNewService(false)}
          onCreated={(created) => setForm((prev) => ({ ...prev, serviceId: created.id }))}
        />
      )}
    </>
  );
}

export default function ProductsPage() {
  const [showNew, setShowNew] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const { visibleKeys, toggle, showAll, reset, isVisible } = useColumnVisibility(
    "products-table",
    PRODUCT_COLUMNS
  );

  const { data, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["products"],
    queryFn: async () => (await api.get("/products")).data,
  });

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Products"
        subtitle="Goods and service packages your team sells."
        action={
          <div className="flex flex-wrap items-center gap-2">
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

      <div className="px-4 md:px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading products…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No products yet"
              action={
                <Button onClick={() => setShowNew(true)}>
                  <Plus size={15} /> New Product
                </Button>
              }
            />
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-[var(--ink-100)]">
                      {isVisible("name") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Name
                        </th>
                      )}
                      {isVisible("service") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Service
                        </th>
                      )}
                      {isVisible("sku") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          SKU
                        </th>
                      )}
                      {isVisible("category") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Category
                        </th>
                      )}
                      {isVisible("description") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Description
                        </th>
                      )}
                      {isVisible("unitPrice") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Unit Price
                        </th>
                      )}
                      {isVisible("status") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)]">
                          Status
                        </th>
                      )}
                      {isVisible("actions") && (
                        <th className="px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)] text-right">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                        {isVisible("name") && <td className="px-4 py-3 font-medium text-[var(--ink-900)]">{p.name}</td>}
                        {isVisible("service") && (
                          <td className="px-4 py-3 text-xs">
                            {p.service ? (
                              <span className="inline-flex items-center gap-1 font-medium text-[var(--ledger-700)] bg-[var(--ledger-50)] px-2 py-0.5 rounded-md">
                                <Layers size={12} /> {p.service.name}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        )}
                        {isVisible("sku") && <td className="px-4 py-3 text-[var(--ink-600)]">{p.sku || "—"}</td>}
                        {isVisible("category") && <td className="px-4 py-3 text-[var(--ink-600)]">{p.category || "—"}</td>}
                        {isVisible("description") && (
                          <td className="px-4 py-3 text-xs max-w-xs truncate text-[var(--ink-600)]">
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
                        {isVisible("actions") && (
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => setEditProduct(p)}
                              className="p-1.5 rounded hover:bg-[var(--ink-100)] text-[var(--ink-600)]"
                              title="Edit Product"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card View */}
              <div className="md:hidden divide-y divide-[var(--ink-100)]">
                {data.data.map((p) => (
                  <div key={p.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm text-[var(--ink-900)]">{p.name}</div>
                        {p.service && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--ledger-700)] mt-0.5">
                            <Layers size={12} /> {p.service.name}
                          </span>
                        )}
                      </div>
                      <Badge tone={p.active ? "green" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {p.description && <p className="text-xs text-[var(--ink-600)]">{p.description}</p>}
                    <div className="flex items-center justify-between pt-2 text-xs">
                      <span className="font-mono-num font-bold text-[var(--ink-900)]">{formatCurrency(p.unitPrice, p.currency)}</span>
                      <Button variant="secondary" size="sm" onClick={() => setEditProduct(p)}>
                        <Pencil size={13} /> Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {showNew && <NewProductModal onClose={() => setShowNew(false)} />}
      {editProduct && <EditProductModal product={editProduct} onClose={() => setEditProduct(null)} />}
    </div>
  );
}
