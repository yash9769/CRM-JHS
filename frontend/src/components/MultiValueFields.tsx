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
          <div key={i} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => makePrimary(i)}
                title={entry.isPrimary ? "Primary email" : "Set as primary"}
                className="shrink-0 p-1.5 rounded hover:bg-[var(--ink-50)]"
              >
                <Star size={14} fill={entry.isPrimary ? "currentColor" : "none"} style={{ color: entry.isPrimary ? "var(--amber-500)" : "var(--ink-300)" }} />
              </button>
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
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 rounded hover:bg-rose-50" title="Remove">
                <Trash2 size={14} style={{ color: "var(--rose-600)" }} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-2 text-xs font-medium hover:underline" style={{ color: "var(--ledger-700)" }}>
        <Plus size={12} className="inline -mt-0.5" /> Add another email
      </button>
    </div>
  );
}

/**
 * Repeatable "Phone Numbers" field group -- country-code dropdown +
 * exactly-10-digit local number, everywhere a phone is collected. Whichever
 * row is marked primary becomes the legacy single-phone column.
 */
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
  function add() {
    onChange([...value, { countryCode: DEFAULT_COUNTRY_CODE, number: "", isPrimary: value.length === 0 }]);
  }

  return (
    <div className="mb-4">
      <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Phone numbers</div>
      <div className="space-y-2">
        {value.map((entry, i) => {
          const digitsOnly = entry.number.replace(/\D/g, "");
          const invalid = entry.number.length > 0 && !isValidLocalNumber(digitsOnly);
          return (
            <div key={i}>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => makePrimary(i)}
                  title={entry.isPrimary ? "Primary number" : "Set as primary"}
                  className="shrink-0 p-1.5 rounded hover:bg-[var(--ink-50)]"
                >
                  <Star size={14} fill={entry.isPrimary ? "currentColor" : "none"} style={{ color: entry.isPrimary ? "var(--amber-500)" : "var(--ink-300)" }} />
                </button>
                <select
                  value={entry.countryCode}
                  onChange={(e) => update(i, { countryCode: e.target.value })}
                  className={inputClass}
                  style={{ ...inputStyle, width: 110 }}
                >
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={`${c.iso}-${c.code}`} value={c.code}>{c.code} {c.iso}</option>
                  ))}
                </select>
                <input
                  value={entry.number}
                  onChange={(e) => update(i, { number: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                  placeholder="9876543210"
                  inputMode="numeric"
                  className={`${inputClass} flex-1 font-mono-num`}
                  style={inputStyle}
                />
                <input
                  value={entry.label || ""}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="Label (optional)"
                  className={inputClass}
                  style={{ ...inputStyle, width: 120 }}
                />
                <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 rounded hover:bg-rose-50" title="Remove">
                  <Trash2 size={14} style={{ color: "var(--rose-600)" }} />
                </button>
              </div>
              {invalid && (
                <div className="text-xs mt-1 ml-8" style={{ color: "var(--rose-600)" }}>Must be exactly 10 digits</div>
              )}
            </div>
          );
        })}
      </div>
      <button type="button" onClick={add} className="mt-2 text-xs font-medium hover:underline" style={{ color: "var(--ledger-700)" }}>
        <Plus size={12} className="inline -mt-0.5" /> Add another phone number
      </button>
    </div>
  );
}

/** True only when every phone row (if any) has a valid 10-digit number. */
export function allPhonesValid(phones: PhoneEntry[]): boolean {
  return phones.every((p) => isValidLocalNumber(p.number));
}
