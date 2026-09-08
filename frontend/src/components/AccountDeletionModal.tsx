import { useState } from "react";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { api } from "../lib/api";
import { AlertTriangle, Trash2, Send } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface AccountDeletionModalProps {
  account: { id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

export function AccountDeletionModal({ account, onClose, onSuccess }: AccountDeletionModalProps) {
  const { user } = useAuth();
  const isManager = user?.orgRole === "MANAGER";

  const [confirmName, setConfirmName] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNameMatching = confirmName.trim() === account.name.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isNameMatching) {
      setError(`Account name does not match "${account.name}". Please type it exactly.`);
      return;
    }

    if (isManager && !reason.trim()) {
      setError("Please provide a reason for the deletion request.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isManager) {
        // Raise Deletion Request for Senior Partner / Partner Approval
        await api.post(`/accounts/${account.id}/deletion-request`, {
          reason: reason.trim(),
          confirmName: confirmName.trim(),
        });
      } else {
        // Direct Delete by Partner / Senior Partner
        await api.delete(`/accounts/${account.id}`, {
          data: { confirmName: confirmName.trim() },
        });
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to process account deletion");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={isManager ? "Request Account Deletion" : "Delete Account"}
      onClose={onClose}
      width="480px"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold mb-0.5">
              {isManager ? "Partner Approval Required" : "Permanent Account Deletion"}
            </div>
            <div>
              {isManager
                ? `As a Manager, submitting this request will notify your Senior Partner for approval. The account "${account.name}" will remain active until approved.`
                : `Deleting "${account.name}" will permanently remove all associated records. This action cannot be undone.`}
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
              placeholder="Explain why this account needs to be deleted (e.g. Created by mistake, Duplicate account)…"
              rows={3}
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            Type Account Name to Confirm <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-[var(--ink-500)] mb-1.5">
            To confirm, please type <span className="font-bold text-[var(--ink-900)]">"{account.name}"</span> below.
          </p>
          <input
            type="text"
            required
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={account.name}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="submit"
            disabled={isSubmitting || !isNameMatching || (isManager && !reason.trim())}
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
