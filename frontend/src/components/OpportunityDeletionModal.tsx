import { useState } from "react";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { api } from "../lib/api";
import { AlertTriangle, Trash2, Send } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface OpportunityDeletionModalProps {
  opportunity: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function OpportunityDeletionModal({ opportunity, onClose, onSuccess }: OpportunityDeletionModalProps) {
  const { user } = useAuth();
  const isManager = user?.orgRole === "MANAGER";

  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isManager && !reason.trim()) {
      setError("Please provide a reason for the deletion request.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isManager) {
        // Raise Deletion Request for Senior Partner / Partner Approval
        await api.post(`/opportunities/${opportunity.id}/deletion-request`, {
          reason: reason.trim(),
        });
      } else {
        // Direct Delete by Partner / Senior Partner
        await api.delete(`/opportunities/${opportunity.id}`);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to process opportunity deletion");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isManager ? "Request Opportunity Deletion" : "Delete Opportunity"}
      onClose={onClose}
      width="480px"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">
              {isManager ? "Partner Approval Required for Deletion" : "Permanent Opportunity Deletion"}
            </div>
            <div>
              {isManager
                ? `As a Manager, deleting an opportunity requires Partner approval. Submitting this request will notify your Partner for review with your reason.`
                : `Deleting "${opportunity.name}" will permanently remove this opportunity and all associated items. This action cannot be undone.`}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {error}
          </div>
        )}

        {isManager && (
          <div>
            <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
              Reason for Deletion <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this opportunity needs to be deleted (e.g. Created in error, Duplicate deal)…"
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="submit"
            disabled={isSubmitting || (isManager && !reason.trim())}
          >
            {isSubmitting
              ? "Processing…"
              : isManager
              ? (
                <span className="flex items-center gap-1.5">
                  <Send size={14} /> Submit Request
                </span>
              )
              : (
                <span className="flex items-center gap-1.5">
                  <Trash2 size={14} /> Permanently Delete
                </span>
              )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
