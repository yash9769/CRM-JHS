import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Card, Button, inputClass, inputStyle } from "./ui";
import { PasswordInput } from "./PasswordInput";
import { KeyRound } from "lucide-react";

type Mode = "password" | "authenticator";

function errorMessage(err: any): string | null {
  if (!err) return null;
  if (err?.response?.status === 429) return "Too many attempts. Please wait 15 minutes and try again.";
  const data = err?.response?.data;
  const detail = Array.isArray(data?.details) ? data.details[0]?.message : null;
  return detail || data?.error || "Could not change your password. Please try again.";
}

export function ChangePasswordCard() {
  const [mode, setMode] = useState<Mode>("password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api.post(
        "/auth/change-password",
        mode === "password" ? { currentPassword, newPassword } : { totpCode, newPassword }
      ),
    onSuccess: () => {
      setCurrentPassword("");
      setTotpCode("");
      setNewPassword("");
      setConfirmPassword("");
      setChanged(true);
    },
  });

  function switchMode(next: Mode) {
    setMode(next);
    setFormError(null);
    setChanged(false);
    mutation.reset();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setChanged(false);
    if (mode === "authenticator" && !/^\d{6}$/.test(totpCode)) {
      setFormError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    if (newPassword.length < 8) {
      setFormError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("New passwords don't match.");
      return;
    }
    mutation.mutate();
  }

  const error = formError || errorMessage(mutation.error);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={15} className="text-[var(--ledger-600)]" />
        <h3 className="text-sm font-semibold text-[var(--ink-800)]">Change password</h3>
      </div>
      <p className="text-xs text-[var(--ink-500)] mb-4">
        {mode === "password"
          ? "Confirm your current password, then choose a new one."
          : "Forgot your current password? Enter the 6-digit code from your authenticator app instead."}
      </p>

      <form onSubmit={onSubmit} className="space-y-3 max-w-sm">
        {mode === "password" ? (
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Current password</label>
            <PasswordInput
              
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Authenticator code</label>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} font-mono tracking-widest`}
              style={inputStyle}
            />
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">New password</label>
          <PasswordInput
            
            autoComplete="new-password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
          <p className="text-[11px] mt-1 text-[var(--ink-400)]">At least 8 characters.</p>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1 text-[var(--ink-600)]">Confirm new password</label>
          <PasswordInput
            
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </div>

        {error && (
          <div className="text-xs px-3 py-2 rounded-md text-[var(--rose-600)] bg-[var(--rose-100)]">{error}</div>
        )}
        {changed && (
          <div className="text-xs px-3 py-2 rounded-md text-emerald-800 bg-emerald-50 border border-emerald-200">
            Password changed. Use your new password the next time you sign in.
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => switchMode(mode === "password" ? "authenticator" : "password")}
            className="text-xs font-medium hover:underline text-[var(--ledger-700)]"
          >
            {mode === "password" ? "Forgot your current password?" : "Use my current password instead"}
          </button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
