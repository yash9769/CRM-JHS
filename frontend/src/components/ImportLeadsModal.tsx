import { useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { UploadCloud, CheckCircle2, AlertTriangle, Copy } from "lucide-react";

const LEAD_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "firstName", label: "First Name", required: true },
  { key: "lastName", label: "Last Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "companyName", label: "Company" },
  { key: "jobTitle", label: "Job Title" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
];

type Step = "upload" | "map" | "preview" | "done";

export function ImportLeadsModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");

  const validateMutation = useMutation({
    mutationFn: () => api.post("/leads/import", { rows, mapping, commit: false }),
  });

  const commitMutation = useMutation({
    mutationFn: () => api.post("/leads/import", { rows, mapping, commit: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); setStep("done"); },
  });

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setColumns(result.meta.fields || []);
        setRows(result.data);
        // Best-effort auto-mapping by matching header names
        const auto: Record<string, string> = {};
        for (const f of LEAD_FIELDS) {
          const match = (result.meta.fields || []).find((h) => h.toLowerCase().replace(/[^a-z]/g, "") === f.key.toLowerCase());
          if (match) auto[f.key] = match;
        }
        setMapping(auto);
        setStep("map");
      },
    });
  }

  const preview = validateMutation.data?.data;

  return (
    <Modal title="Import Leads" onClose={onClose} width="620px">
      {step === "upload" && (
        <div>
          <label className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg border-2 border-dashed cursor-pointer" style={{ borderColor: "var(--ink-200)" }}>
            <UploadCloud size={24} style={{ color: "var(--ink-400)" }} />
            <span className="text-sm font-medium" style={{ color: "var(--ink-600)" }}>Click to upload a CSV file</span>
            <span className="text-xs" style={{ color: "var(--ink-400)" }}>First row should contain column headers</span>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        </div>
      )}

      {step === "map" && (
        <div>
          <p className="text-sm mb-4" style={{ color: "var(--ink-600)" }}>
            {fileName} — {rows.length} row(s). Map your CSV columns to lead fields.
          </p>
          <div className="space-y-2 mb-5 max-h-80 overflow-y-auto">
            {LEAD_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium shrink-0">{f.label}{f.required && <span style={{ color: "var(--rose-600)" }}> *</span>}</div>
                <select
                  value={mapping[f.key] || ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                  className={inputClass}
                  style={inputStyle}
                >
                  <option value="">— Not mapped —</option>
                  {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>Back</Button>
            <Button
              disabled={!mapping.firstName || !mapping.lastName || validateMutation.isPending}
              onClick={() => validateMutation.mutate(undefined, { onSuccess: () => setStep("preview") })}
            >
              {validateMutation.isPending ? "Validating…" : "Validate & Preview"}
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && preview && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg text-center" style={{ background: "var(--ledger-100)" }}>
              <div className="text-xl font-mono-num font-semibold" style={{ color: "var(--ledger-700)" }}>{validateMutation.data!.data.summary.valid}</div>
              <div className="text-xs" style={{ color: "var(--ink-500)" }}>Ready to import</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: "var(--ink-50)" }}>
              <div className="text-xl font-mono-num font-semibold">{validateMutation.data!.data.summary.duplicates}</div>
              <div className="text-xs" style={{ color: "var(--ink-500)" }}>Possible duplicates</div>
            </div>
            <div className="p-3 rounded-lg text-center" style={{ background: "var(--rose-100)" }}>
              <div className="text-xl font-mono-num font-semibold" style={{ color: "var(--rose-600)" }}>{validateMutation.data!.data.summary.errors}</div>
              <div className="text-xs" style={{ color: "var(--ink-500)" }}>Errors</div>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border mb-4" style={{ borderColor: "var(--ink-100)" }}>
            {validateMutation.data!.data.results.map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm border-b last:border-0" style={{ borderColor: "var(--ink-50)" }}>
                {r.status === "valid" && <CheckCircle2 size={13} style={{ color: "var(--ledger-600)" }} />}
                {r.status === "duplicate" && <Copy size={13} style={{ color: "var(--ink-400)" }} />}
                {r.status === "error" && <AlertTriangle size={13} style={{ color: "var(--rose-600)" }} />}
                <span className="flex-1">{r.data ? `${r.data.firstName} ${r.data.lastName}` : `Row ${r.row + 1}`}</span>
                <span className="text-xs" style={{ color: r.status === "error" ? "var(--rose-600)" : "var(--ink-400)" }}>
                  {r.status === "error" ? r.error : r.status === "duplicate" ? "Skipped — likely duplicate" : "Will import"}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setStep("map")}>Back</Button>
            <Button disabled={commitMutation.isPending || validateMutation.data!.data.summary.valid === 0} onClick={() => commitMutation.mutate()}>
              {commitMutation.isPending ? "Importing…" : `Import ${validateMutation.data!.data.summary.valid} Lead(s)`}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-6">
          <CheckCircle2 size={32} style={{ color: "var(--ledger-600)" }} className="mx-auto mb-3" />
          <p className="text-sm mb-4" style={{ color: "var(--ink-600)" }}>
            Imported {commitMutation.data?.data.summary.valid} lead(s).
            {commitMutation.data?.data.summary.duplicates ? ` ${commitMutation.data.data.summary.duplicates} duplicate(s) were skipped.` : ""}
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
