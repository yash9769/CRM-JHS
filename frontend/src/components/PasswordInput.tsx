import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass, inputStyle } from "./ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Optional icon shown inside the left edge of the field. */
  icon?: ReactNode;
};

/** Password input with a show/hide toggle. Accepts the same props as a normal <input>. */
export function PasswordInput({ className = inputClass, style = inputStyle, icon, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--ink-400)]">
          {icon}
        </span>
      )}
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`${className} pr-10 ${icon ? "pl-10" : ""}`}
        style={style}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex items-center px-3 rounded-r-md text-[var(--ink-400)] hover:text-[var(--ink-700)] focus-visible:outline-none focus-visible:text-[var(--ledger-700)]"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
