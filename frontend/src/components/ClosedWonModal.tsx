import { useState } from "react";
import { Modal, Button, inputClass, inputStyle } from "./ui";
import { api } from "../lib/api";
import { Trophy, Upload, FileCheck, X, AlertCircle } from "lucide-react";
import { useAuth } from "../hooks/useAuth";

interface ClosedWonModalProps {
  opportunity: any;
  targetStageId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ClosedWonModal({ opportunity, targetStageId, onClose, onSuccess }: ClosedWonModalProps) {
  const { user } = useAuth();
  const isManager = user?.orgRole === "MANAGER";

  const [poNumber, setPoNumber] = useState(opportunity.poNumber || "");
  const [poValue, setPoValue] = useState(
    opportunity.poValue !== null && opportunity.poValue !== undefined
      ? String(opportunity.poValue)
      : String(opportunity.amount || "")
  );
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState<{ filename: string; size: number; mimeType: string }[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !files.length) return;

    const newFiles: { filename: string; size: number; mimeType: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      newFiles.push({
        filename: f.name,
        size: f.size,
        mimeType: f.type || "application/octet-stream",
      });
    }
    setAttachments((prev) => [...prev, ...newFiles]);
    setUploadNotice("Attachment staged ready for upload.");
  };

  const removeAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numPoValue = Number(poValue);
    if (isNaN(numPoValue) || numPoValue <= 0) {
      setError("A valid positive Proposal / PO Value is required to close this opportunity.");
      return;
    }

    if (!attachments.length) {
      setError("An attachment (Purchase Order / LOE / Client Confirmation) is required to mark this opportunity Closed Won.");
      return;
    }

    setIsSubmitting(true);
    try {
      const patchRes = await api.patch(`/opportunities/${opportunity.id}`, {
        stageId: targetStageId,
        poNumber: poNumber.trim() || undefined,
        poValue: numPoValue,
        actualOpportunityValue: numPoValue,
        loeValue: attachments[0]?.filename || "LOE Attached",
        remarks: remarks.trim() || undefined,
      });

      const stageApprovalId = patchRes.data?.approval?.id || null;

      for (const att of attachments) {
        await api.post(`/opportunities/${opportunity.id}/attachments`, {
          originalFilename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          stageApprovalId: stageApprovalId,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Failed to mark opportunity Closed Won");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Mark Opportunity as Closed Won" onClose={onClose} width="540px">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2.5">
          <Trophy size={18} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Opportunity Close Requirements</div>
            <div>
              {isManager
                ? "Upload the Purchase Order (PO) or Letter of Engagement (LOE) / client confirmation and enter the PO value to create a Stage Approval request for Partner sign-off."
                : "Upload the Purchase Order (PO) or Letter of Engagement (LOE) / client confirmation and enter the PO value to mark this opportunity Closed Won."}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Mandatory Attachment (PO / LOE / Client Confirmation) */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            Purchase Order (PO) / Client Confirmation Attachment <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-[var(--ink-500)] mb-1.5">
            Upload Purchase Order (PO). If PO is not yet received, upload Letter of Engagement (LOE), client email confirmation screenshot, PDF, DOCX, or image document.
          </p>
          <div className="p-3.5 border-2 border-dashed border-[var(--ink-200)] rounded-xl text-center hover:bg-[var(--ink-50)] transition-colors">
            <input
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="close-won-file-upload"
            />
            <label htmlFor="close-won-file-upload" className="cursor-pointer flex flex-col items-center gap-1">
              <Upload size={20} className="text-[var(--ledger-600)]" />
              <span className="text-xs font-semibold text-[var(--ledger-700)]">Click to upload Purchase Order (PO) or LOE</span>
              <span className="text-[10px] text-[var(--ink-400)]">PDF, DOCX, Images, Email Confirmation</span>
            </label>
          </div>

          {uploadNotice && (
            <div className="mt-1 text-[11px] text-emerald-600 font-medium">{uploadNotice}</div>
          )}

          {attachments.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <FileCheck size={14} className="text-emerald-600 shrink-0" />
                    <span className="font-medium truncate text-emerald-950">{att.filename}</span>
                    <span className="text-[10px] text-emerald-700">({Math.round(att.size / 1024)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-[var(--ink-400)] hover:text-rose-600 p-0.5"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PO Value (Mandatory) */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            PO / Proposal Value (₹) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-[var(--ink-500)] text-xs">₹</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              value={poValue}
              onChange={(e) => setPoValue(e.target.value)}
              placeholder="e.g. 1000000"
              className={`${inputClass} pl-7 font-mono-num`}
              style={inputStyle}
            />
          </div>
        </div>

        {/* PO Number (Optional - Can be put later) */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            PO Number <span className="text-[var(--ink-400)] font-normal">(Optional — can be added later)</span>
          </label>
          <input
            type="text"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="e.g. PO-2026-9812 (or leave blank if pending)"
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {/* Remarks / Comments */}
        <div>
          <label className="block text-xs font-semibold mb-1 text-[var(--ink-700)]">
            Closing Remarks / Comments
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Add any additional notes about this opportunity closure…"
            rows={2}
            className={`${inputClass} resize-none`}
            style={inputStyle}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ink-100)]">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "Submitting…"
              : isManager
              ? "Submit for Partner Approval"
              : "Confirm Closed Won"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
