import { Modal, Button } from "./ui";
import { formatCurrency } from "../lib/format";

export function ConfirmStageChangeModal({
  opportunityName,
  fromStageName,
  toStageName,
  amount,
  onConfirm,
  onClose,
  isPending,
}: {
  opportunityName: string;
  fromStageName: string;
  toStageName: string;
  amount?: number | string | null;
  onConfirm: () => void;
  onClose: () => void;
  isPending?: boolean;
}) {
  return (
    <Modal title="Confirm Stage Change" onClose={onClose} width="460px">
      <div className="space-y-4">
        <p className="text-sm text-[var(--ink-700)]">
          Are you sure you want to change the stage for <strong>"{opportunityName}"</strong>?
        </p>

        <div className="p-3.5 rounded-xl bg-[var(--ink-50)] border border-[var(--ink-100)] space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[var(--ink-500)]">Current Stage:</span>
            <span className="font-semibold text-[var(--ink-800)]">{fromStageName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--ink-500)]">New Stage:</span>
            <span className="font-bold text-[var(--ledger-700)]">{toStageName}</span>
          </div>
          {amount !== undefined && amount !== null && (
            <div className="flex items-center justify-between pt-1.5 border-t border-[var(--ink-200)]">
              <span className="text-[var(--ink-500)]">Proposal Value:</span>
              <span className="font-mono-num font-bold text-[var(--ink-900)]">{formatCurrency(amount)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Updating…" : "Confirm Stage Change"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
