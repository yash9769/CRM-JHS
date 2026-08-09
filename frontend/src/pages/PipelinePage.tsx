import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Button, Modal, Field, inputClass, inputStyle } from "../components/ui";
import { KanbanBoard } from "../components/Kanban";
import type { Opportunity, Pipeline, Account, Paginated, Owner } from "../lib/types";
import { Plus } from "lucide-react";

function NewOpportunityModal({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: accounts } = useQuery<Paginated<Account>>({ queryKey: ["accounts", "picker"], queryFn: async () => (await api.get("/accounts", { params: { pageSize: 100 } })).data });
  const { data: users } = useQuery<{ data: Owner[] }>({ queryKey: ["users"], queryFn: async () => (await api.get("/users")).data });
  const [form, setForm] = useState({ name: "", accountId: "", amount: "", ownerId: "", stageId: pipeline.stages[0]?.id || "" });

  const mutation = useMutation({
    mutationFn: () => api.post("/opportunities", { ...form, amount: Number(form.amount), pipelineId: pipeline.id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); onClose(); },
  });

  return (
    <Modal title="New Opportunity" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Opportunity name" required>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} style={inputStyle} placeholder="CRM Implementation" />
        </Field>
        <Field label="Account" required>
          <select required value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className={inputClass} style={inputStyle}>
            <option value="">Select account…</option>
            {accounts?.data.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" required>
            <input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} style={inputStyle} placeholder="120000" />
          </Field>
          <Field label="Stage">
            <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className={inputClass} style={inputStyle}>
              {pipeline.stages.filter((s) => !s.isClosed).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Owner" required>
          <select required value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className={inputClass} style={inputStyle}>
            <option value="">Select owner…</option>
            {users?.data.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
          </select>
        </Field>
        {mutation.isError && <div className="text-sm mb-3" style={{ color: "var(--rose-600)" }}>Could not create opportunity.</div>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Creating…" : "Create Opportunity"}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function PipelinePage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const { data: pipelines } = useQuery<{ data: Pipeline[] }>({ queryKey: ["pipelines", "OPPORTUNITY"], queryFn: async () => (await api.get("/pipelines", { params: { type: "OPPORTUNITY" } })).data });
  const pipeline = pipelines?.data[0];

  const { data: opps } = useQuery<Paginated<Opportunity>>({
    queryKey: ["opportunities", "kanban", pipeline?.id],
    queryFn: async () => (await api.get("/opportunities", { params: { pipelineId: pipeline!.id, isConverted: false, pageSize: 100 } })).data,
    enabled: !!pipeline,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, stageId }: { id: string; stageId: string }) => api.patch(`/opportunities/${id}`, { stageId, pipelineId: pipeline!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunities", "kanban"] }),
  });

  if (!pipeline) return <div className="p-8 text-sm" style={{ color: "var(--ink-400)" }}>Loading pipeline…</div>;

  return (
    <div>
      <PageHeader title="Sales Pipeline" subtitle="Drag opportunities between stages as deals progress." action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Opportunity</Button>} />
      <div className="px-8 pb-8">
        <KanbanBoard
          stages={pipeline.stages}
          items={opps?.data || []}
          basePath="/opportunities"
          onMove={(item, stageId) => moveMutation.mutate({ id: item.id, stageId })}
        />
      </div>
      {showNew && <NewOpportunityModal pipeline={pipeline} onClose={() => setShowNew(false)} />}
    </div>
  );
}
