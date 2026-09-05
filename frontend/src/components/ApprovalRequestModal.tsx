import { useState } from "react";
import { Modal, Button } from "./ui";
import { formatCurrency } from "../lib/format";
import { ShieldAlert, ArrowRight } from "lucide-react";

interface ApprovalRequestModalProps {
  opportunity: {
    id: string;
    name: string;
    amount: string | number;
    account?: { name: string } | null;
  };
  fromStage: { id: string; name: string };
  toStage: { id: string; name: string };
  onSubmit: (notes?: string) => Promise<void> | void;
  onClose: () => void;
  isSubmitting?: boolean;
}

export function ApprovalRequestModal({
  opportunity,
  fromStage,
  toStage,
  onSubmit,
  onClose,
  isSubmitting = false,
}: ApprovalRequestModalProps) {
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(notes.trim() || undefined);
  };

  return (
    <Modal title="Approval Required" onClose={onClose} width="480px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--gold-50)] border border-[var(--gold-200)] text-xs text-[var(--gold-900)]">
          <ShieldAlert size={20} className="text-[var(--gold-600)] shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm">Partner Approval Needed</div>
            <p className="mt-0.5 text-[var(--ink-600)]">
              Moving an opportunity into <strong>{toStage.name}</strong> requires Partner approval. The opportunity will remain in <strong>{fromStage.name}</strong> until approved.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)] space-y-2 text-xs">
          <div className="font-bold text-sm text-[var(--ink-900)]">{opportunity.name}</div>
          <div className="flex items-center justify-between text-[var(--ink-600)]">
            <span><strong>Account:</strong> {opportunity.account?.name || "—"}</span>
            <span><strong>Value:</strong> {formatCurrency(opportunity.amount)}</span>
          </div>

          <div className="pt-2 border-t border-[var(--ink-100)] flex items-center justify-between font-semibold">
            <span className="text-[var(--ink-500)] line-through">{fromStage.name}</span>
            <ArrowRight size={14} className="text-[var(--ink-400)]" />
            <span className="px-2 py-0.5 rounded bg-[var(--ledger-100)] text-[var(--ledger-800)]">
              {toStage.name}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--ink-700)]">
            Requester Note / Justification (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Add context or notes for the reviewing Partner..."
            className="w-full p-2.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--ledger-600)] border-[var(--ink-200)] bg-[var(--surface-raised)]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Submit for Approval"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
