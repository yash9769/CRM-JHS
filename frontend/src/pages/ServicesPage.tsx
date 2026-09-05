import { useState, Fragment, type ReactElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { useColumnVisibility, ColumnFilterDropdown, type ColumnDef } from "../components/ColumnFilter";
import type { Service } from "../lib/types";
import { Plus, Pencil, Trash2, Layers } from "lucide-react";

const SERVICE_COLUMNS: ColumnDef[] = [
  { key: "name", label: "Service Name", permanent: true },
  { key: "description", label: "Description" },
  { key: "productsCount", label: "Linked Products" },
  { key: "status", label: "Status" },
  { key: "actions", label: "Actions" },
];

export function NewServiceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (service: Service) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: async () => (await api.post("/services", form)).data,
    onSuccess: (newService: Service) => {
      qc.invalidateQueries({ queryKey: ["services"] });
      if (onCreated) onCreated(newService);
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Failed to create service"),
  });

  return (
    <Modal title="Create New Service" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Service name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            style={inputStyle}
            placeholder="e.g. Cloud Security Managed Service"
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            style={inputStyle}
            placeholder="Describe what this service offering includes..."
          />
        </Field>

        {error && <p className="text-xs text-[var(--rose-600)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending || !form.name.trim()}>
            {mutation.isPending ? "Saving…" : "Create Service"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function EditServiceModal({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: service.name,
    description: service.description || "",
    active: service.active,
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.patch(`/services/${service.id}`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Failed to update service"),
  });

  return (
    <Modal title="Edit Service" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Field label="Service name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Status">
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-1">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded text-[var(--ledger-600)]"
            />
            <span>Active Service</span>
          </label>
        </Field>

        {error && <p className="text-xs text-[var(--rose-600)]">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ServicesPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);

  const { visibleKeys, toggle, showAll, reset, isVisible, orderedColumns, reorder } = useColumnVisibility(
    "services-table",
    SERVICE_COLUMNS
  );

  const { data, isLoading } = useQuery<{ data: Service[] }>({
    queryKey: ["services"],
    queryFn: async () => (await api.get("/services")).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/services/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["services"] }),
    onError: (err: any) => alert(err?.response?.data?.error || "Could not delete service"),
  });

  return (
    <div className="pb-24 md:pb-8">
      <PageHeader
        title="Services"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ColumnFilterDropdown
              columns={orderedColumns}
              visibleKeys={visibleKeys}
              onToggle={toggle}
              onShowAll={showAll}
              onReset={reset}
              onReorder={reorder}
              label="Columns"
            />
            <Button onClick={() => setShowNew(true)}>
              <Plus size={15} /> New Service
            </Button>
          </div>
        }
      />

      <div className="px-4 md:px-8 pb-8">
        <Card>
          {isLoading ? (
            <div className="p-6 text-sm text-[var(--ink-400)]">Loading services…</div>
          ) : !data?.data.length ? (
            <EmptyState
              title="No services yet"
              subtitle="Create service categories to categorize products."
              action={
                <Button onClick={() => setShowNew(true)}>
                  <Plus size={15} /> New Service
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
                      {orderedColumns.filter((col) => isVisible(col.key)).map((col) => (
                        <th key={col.key} className={`px-4 py-2.5 text-xs uppercase font-medium text-[var(--ink-400)] ${col.key === "actions" ? "text-right" : ""}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((s) => {
                      const cellRenderers: Record<string, () => ReactElement> = {
                        name: () => (
                          <td className="px-4 py-3 font-medium text-[var(--ink-900)] flex items-center gap-2">
                            <Layers size={14} className="text-[var(--ledger-600)]" />
                            {s.name}
                          </td>
                        ),
                        description: () => (
                          <td className="px-4 py-3 text-xs text-[var(--ink-600)] max-w-md truncate">
                            {s.description || "—"}
                          </td>
                        ),
                        productsCount: () => (
                          <td className="px-4 py-3 font-mono-num text-[var(--ink-700)]">
                            {s._count?.products ?? 0}
                          </td>
                        ),
                        status: () => (
                          <td className="px-4 py-3">
                            <Badge tone={s.active ? "green" : "neutral"}>
                              {s.active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                        ),
                        actions: () => (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditTarget(s)}
                                className="p-1.5 rounded hover:bg-[var(--ink-100)] text-[var(--ink-600)]"
                                title="Edit Service"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete service "${s.name}"?`)) deleteMutation.mutate(s.id);
                                }}
                                className="p-1.5 rounded hover:bg-rose-50 text-[var(--rose-600)]"
                                title="Delete Service"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        ),
                      };
                      return (
                        <tr key={s.id} className="border-b last:border-0 hover:bg-[var(--ink-50)] border-[var(--ink-100)]">
                          {orderedColumns.filter((col) => isVisible(col.key)).map((col) => (
                            <Fragment key={col.key}>{cellRenderers[col.key]?.()}</Fragment>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Card Layout */}
              <div className="md:hidden divide-y divide-[var(--ink-100)]">
                {data.data.map((s) => (
                  <div key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="font-semibold text-sm text-[var(--ink-900)] flex items-center gap-1.5">
                        <Layers size={15} className="text-[var(--ledger-600)]" />
                        {s.name}
                      </div>
                      <Badge tone={s.active ? "green" : "neutral"}>{s.active ? "Active" : "Inactive"}</Badge>
                    </div>
                    {s.description && <p className="text-xs text-[var(--ink-600)]">{s.description}</p>}
                    <div className="flex items-center justify-between pt-2 text-xs text-[var(--ink-500)]">
                      <span>{s._count?.products ?? 0} linked product(s)</span>
                      <div className="flex items-center gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setEditTarget(s)}>
                          <Pencil size={13} /> Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete service "${s.name}"?`)) deleteMutation.mutate(s.id);
                          }}
                        >
                          <Trash2 size={13} className="text-[var(--rose-600)]" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {showNew && <NewServiceModal onClose={() => setShowNew(false)} />}
      {editTarget && <EditServiceModal service={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
