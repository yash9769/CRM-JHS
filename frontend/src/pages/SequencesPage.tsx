import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { PageHeader, Card, Button, Badge, Modal, Field, inputClass, inputStyle, EmptyState } from "../components/ui";
import { Plus, Mail, Phone, CheckSquare, Clock, Users, ChevronRight, Trash2 } from "lucide-react";

const stepIcons: Record<string, any> = {
  EMAIL: Mail,
  CALL_REMINDER: Phone,
  TASK: CheckSquare,
  WAIT: Clock,
};

const stepColors: Record<string, string> = {
  EMAIL: "var(--ledger-100)",
  CALL_REMINDER: "var(--amber-100)",
  TASK: "var(--ink-100)",
  WAIT: "var(--rose-100)",
};

const stepTextColors: Record<string, string> = {
  EMAIL: "var(--ledger-700)",
  CALL_REMINDER: "var(--amber-600)",
  TASK: "var(--ink-600)",
  WAIT: "var(--rose-600)",
};

function NewSequenceModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const mutation = useMutation({
    mutationFn: () => api.post("/sequences", { name, description }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequences"] }); onClose(); },
  });
  return (
    <Modal title="New Sequence" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <Field label="Sequence name" required>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} placeholder="Outbound Prospecting Sequence" />
        </Field>
        <Field label="Description">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} style={inputStyle} placeholder="What is this sequence for?" />
        </Field>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || !name}>{mutation.isPending ? "Creating…" : "Create Sequence"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SequenceDetailModal({ sequence, onClose }: { sequence: any; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery<any>({
    queryKey: ["sequence", sequence.id],
    queryFn: async () => (await api.get(`/sequences/${sequence.id}`)).data,
  });

  const [stepType, setStepType] = useState("EMAIL");
  const [stepDelay, setStepDelay] = useState("0");
  const [stepSubject, setStepSubject] = useState("");

  const addStep = useMutation({
    mutationFn: () => api.post(`/sequences/${sequence.id}/steps`, {
      order: (data?.steps?.length || 0) + 1,
      type: stepType,
      config: { subject: stepSubject, delayDays: Number(stepDelay) },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sequence", sequence.id] }); setStepSubject(""); },
  });

  const deleteStep = useMutation({
    mutationFn: (stepId: string) => api.delete(`/sequences/${sequence.id}/steps/${stepId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sequence", sequence.id] }),
  });

  const steps = data?.steps || [];
  const enrollments = data?.enrollments || [];

  return (
    <Modal title={sequence.name} onClose={onClose} width="640px">
      <div className="space-y-5">
        <div>
          <h4 className="text-xs uppercase font-semibold mb-3" style={{ color: "var(--ink-400)" }}>Steps</h4>
          {steps.length === 0 ? (
            <div className="text-sm py-3 text-center" style={{ color: "var(--ink-400)" }}>No steps yet. Add one below.</div>
          ) : (
            <div className="space-y-2 mb-4">
              {steps.map((step: any, i: number) => {
                const Icon = stepIcons[step.type] || Mail;
                return (
                  <div key={step.id} className="flex items-center gap-2.5 p-2.5 rounded-lg" style={{ background: "var(--ink-50)" }}>
                    <div className="w-6 h-6 rounded text-xs font-mono-num font-semibold flex items-center justify-center shrink-0" style={{ background: "var(--ink-200)" }}>
                      {i + 1}
                    </div>
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: stepColors[step.type] }}>
                      <Icon size={13} style={{ color: stepTextColors[step.type] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{step.type.replace("_", " ")}</div>
                      {step.config?.subject && <div className="text-xs truncate" style={{ color: "var(--ink-500)" }}>{step.config.subject}</div>}
                      {step.config?.delayDays > 0 && <div className="text-xs" style={{ color: "var(--ink-400)" }}>After {step.config.delayDays} day{step.config.delayDays !== 1 ? "s" : ""}</div>}
                    </div>
                    <button onClick={() => deleteStep.mutate(step.id)}><Trash2 size={13} style={{ color: "var(--ink-400)" }} /></button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="p-3 rounded-lg" style={{ background: "var(--ink-50)" }}>
            <div className="text-xs font-medium mb-2" style={{ color: "var(--ink-600)" }}>Add step</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <select value={stepType} onChange={(e) => setStepType(e.target.value)} className={`${inputClass} text-xs`} style={inputStyle}>
                <option value="EMAIL">Email</option>
                <option value="CALL_REMINDER">Call reminder</option>
                <option value="TASK">Task</option>
                <option value="WAIT">Wait</option>
              </select>
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" value={stepDelay} onChange={(e) => setStepDelay(e.target.value)} className={`${inputClass} text-xs`} style={inputStyle} />
                <span className="text-xs whitespace-nowrap" style={{ color: "var(--ink-500)" }}>day delay</span>
              </div>
            </div>
            {stepType === "EMAIL" && (
              <input value={stepSubject} onChange={(e) => setStepSubject(e.target.value)} placeholder="Email subject…" className={`${inputClass} mb-2 text-xs`} style={inputStyle} />
            )}
            <Button size="sm" onClick={() => addStep.mutate()} disabled={addStep.isPending}><Plus size={12} /> Add step</Button>
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase font-semibold mb-2" style={{ color: "var(--ink-400)" }}>Enrolled contacts ({enrollments.length})</h4>
          {enrollments.length === 0 ? (
            <div className="text-sm" style={{ color: "var(--ink-400)" }}>No contacts enrolled. Enroll from a Contact's detail page.</div>
          ) : (
            <div className="space-y-1.5">
              {enrollments.slice(0, 8).map((e: any) => (
                <div key={e.id} className="flex items-center justify-between text-sm px-3 py-2 rounded-md" style={{ background: "var(--ink-50)" }}>
                  <span>{e.contact.firstName} {e.contact.lastName}</span>
                  <Badge tone={e.status === "ACTIVE" ? "green" : "neutral"}>{e.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function SequencesPage() {
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["sequences"],
    queryFn: async () => (await api.get("/sequences")).data,
  });

  return (
    <div>
      <PageHeader
        title="Sequences"
        action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Sequence</Button>}
      />
      <div className="px-8 pb-8">
        {isLoading ? (
          <div className="text-sm" style={{ color: "var(--ink-400)" }}>Loading…</div>
        ) : !data?.data?.length ? (
          <Card>
            <EmptyState
              title="No sequences yet"
              subtitle="Build a sequence to automate your outreach across email, calls, and tasks."
              action={<Button onClick={() => setShowNew(true)}><Plus size={15} /> New Sequence</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {data.data.map((seq: any) => (
              <div key={seq.id} onClick={() => setSelected(seq)}>
              <Card className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-sm">{seq.name}</h3>
                  <ChevronRight size={15} style={{ color: "var(--ink-400)" }} />
                </div>
                {seq.description && <p className="text-xs mb-3" style={{ color: "var(--ink-500)" }}>{seq.description}</p>}
                <div className="flex items-center gap-4 text-xs" style={{ color: "var(--ink-400)" }}>
                  <span className="flex items-center gap-1"><CheckSquare size={12} /> {seq.steps?.length || 0} steps</span>
                  <span className="flex items-center gap-1"><Users size={12} /> {seq._count?.enrollments || 0} enrolled</span>
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {(seq.steps || []).slice(0, 4).map((s: any, i: number) => {
                    const Icon = stepIcons[s.type] || Mail;
                    return (
                      <div key={i} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: stepColors[s.type] }}>
                        <Icon size={11} style={{ color: stepTextColors[s.type] }} />
                      </div>
                    );
                  })}
                  {(seq.steps?.length || 0) > 4 && <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono-num" style={{ background: "var(--ink-100)" }}>+{seq.steps.length - 4}</div>}
                </div>
              </Card>
              </div>
            ))}
          </div>
        )}
      </div>
      {showNew && <NewSequenceModal onClose={() => setShowNew(false)} />}
      {selected && <SequenceDetailModal sequence={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
