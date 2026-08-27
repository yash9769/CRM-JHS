import { useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  XCircle,
} from "lucide-react";

export type ImportEntityType = "accounts" | "contacts" | "leads" | "opportunities" | "deals";

interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  synonyms: string[];
  description?: string;
}

const ENTITY_CONFIGS: Record<
  ImportEntityType,
  {
    title: string;
    endpoint: string;
    queryKey: string;
    templateFileName: string;
    templateHeaders: string[];
    sampleRow: string[];
    fields: FieldDef[];
  }
> = {
  opportunities: {
    title: "Import Opportunities",
    endpoint: "/opportunities/import",
    queryKey: "opportunities",
    templateFileName: "opportunities_template.csv",
    templateHeaders: [
      "Account Owner",
      "Account",
      "Contact Person",
      "Opportunity Name",
      "Opportunity Stage",
      "Deal Value",
      "Remarks",
      "Assigned To",
      "Created Date",
      "Close Date",
    ],
    sampleRow: [
      "Yash Raj",
      "Tata Consultancy Services",
      "Rohan Sharma",
      "TCS Cloud Migration",
      "Scope Discussion",
      "1500000",
      "Initial scoping done. Reviewing SIEM specs.",
      "Yash Raj",
      new Date().toISOString().slice(0, 10),
      new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    ],
    fields: [
      { key: "name", label: "Opportunity Name", required: true, synonyms: ["opportunity name", "opportunity", "name", "deal name", "title"] },
      { key: "account", label: "Account", required: true, synonyms: ["account", "company", "account name", "company name", "client", "customer"] },
      { key: "amount", label: "Deal Value", required: true, synonyms: ["deal value", "amount", "value", "revenue", "deal amount", "opp value"] },
      { key: "opportunityStage", label: "Opportunity Stage", synonyms: ["opportunity stage", "opp stage", "stage", "status"] },
      { key: "contactPerson", label: "Contact Person", synonyms: ["contact person", "contact", "contact name", "primary contact"] },
      { key: "accountOwner", label: "Account Owner", synonyms: ["account owner", "acc owner"] },
      { key: "assignedTo", label: "Assigned To", synonyms: ["assigned to", "owner", "opportunity owner", "sales rep"] },
      { key: "createdDate", label: "Opportunity Created Date", synonyms: ["opportunity created date", "created date", "created at", "date created", "creation date"] },
      { key: "closeDate", label: "Opportunity Close Date", synonyms: ["opportunity close date", "close date", "expected close date", "target close date", "expected close"] },
      { key: "remarks", label: "Remarks / Notes", synonyms: ["remarks", "notes", "description", "details", "comments"] },
    ],
  },
  accounts: {
    title: "Import Accounts",
    endpoint: "/accounts/import",
    queryKey: "accounts",
    templateFileName: "accounts_template.csv",
    templateHeaders: [
      "Account Name",
      "Domain",
      "Industry",
      "Account Type",
      "Phone",
      "Website",
      "Annual Revenue",
      "Employee Count",
      "Billing Address",
      "Account Owner",
      "Description",
    ],
    sampleRow: [
      "Infosys Technologies",
      "infosys.com",
      "Technology",
      "CUSTOMER",
      "+91-80-2852-0261",
      "https://infosys.com",
      "50000000",
      "250000",
      "Bangalore Electronic City",
      "Yash Raj",
      "Enterprise strategic customer",
    ],
    fields: [
      { key: "name", label: "Account Name", required: true, synonyms: ["account name", "company name", "name", "account", "company"] },
      { key: "domain", label: "Domain", synonyms: ["domain", "company domain", "website domain"] },
      { key: "industry", label: "Industry", synonyms: ["industry", "sector", "vertical"] },
      { key: "accountType", label: "Account Type", synonyms: ["account type", "type", "tier"] },
      { key: "phone", label: "Phone", synonyms: ["phone", "telephone", "phone number"] },
      { key: "website", label: "Website", synonyms: ["website", "url", "web"] },
      { key: "annualRevenue", label: "Annual Revenue", synonyms: ["annual revenue", "revenue", "arr"] },
      { key: "employeeCount", label: "Employee Count", synonyms: ["employee count", "employees", "size", "headcount"] },
      { key: "billingAddress", label: "Billing Address", synonyms: ["billing address", "address", "location"] },
      { key: "owner", label: "Account Owner", synonyms: ["account owner", "owner"] },
      { key: "description", label: "Description", synonyms: ["description", "notes", "remarks"] },
    ],
  },
  contacts: {
    title: "Import Contacts",
    endpoint: "/contacts/import",
    queryKey: "contacts",
    templateFileName: "contacts_template.csv",
    templateHeaders: [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Job Title",
      "Account",
      "Lifecycle Stage",
      "LinkedIn URL",
      "Account Owner",
    ],
    sampleRow: [
      "Rohan",
      "Sharma",
      "rohan.sharma@infosys.com",
      "+91-98765-43210",
      "VP Engineering",
      "Infosys Technologies",
      "SALES_QUALIFIED",
      "https://linkedin.com/in/rohansharma",
      "Yash Raj",
    ],
    fields: [
      { key: "firstName", label: "First Name", required: true, synonyms: ["first name", "firstname", "first", "given name"] },
      { key: "lastName", label: "Last Name", required: true, synonyms: ["last name", "lastname", "last", "surname"] },
      { key: "email", label: "Email", synonyms: ["email", "email address", "e-mail"] },
      { key: "phone", label: "Phone", synonyms: ["phone", "mobile", "phone number", "cell"] },
      { key: "jobTitle", label: "Job Title", synonyms: ["job title", "title", "designation", "role"] },
      { key: "account", label: "Account / Company", synonyms: ["account", "company", "account name", "organization"] },
      { key: "lifecycleStage", label: "Lifecycle Stage", synonyms: ["lifecycle stage", "stage", "status"] },
      { key: "linkedinUrl", label: "LinkedIn URL", synonyms: ["linkedin url", "linkedin", "profile"] },
      { key: "owner", label: "Owner", synonyms: ["owner", "account owner", "assigned to"] },
    ],
  },
  leads: {
    title: "Import Leads",
    endpoint: "/leads/import",
    queryKey: "leads",
    templateFileName: "leads_template.csv",
    templateHeaders: [
      "First Name",
      "Last Name",
      "Email",
      "Phone",
      "Company",
      "Job Title",
      "Source",
      "Status",
      "Owner",
    ],
    sampleRow: [
      "Ananya",
      "Deshmukh",
      "ananya.d@fintech.io",
      "+91-99887-76655",
      "Fintech Solutions",
      "Head of Products",
      "Website",
      "NEW",
      "Yash Raj",
    ],
    fields: [
      { key: "firstName", label: "First Name", required: true, synonyms: ["first name", "firstname", "first"] },
      { key: "lastName", label: "Last Name", required: true, synonyms: ["last name", "lastname", "last"] },
      { key: "email", label: "Email", synonyms: ["email", "email address", "e-mail"] },
      { key: "phone", label: "Phone", synonyms: ["phone", "phone number", "mobile"] },
      { key: "companyName", label: "Company", synonyms: ["company", "company name", "organization", "account"] },
      { key: "jobTitle", label: "Job Title", synonyms: ["job title", "title", "role"] },
      { key: "source", label: "Source", synonyms: ["source", "lead source", "channel"] },
      { key: "status", label: "Status", synonyms: ["status", "lead status"] },
      { key: "owner", label: "Owner", synonyms: ["owner", "assigned to"] },
    ],
  },
  deals: {
    title: "Import Deals",
    endpoint: "/deals/import",
    queryKey: "deals",
    templateFileName: "deals_template.csv",
    templateHeaders: [
      "Deal Name",
      "Account",
      "Contact Person",
      "Deal Value",
      "Stage",
      "Owner",
      "Close Date",
      "Remarks",
    ],
    sampleRow: [
      "HDFC Cloud SOC Retainer",
      "HDFC Bank",
      "Vikram Seth",
      "4500000",
      "Negotiation",
      "Yash Raj",
      new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
      "Commercial contract under legal review",
    ],
    fields: [
      { key: "name", label: "Deal Name", required: true, synonyms: ["deal name", "deal", "name", "title"] },
      { key: "account", label: "Account", required: true, synonyms: ["account", "company", "account name", "client"] },
      { key: "amount", label: "Deal Value", required: true, synonyms: ["deal value", "amount", "value", "deal amount"] },
      { key: "stage", label: "Stage", synonyms: ["stage", "deal stage", "pipeline stage", "status"] },
      { key: "contactPerson", label: "Contact Person", synonyms: ["contact person", "contact", "contact name"] },
      { key: "owner", label: "Owner", synonyms: ["owner", "assigned to", "deal owner"] },
      { key: "closeDate", label: "Close Date", synonyms: ["close date", "expected close date", "target close"] },
      { key: "remarks", label: "Remarks / Notes", synonyms: ["remarks", "notes", "description"] },
    ],
  },
};

type Step = "upload" | "map" | "preview" | "done";

export function CsvImportModal({
  entity,
  onClose,
}: {
  entity: ImportEntityType;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const config = ENTITY_CONFIGS[entity];

  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState("");
  const [createMissingAccount, setCreateMissingAccount] = useState(true);
  const [createMissingContact, setCreateMissingContact] = useState(true);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"skip" | "create_new" | "update_existing">("skip");
  const [rowDecisions, setRowDecisions] = useState<Record<number, "skip" | "create_new" | "update_existing">>({});

  const validateMutation = useMutation({
    mutationFn: () =>
      api.post(config.endpoint, {
        rows,
        mapping,
        commit: false,
        createMissingAccount,
        createMissingContact,
        duplicateStrategy,
        rowDecisions,
      }),
  });

  const commitMutation = useMutation({
    mutationFn: () =>
      api.post(config.endpoint, {
        rows,
        mapping,
        commit: true,
        createMissingAccount,
        createMissingContact,
        duplicateStrategy,
        rowDecisions,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [config.queryKey] });
      setStep("done");
    },
  });

  function downloadTemplate() {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [config.templateHeaders.join(","), config.sampleRow.map((v) => `"${v}"`).join(",")].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", config.templateFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function downloadErrorCsv() {
    if (!validateMutation.data?.data?.results) return;
    const errors = validateMutation.data.data.results.filter((r: any) => r.status === "error");
    if (!errors.length) return;

    const headers = [...columns, "Import Error Reason"];
    const lines = [headers.join(",")];

    for (const err of errors) {
      const originalRow = rows[err.row] || {};
      const rowValues = columns.map((col) => `"${(originalRow[col] || "").replace(/"/g, '""')}"`);
      rowValues.push(`"${(err.error || "Unknown validation error").replace(/"/g, '""')}"`);
      lines.push(rowValues.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8," + lines.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${entity}_import_errors.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const foundCols = result.meta.fields || [];
        setColumns(foundCols);
        setRows(result.data);

        // Intelligent Auto-Mapping
        const auto: Record<string, string> = {};
        for (const field of config.fields) {
          const matchedCol = foundCols.find((col) => {
            const cleanCol = col.toLowerCase().replace(/[^a-z0-9]/g, "");
            return field.synonyms.some((syn) => syn.replace(/[^a-z0-9]/g, "") === cleanCol);
          });
          if (matchedCol) {
            auto[field.key] = matchedCol;
          }
        }
        setMapping(auto);
        setStep("map");
      },
    });
  }

  const preview = validateMutation.data?.data;
  const missingRequired = config.fields.filter((f) => f.required && !mapping[f.key]);

  return (
    <Modal title={config.title} onClose={onClose} width="720px">
      {/* STEP 1: UPLOAD */}
      {step === "upload" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-ledger-50 border border-ledger-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-ledger-600" />
              <div className="text-xs">
                <span className="font-semibold text-ledger-800">Need a sample format?</span>
                <p className="text-ledger-600">Download our pre-formatted CSV template with example data.</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download size={14} className="mr-1" />
              Download Template
            </Button>
          </div>

          <label
            className="flex flex-col items-center justify-center gap-3 py-12 rounded-xl border-2 border-dashed cursor-pointer transition hover:border-ledger-400 hover:bg-ledger-50/50"
            style={{ borderColor: "var(--ink-200)" }}
          >
            <div className="p-3 rounded-full bg-ledger-100 text-ledger-700">
              <UploadCloud size={28} />
            </div>
            <div className="text-center">
              <span className="text-sm font-medium text-ink-800">Click to choose a CSV file, or drag and drop</span>
              <p className="text-xs text-ink-400 mt-1">UTF-8 encoded .csv files up to 10MB</p>
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </label>
        </div>
      )}

      {/* STEP 2: COLUMN MAPPING & CONFIGURATION */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--ink-100)" }}>
            <p className="text-sm font-medium" style={{ color: "var(--ink-700)" }}>
              {fileName} &bull; <span className="font-mono-num font-semibold text-ledger-700">{rows.length}</span> row(s) detected
            </p>
            <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>
              Change File
            </Button>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {config.fields.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-4 p-2 rounded-lg hover:bg-ink-50 transition border border-transparent hover:border-ink-100"
              >
                <div className="w-48 text-sm font-medium shrink-0 flex items-center gap-1">
                  <span>{f.label}</span>
                  {f.required ? (
                    <span className="text-rose-600 font-bold" title="Required field">*</span>
                  ) : null}
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <ArrowRight size={14} className="text-ink-300 shrink-0" />
                  <select
                    value={mapping[f.key] || ""}
                    onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                    className={inputClass}
                    style={inputStyle}
                  >
                    <option value="">— Select CSV Column —</option>
                    {columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          {/* Additional Import Options */}
          <div className="p-3 rounded-lg bg-ink-50 border border-ink-100 space-y-2 text-xs">
            <div className="font-semibold text-ink-700 mb-1">Import Options & Relationship Resolution</div>
            {(entity === "opportunities" || entity === "deals" || entity === "contacts") && (
              <label className="flex items-center gap-2 cursor-pointer text-ink-600">
                <input
                  type="checkbox"
                  checked={createMissingAccount}
                  onChange={(e) => setCreateMissingAccount(e.target.checked)}
                  className="rounded text-ledger-600"
                />
                <span>Automatically create new Account if name does not exist in CRM</span>
              </label>
            )}
            {(entity === "opportunities" || entity === "deals") && (
              <label className="flex items-center gap-2 cursor-pointer text-ink-600">
                <input
                  type="checkbox"
                  checked={createMissingContact}
                  onChange={(e) => setCreateMissingContact(e.target.checked)}
                  className="rounded text-ledger-600"
                />
                <span>Automatically create new Contact under Account if name does not exist</span>
              </label>
            )}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-ink-600 font-medium">Default Duplicate Action:</span>
              <select
                value={duplicateStrategy}
                onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                className="text-xs rounded border border-ink-200 px-2 py-1 bg-white"
              >
                <option value="skip">Skip duplicates (Recommended)</option>
                <option value="update_existing">Update existing record</option>
                <option value="create_new">Create new record anyway</option>
              </select>
            </div>
          </div>

          {missingRequired.length > 0 && (
            <div className="p-2 rounded bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>
                Please map all required fields: <strong>{missingRequired.map((f) => f.label).join(", ")}</strong>
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button
              disabled={missingRequired.length > 0 || validateMutation.isPending}
              onClick={() =>
                validateMutation.mutate(undefined, {
                  onSuccess: () => setStep("preview"),
                })
              }
            >
              {validateMutation.isPending ? (
                <>
                  <RefreshCw size={14} className="animate-spin mr-1" /> Validating…
                </>
              ) : (
                "Validate & Preview"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: VALIDATION & DUPLICATE PREVIEW */}
      {step === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg text-center bg-emerald-50 border border-emerald-200">
              <div className="text-2xl font-mono-num font-bold text-emerald-700">
                {preview.summary.valid}
              </div>
              <div className="text-xs text-emerald-600 font-medium">Ready to import</div>
            </div>
            <div className="p-3 rounded-lg text-center bg-amber-50 border border-amber-200">
              <div className="text-2xl font-mono-num font-bold text-amber-700">
                {preview.summary.duplicates}
              </div>
              <div className="text-xs text-amber-600 font-medium">Duplicates detected</div>
            </div>
            <div className="p-3 rounded-lg text-center bg-rose-50 border border-rose-200">
              <div className="text-2xl font-mono-num font-bold text-rose-700">
                {preview.summary.errors}
              </div>
              <div className="text-xs text-rose-600 font-medium">Errors (will skip)</div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-ink-500 px-1">
            <span>Review row-by-row import status and duplicate actions</span>
            {preview.summary.errors > 0 && (
              <button
                type="button"
                onClick={downloadErrorCsv}
                className="text-rose-600 hover:text-rose-700 font-medium underline flex items-center gap-1"
              >
                <Download size={12} /> Download Error CSV
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-ink-200 divide-y divide-ink-100 bg-white">
            {preview.results.map((r: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {r.status === "valid" && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                  {r.status === "duplicate" && <Copy size={15} className="text-amber-500 shrink-0" />}
                  {r.status === "error" && <XCircle size={15} className="text-rose-600 shrink-0" />}

                  <div className="truncate">
                    <span className="font-semibold text-ink-800">
                      Row {r.row + 1}: {r.data?.name || (r.data?.firstName ? `${r.data.firstName} ${r.data.lastName}` : "Record")}
                    </span>
                    {r.data?.accountName && (
                      <span className="text-ink-400 ml-1">({r.data.accountName})</span>
                    )}
                    {r.error && (
                      <div className="text-rose-600 font-medium mt-0.5">{r.error}</div>
                    )}
                    {r.status === "duplicate" && (
                      <div className="text-amber-600 mt-0.5">
                        Matches existing CRM record ({r.duplicateDetails?.existingName || "Duplicate found"})
                      </div>
                    )}
                  </div>
                </div>

                {r.status === "duplicate" && (
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <select
                      value={rowDecisions[r.row] || duplicateStrategy}
                      onChange={(e) =>
                        setRowDecisions({
                          ...rowDecisions,
                          [r.row]: e.target.value as any,
                        })
                      }
                      className="text-2xs rounded border border-ink-200 px-1.5 py-0.5 bg-ink-50 font-medium"
                    >
                      <option value="skip">Skip</option>
                      <option value="update_existing">Update Existing</option>
                      <option value="create_new">Create New</option>
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="secondary" onClick={() => setStep("map")}>
              Back to Mapping
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                disabled={commitMutation.isPending || preview.summary.valid + (duplicateStrategy !== "skip" ? preview.summary.duplicates : 0) === 0}
                onClick={() => commitMutation.mutate()}
              >
                {commitMutation.isPending ? (
                  <>
                    <RefreshCw size={14} className="animate-spin mr-1" /> Importing…
                  </>
                ) : (
                  `Confirm & Import Records`
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: IMPORT RESULT & DONE */}
      {step === "done" && (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-ink-900">Import Completed Successfully!</h3>
            <p className="text-xs text-ink-500 mt-1">
              Your {config.title.toLowerCase().replace("import ", "")} data has been imported into the CRM.
            </p>
          </div>

          {commitMutation.data?.data?.summary && (
            <div className="flex justify-center gap-6 py-3 px-4 bg-ink-50 rounded-lg max-w-sm mx-auto text-xs">
              <div>
                <span className="font-bold text-emerald-700 text-sm">
                  {commitMutation.data.data.summary.valid}
                </span>
                <p className="text-ink-500">Imported</p>
              </div>
              <div>
                <span className="font-bold text-amber-600 text-sm">
                  {commitMutation.data.data.summary.duplicates}
                </span>
                <p className="text-ink-500">Duplicates</p>
              </div>
              <div>
                <span className="font-bold text-rose-600 text-sm">
                  {commitMutation.data.data.summary.errors}
                </span>
                <p className="text-ink-500">Errors</p>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="secondary" onClick={downloadTemplate}>
              <Download size={14} className="mr-1" /> Download Clean Template
            </Button>
            <Button onClick={onClose}>Done & View Records</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
