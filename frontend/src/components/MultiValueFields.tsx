import { Plus, Star, Trash2 } from "lucide-react";
import { inputClass, inputStyle } from "./ui";
import { PHONE_COUNTRIES, DEFAULT_COUNTRY_CODE, isValidLocalNumber } from "../lib/phoneCountries";

export interface EmailEntry {
  email: string;
  label?: string | null;
  isPrimary?: boolean;
}

export interface PhoneEntry {
  countryCode: string;
  number: string;
  label?: string | null;
  isPrimary?: boolean;
}

/**
 * Repeatable "Emails" field group -- Account and Contact both need to
 * collect more than one address. Whichever row is marked primary (starred)
 * becomes the legacy single-email column on the backend, so search/export/
 * dedupe logic elsewhere keeps working unchanged.
 */
import { ValidatedEmailInput } from "./ValidatedInput";

export function MultiEmailField({ value, onChange }: { value: EmailEntry[]; onChange: (v: EmailEntry[]) => void }) {
  function update(i: number, patch: Partial<EmailEntry>) {
    onChange(value.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function remove(i: number) {
    const next = value.filter((_, idx) => idx !== i);
    if (next.length && !next.some((e) => e.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  }
  function makePrimary(i: number) {
    onChange(value.map((e, idx) => ({ ...e, isPrimary: idx === i })));
  }
  function add() {
    onChange([...value, { email: "", isPrimary: value.length === 0 }]);
  }

  return (
    <div className="mb-4">
      <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Email addresses</div>
      <div className="space-y-2">
        {value.map((entry, i) => (
          <div key={i} className="p-2.5 rounded-xl bg-[var(--ink-50)]/70 border border-[var(--ink-100)] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  title={entry.isPrimary ? "Primary email" : "Set as primary"}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    entry.isPrimary
                      ? "bg-amber-100/80 text-amber-800 border border-amber-200"
                      : "text-[var(--ink-400)] hover:bg-[var(--ink-100)]"
                  }`}
                >
                  <Star size={12} fill={entry.isPrimary ? "currentColor" : "none"} className={entry.isPrimary ? "text-amber-500" : ""} />
                  <span>{entry.isPrimary ? "Primary Email" : "Make primary"}</span>
                </button>
              </div>

              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1 rounded text-[var(--ink-400)] hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Remove">
                <Trash2 size={14} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ValidatedEmailInput
                  value={entry.email}
                  onChange={(email) => update(i, { email })}
                  placeholder="name@example.com"
                />
              </div>
              <input
                value={entry.label || ""}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Label (optional)"
                className={inputClass}
                style={{ ...inputStyle, width: 130 }}
              />
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 text-xs font-medium hover:underline flex items-center gap-1" style={{ color: "var(--ledger-700)" }}>
        <Plus size={12} /> Add another email
      </button>
    </div>
  );
}

/**
 * Repeatable "Phone Numbers" field group -- country-code dropdown +
 * landline/mobile number, everywhere a phone is collected. Whichever
 * row is marked primary becomes the legacy single-phone column.
 */
const PRESET_LABELS = ["Mobile", "Landline", "Company Landline", "Main", "Direct Line", "Work", "Office"];

export function MultiPhoneField({ value, onChange }: { value: PhoneEntry[]; onChange: (v: PhoneEntry[]) => void }) {
  function update(i: number, patch: Partial<PhoneEntry>) {
    onChange(value.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function remove(i: number) {
    const next = value.filter((_, idx) => idx !== i);
    if (next.length && !next.some((p) => p.isPrimary)) next[0].isPrimary = true;
    onChange(next);
  }
  function makePrimary(i: number) {
    onChange(value.map((p, idx) => ({ ...p, isPrimary: idx === i })));
  }
  function add(type: "mobile" | "landline" = "mobile") {
    const defaultLabel = type === "landline" ? "Landline" : "Mobile";
    onChange([...value, { countryCode: DEFAULT_COUNTRY_CODE, number: "", label: defaultLabel, isPrimary: value.length === 0 }]);
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-xs font-medium" style={{ color: "var(--ink-600)" }}>Phone & Landline numbers</div>
      </div>
      <div className="space-y-2.5">
        {value.map((entry, i) => {
          const isLandline = (entry.label || "").toLowerCase().includes("landline") ||
            (entry.label || "").toLowerCase().includes("office") ||
            (entry.label || "").toLowerCase().includes("direct line");
          const maxDigits = isLandline ? 12 : 10;
          const digitsOnly = entry.number.replace(/\D/g, "");
          const invalid = entry.number.length > 0 && !isValidLocalNumber(digitsOnly, isLandline);
          const isPreset = PRESET_LABELS.includes(entry.label || "");

          return (
            <div key={i} className="p-2.5 rounded-xl bg-[var(--ink-50)]/70 border border-[var(--ink-100)] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <select
                    value={isPreset ? entry.label || "Mobile" : "Custom"}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val !== "Custom") update(i, { label: val });
                      else update(i, { label: "" });
                    }}
                    className={`${inputClass} text-xs font-medium py-1`}
                    style={{ ...inputStyle, width: 145 }}
                  >
                    <option value="Mobile">Mobile (max 10 digits)</option>
                    <option value="Landline">Landline (7-12 digits)</option>
                    <option value="Company Landline">Company Landline</option>
                    <option value="Main">Main</option>
                    <option value="Direct Line">Direct Line</option>
                    <option value="Work">Work</option>
                    <option value="Office">Office</option>
                    <option value="Custom">Custom Label...</option>
                  </select>

                  {!isPreset && (
                    <input
                      value={entry.label || ""}
                      onChange={(e) => update(i, { label: e.target.value })}
                      placeholder="e.g. Reception"
                      className={`${inputClass} text-xs py-1 flex-1 min-w-[100px]`}
                      style={inputStyle}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => makePrimary(i)}
                    title={entry.isPrimary ? "Primary number" : "Set as primary"}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                      entry.isPrimary
                        ? "bg-amber-100/80 text-amber-800 border border-amber-200"
                        : "text-[var(--ink-400)] hover:bg-[var(--ink-100)]"
                    }`}
                  >
                    <Star size={12} fill={entry.isPrimary ? "currentColor" : "none"} className={entry.isPrimary ? "text-amber-500" : ""} />
                    <span>{entry.isPrimary ? "Primary" : "Make primary"}</span>
                  </button>
                </div>

                <button type="button" onClick={() => remove(i)} className="shrink-0 p-1 rounded text-[var(--ink-400)] hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Remove">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={entry.countryCode}
                  onChange={(e) => update(i, { countryCode: e.target.value })}
                  className={`${inputClass} shrink-0`}
                  style={{ ...inputStyle, width: 175 }}
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={`${c.iso}-${c.code}`} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>

                <input
                  value={entry.number}
                  maxLength={maxDigits}
                  onChange={(e) => update(i, { number: e.target.value.replace(/\D/g, "").slice(0, maxDigits) })}
                  placeholder={isLandline ? "e.g. 02224001234 (7 to 12 digits)" : "e.g. 9876543210 (max 10 digits)"}
                  inputMode="numeric"
                  className={`${inputClass} flex-1 font-mono-num`}
                  style={inputStyle}
                />
              </div>

              {invalid && (
                <div className="text-xs text-rose-600 font-medium pt-0.5">
                  {isLandline ? "Landline number must be 7 to 12 digits" : "Mobile number must be max 10 digits"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={() => add("mobile")} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: "var(--ledger-700)" }}>
          <Plus size={12} /> Add Mobile Phone (max 10 digits)
        </button>
        <span className="text-xs text-[var(--ink-300)]">|</span>
        <button type="button" onClick={() => add("landline")} className="text-xs font-medium hover:underline flex items-center gap-1 text-emerald-700">
          <Plus size={12} /> Add Landline (7-12 digits)
        </button>
      </div>
    </div>
  );
}

/** True only when every phone row (if any) has a valid number for its type. */
export function allPhonesValid(phones: PhoneEntry[]): boolean {
  return phones.every((p) => {
    const isLandline = (p.label || "").toLowerCase().includes("landline") ||
      (p.label || "").toLowerCase().includes("office") ||
      (p.label || "").toLowerCase().includes("direct line");
    return isValidLocalNumber(p.number, isLandline);
  });
}

