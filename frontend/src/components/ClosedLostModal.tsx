import { useState } from "react";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { api } from "../lib/api";
import { XCircle, AlertCircle } from "lucide-react";

interface ClosedLostModalProps {
  opportunity: any;
  targetStageId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClosedLostModal({ opportunity, targetStageId, onClose, onSuccess }: ClosedLostModalProps) {
  const [lostReason, setLostReason] = useState(opportunity.lostReason || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostReason.trim()) {
      setError("A non-empty Lost Reason is mandatory to mark an opportunity Closed Lost.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.patch(`/opportunities/${opportunity.id}`, {
        stageId: targetStageId,
        lostReason: lostReason.trim(),
        forecastCategory: "CLOSED_LOST",
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to mark opportunity Closed Lost");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Mark Opportunity as Closed Lost" onClose={onClose} width="480px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-950 flex items-start gap-2.5">
          <XCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Closed Lost Reason Required</div>
            <div>Please state the primary reason this opportunity was lost or cancelled for auditing and pipeline analytics.</div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            Reason for Loss <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            value={lostReason}
            onChange={(e) => setLostReason(e.target.value)}
            placeholder="e.g. Budget constraints, chosen competitor, project postponed indefinitely…"
            rows={4}
            className={`${inputClass} resize-none leading-relaxed text-xs`}
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Confirm Closed Lost"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
