import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { inputClass, inputStyle } from "./ui";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with a show/hide toggle. Accepts the same props as a normal <input>. */
export function PasswordInput({ className = inputClass, style = inputStyle, ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`${className} pr-10`}
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
