import { useState } from "react";
import { validateEmail, validateDomain, cleanDomain } from "../lib/emailDomainValidator";
import { inputClass, inputStyle } from "./ui";
import { AlertTriangle, Check, Sparkles } from "lucide-react";

interface ValidatedEmailInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
}

export function ValidatedEmailInput({
  value,
  onChange,
  placeholder = "name@example.com",
  className = "",
  style,
  required = false,
}: ValidatedEmailInputProps) {
  const [touched, setTouched] = useState(false);
  const result = validateEmail(value);

  const hasError = touched && !result.isValid;
  const hasSuggestion = result.suggestion && result.suggestion !== value;

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="email"
          value={value}
          required={required}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          className={`${inputClass} ${className} ${
            hasError
              ? "border-rose-500 focus:ring-rose-500 bg-rose-50/20"
              : hasSuggestion
              ? "border-amber-400 focus:ring-amber-400"
              : ""
          }`}
          style={{
            ...inputStyle,
            ...(hasError ? { borderColor: "var(--rose-500)" } : {}),
            ...(hasSuggestion ? { borderColor: "var(--amber-500)" } : {}),
            ...style,
          }}
        />
      </div>

      {hasError && (
        <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-rose-600">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {hasSuggestion && (
        <div className="flex items-center justify-between mt-1 px-2 py-1 rounded text-[11px] bg-amber-50 border border-amber-200 text-amber-800">
          <div className="flex items-center gap-1">
            <Sparkles size={12} className="text-amber-600 shrink-0" />
            <span>Did you mean <strong>{result.suggestion}</strong>?</span>
          </div>
          <button
            type="button"
            onClick={() => onChange(result.suggestion!)}
            className="ml-2 px-1.5 py-0.5 rounded bg-amber-600 text-white font-medium hover:bg-amber-700 text-[10px] inline-flex items-center gap-0.5"
          >
            <Check size={10} /> Fix
          </button>
        </div>
      )}
    </div>
  );
}

interface ValidatedDomainInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ValidatedDomainInput({
  value,
  onChange,
  placeholder = "example.com",
  className = "",
  style,
}: ValidatedDomainInputProps) {
  const [touched, setTouched] = useState(false);
  const result = validateDomain(value);

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text");
    if (pasted) {
      const cleaned = cleanDomain(pasted);
      if (cleaned !== pasted) {
        e.preventDefault();
        onChange(cleaned);
      }
    }
  }

  function handleBlur() {
    setTouched(true);
    if (value) {
      const cleaned = cleanDomain(value);
      if (cleaned !== value) {
        onChange(cleaned);
      }
    }
  }

  const hasError = touched && !result.isValid;

  return (
    <div className="w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`${inputClass} ${className} ${
          hasError ? "border-rose-500 focus:ring-rose-500 bg-rose-50/20" : ""
        }`}
        style={{
          ...inputStyle,
          ...(hasError ? { borderColor: "var(--rose-500)" } : {}),
          ...style,
        }}
      />

      {hasError && (
        <div className="flex items-center gap-1 mt-1 text-[11px] font-medium text-rose-600">
          <AlertTriangle size={12} className="shrink-0" />
          <span>{result.error}</span>
        </div>
      )}
    </div>
  );
}

interface NonNegativeNumberInputProps {
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  min?: string | number;
  step?: string | number;
  max?: string | number;
  id?: string;
  name?: string;
  disabled?: boolean;
  allowDecimals?: boolean;
}

export function NonNegativeNumberInput({
  value,
  onChange,
  placeholder,
  className = "",
  style,
  required = false,
  min = "0",
  step,
  max,
  id,
  name,
  disabled,
  allowDecimals = false,
}: NonNegativeNumberInputProps) {
  const [showPrompt, setShowPrompt] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "-" || e.key === "Subtract") {
      e.preventDefault();
      setShowPrompt(true);
      setTimeout(() => setShowPrompt(false), 2500);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.includes("-")) {
      val = val.replace(/-/g, "");
      setShowPrompt(true);
      setTimeout(() => setShowPrompt(false), 2500);
    }
    onChange(val);
  };

  return (
    <div className="w-full relative">
      <input
        type="number"
        id={id}
        name={name}
        min={min}
        max={max}
        step={step !== undefined ? step : (allowDecimals ? "0.01" : undefined)}
        required={required}
        disabled={disabled}
        value={value ?? ""}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        placeholder={placeholder}
        className={`${inputClass} ${className} ${showPrompt ? "border-rose-400 ring-1 ring-rose-300" : ""}`}
        style={{ ...inputStyle, ...style }}
      />
      {showPrompt && (
        <div className="absolute left-0 -bottom-6 z-20 flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded shadow-xs border border-rose-200 animate-fadeIn">
          <AlertTriangle size={11} />
          <span>Negative values are not allowed</span>
        </div>
      )}
    </div>
  );
}

