import type { ReactNode } from "react";
import { X, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Vivid gradient accent palette introduced by the pipeline "beautify" work
 * (see frontend/src/lib/stageThemes.ts). Reused here so every page can pick
 * up the same KPI-strip look instead of each page inventing its own colors.
 */
export type AccentColor = "indigo" | "sky" | "amber" | "emerald" | "purple" | "rose" | "violet";

export type AccentTheme = { gradient: string; border: string; iconBg: string; iconText: string; label: string; value: string; caption: string };

export const accentClasses: Record<AccentColor, AccentTheme> = {
  indigo: {
    gradient: "from-indigo-50/80 via-white to-indigo-50/30",
    border: "border-indigo-200/70",
    iconBg: "bg-indigo-100/80",
    iconText: "text-indigo-700",
    label: "text-indigo-900",
    value: "text-indigo-950",
    caption: "text-indigo-700/80",
  },
  sky: {
    gradient: "from-sky-50/80 via-white to-sky-50/30",
    border: "border-sky-200/70",
    iconBg: "bg-sky-100/80",
    iconText: "text-sky-700",
    label: "text-sky-900",
    value: "text-sky-950",
    caption: "text-sky-700/80",
  },
  amber: {
    gradient: "from-amber-50/80 via-white to-amber-50/30",
    border: "border-amber-200/70",
    iconBg: "bg-amber-100/80",
    iconText: "text-amber-700",
    label: "text-amber-900",
    value: "text-amber-950",
    caption: "text-amber-700/80",
  },
  emerald: {
    gradient: "from-emerald-50/80 via-white to-emerald-50/30",
    border: "border-emerald-200/70",
    iconBg: "bg-emerald-100/80",
    iconText: "text-emerald-700",
    label: "text-emerald-900",
    value: "text-emerald-950",
    caption: "text-emerald-700/80",
  },
  purple: {
    gradient: "from-purple-50/80 via-white to-purple-50/30",
    border: "border-purple-200/70",
    iconBg: "bg-purple-100/80",
    iconText: "text-purple-700",
    label: "text-purple-900",
    value: "text-purple-950",
    caption: "text-purple-700/80",
  },
  rose: {
    gradient: "from-rose-50/80 via-white to-rose-50/30",
    border: "border-rose-200/70",
    iconBg: "bg-rose-100/80",
    iconText: "text-rose-700",
    label: "text-rose-900",
    value: "text-rose-950",
    caption: "text-rose-700/80",
  },
  violet: {
    gradient: "from-violet-50/80 via-white to-violet-50/30",
    border: "border-violet-200/70",
    iconBg: "bg-violet-100/80",
    iconText: "text-violet-700",
    label: "text-violet-900",
    value: "text-violet-950",
    caption: "text-violet-700/80",
  },
};

/** Single gradient KPI tile, styled after the Pipeline page's metrics strip. */
export function MetricCard({
  label, value, caption, icon: Icon, color = "indigo", className = "",
}: {
  label: string; value: ReactNode; caption?: string; icon?: React.ElementType; color?: AccentColor; className?: string;
}) {
  const a = accentClasses[color];
  return (
    <div className={`p-3.5 rounded-xl bg-gradient-to-br ${a.gradient} border ${a.border} shadow-xs ${className}`}>
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className={`text-[11px] font-bold uppercase tracking-wider ${a.label}`}>{label}</span>
        {Icon && (
          <div className={`w-5 h-5 rounded-md ${a.iconBg} flex items-center justify-center ${a.iconText}`}>
            <Icon size={11} />
          </div>
        )}
      </div>
      <div className={`font-mono-num text-base md:text-lg font-bold ${a.value}`}>{value}</div>
      {caption && <div className={`text-[10px] ${a.caption} mt-0.5 font-medium`}>{caption}</div>}
    </div>
  );
}

/** Responsive strip container for a row of MetricCards. */
export function MetricStrip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 ${className}`}>
      {children}
    </div>
  );
}

export function BackButton({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`inline-flex items-center justify-center rounded-lg p-1.5 hover:bg-[var(--ink-100)] transition-colors ${className}`}
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
    <div className="flex items-center justify-between px-8 pt-7 pb-5">
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

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl border shadow-xs transition-colors ${className}`}
      style={{ borderColor: "var(--ink-100)", background: "white", ...style }}
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
  // Prevent accidental form submit on Enter key inside input textboxes across all modals
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "SELECT") {
        e.preventDefault();
        target.blur();
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,23,26,0.5)" }} onClick={onClose}>
      <div
        className="rounded-xl bg-white shadow-2xl w-full max-h-[88vh] overflow-y-auto"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-20" style={{ borderColor: "var(--ink-100)" }}>
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

export function Field({ label, children, required }: { label: ReactNode; children: ReactNode; required?: boolean }) {
  return (
    <label className="block mb-3.5">
      {/* inline-flex so a required "*" never wraps onto its own line after a
          custom label (e.g. label text + an info icon) -- it stays on the
          same row as the label content, keeping side-by-side fields aligned. */}
      <div className="flex items-center gap-1 text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>
        {label} {required && <span style={{ color: "var(--rose-600)" }}>*</span>}
      </div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2 rounded-md border text-sm outline-none focus:ring-2 focus:ring-[var(--ledger-500)]";
export const inputStyle: React.CSSProperties = { borderColor: "var(--ink-200)" };

export function ConfirmModal({
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  isOpen,
  onConfirm,
  onClose,
  isSubmitting = false,
}: {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "secondary";
  isOpen: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
}) {
  if (!isOpen) return null;
  return (
    <Modal title={title} onClose={onClose} width="440px">
      <div className="space-y-4">
        <div className="text-sm text-[var(--ink-700)] leading-relaxed">
          {message}
        </div>
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Processing…" : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

