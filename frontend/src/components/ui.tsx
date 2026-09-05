import { useEffect, type ReactNode } from "react";
import { X, ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export function BackButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`press-feedback inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-[var(--ink-100)] ${className}`}
      style={{ color: "var(--ink-500)" }}
      aria-label="Go back"
    >
      <ArrowLeft size={18} />
    </button>
  );
}

export function PageHeader({
  title, subtitle, action, showBack = false,
}: { title: string; subtitle?: string; action?: ReactNode; showBack?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-8 pt-7 pb-5">
      <div className="flex items-center gap-2">
        {showBack && <BackButton />}
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>{title}</h1>
          {subtitle && <p className="text-sm mt-0.5" style={{ color: "var(--ink-500)" }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Card({
  children, className = "", interactive = false,
}: { children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div
      className={`rounded-xl border ${interactive ? "transition-shadow hover:shadow-md" : ""} ${className}`}
      style={{ borderColor: "var(--border-default)", background: "var(--surface-raised)" }}
    >
      {children}
    </div>
  );
}

const buttonSizeClasses: Record<string, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-1.5",
  lg: "h-11 px-5 text-sm gap-2",
};

export function Button({
  children, onClick, variant = "primary", size = "md", type = "button", disabled, loading = false, className = "",
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "xs" | "sm" | "md" | "lg"; type?: "button" | "submit"; disabled?: boolean; loading?: boolean; className?: string;
}) {
  const base = "press-feedback inline-flex items-center justify-center rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 whitespace-nowrap";
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "var(--ledger-600)", color: "white" },
    secondary: { background: "var(--surface-sunken)", color: "var(--ink-800)", border: "1px solid var(--border-default)" },
    ghost: { background: "transparent", color: "var(--ink-600)" },
    danger: { background: "var(--rose-100)", color: "var(--rose-600)" },
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`${base} ${buttonSizeClasses[size]} ${className}`}
      style={variants[variant]}
    >
      {loading && <Loader2 size={size === "xs" || size === "sm" ? 12 : 14} className="animate-spin" />}
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

export function EmptyState({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
      {icon && <div className="mb-3" style={{ color: "var(--ink-300)" }}>{icon}</div>}
      <div className="text-[15px] font-medium" style={{ color: "var(--ink-700)" }}>{title}</div>
      {subtitle && <div className="text-sm mt-1 max-w-sm" style={{ color: "var(--ink-400)" }}>{subtitle}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Placeholder block for loading states — matches the shape of the content it replaces. */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: "var(--ink-100)", ...style }}
      aria-hidden="true"
    />
  );
}

export function Modal({ title, onClose, children, width = "480px" }: { title: string; onClose: () => void; children: ReactNode; width?: string }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(10,12,14,0.55)" }}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="rounded-xl shadow-2xl w-full max-h-[88vh] overflow-y-auto"
        style={{ maxWidth: width, background: "var(--surface-raised)" }}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b sticky top-0"
          style={{ borderColor: "var(--border-default)", background: "var(--surface-raised)" }}
        >
          <h3 id="modal-title" className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
          <button
            onClick={onClose}
            className="press-feedback p-1 rounded hover:bg-[var(--ink-50)]"
            aria-label="Close dialog"
          >
            <X size={16} style={{ color: "var(--ink-500)" }} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </motion.div>
    </motion.div>
  );
}

export function Field({ label, children, required }: { label: ReactNode; children: ReactNode; required?: boolean }) {
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
  "w-full px-3 py-2 rounded-md border text-sm outline-none transition-shadow focus:ring-2 focus:ring-[var(--ledger-500)]";
export const inputStyle: React.CSSProperties = { borderColor: "var(--border-default)", background: "var(--surface-raised)", color: "var(--text-primary)" };
