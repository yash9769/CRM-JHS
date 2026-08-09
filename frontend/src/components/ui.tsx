import type { ReactNode } from "react";
import { X } from "lucide-react";

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-8 pt-7 pb-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--ink-500)" }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{ borderColor: "var(--ink-100)", background: "white" }}
    >
      {children}
    </div>
  );
}

export function Button({
  children, onClick, variant = "primary", size = "md", type = "button", disabled, className = "",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md"; type?: "button" | "submit"; disabled?: boolean; className?: string;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm";
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--ledger-600)", color: "white" },
    secondary: { background: "var(--ink-50)", color: "var(--ink-800)", border: "1px solid var(--ink-200)" },
    ghost: { background: "transparent", color: "var(--ink-600)" },
    danger: { background: "var(--rose-100)", color: "var(--rose-600)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes} ${className}`}
      style={variants[variant]}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "amber" | "rose" }) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--ink-100)", color: "var(--ink-700)" },
    green: { background: "var(--ledger-100)", color: "var(--ledger-900)" },
    amber: { background: "var(--amber-100)", color: "var(--amber-600)" },
    rose: { background: "var(--rose-100)", color: "var(--rose-600)" },
  };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
      style={tones[tone]}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage?: { name: string; isClosed: boolean; isWon: boolean } | null }) {
  if (!stage) return <Badge>—</Badge>;
  const tone = stage.isClosed ? (stage.isWon ? "green" : "rose") : "neutral";
  return <Badge tone={tone}>{stage.name}</Badge>;
}

export function EmptyState({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      <div className="text-[15px] font-medium" style={{ color: "var(--ink-700)" }}>{title}</div>
      {subtitle && <div className="text-sm mt-1 max-w-sm" style={{ color: "var(--ink-400)" }}>{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, width = "480px" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,23,26,0.5)" }} onClick={onClose}>
      <div
        className="rounded-xl bg-white shadow-2xl w-full max-h-[88vh] overflow-y-auto"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white" style={{ borderColor: "var(--ink-100)" }}>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--ink-50)]">
            <X size={16} style={{ color: "var(--ink-500)" }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block mb-3.5">
      <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>
        {label} {required && <span style={{ color: "var(--rose-600)" }}>*</span>}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-2 focus:ring-[var(--ledger-500)]";
export const inputStyle: React.CSSProperties = { borderColor: "var(--ink-200)" };
