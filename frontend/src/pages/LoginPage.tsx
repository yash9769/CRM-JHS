import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type LoginResult } from "../hooks/useAuth";
import { inputClass, inputStyle } from "../components/ui";
import { ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const { login, completeTotpSetup, completeTotpChallenge } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginResult>({ status: "authenticated" });
  const [started, setStarted] = useState(false);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email, password);
      setStarted(true);
      if (result.status === "authenticated") {
        navigate("/");
      } else {
        setStep(result);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (step.status === "totp_setup") {
        await completeTotpSetup(step.setupToken, code);
      } else if (step.status === "totp_challenge") {
        await completeTotpChallenge(step.challengeToken, code);
      }
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Incorrect code — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const showTotp = started && (step.status === "totp_setup" || step.status === "totp_challenge");

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ink-950)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/envista_logo.png" alt="Envista Cyber Defence" className="h-16 md:h-20 max-w-[280px] object-contain drop-shadow-md" />
        </div>

        <div className="bg-white rounded-xl p-7 shadow-2xl">
          {!showTotp ? (
            <>
              <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--ink-900)" }}>Welcome back</h1>
              <p className="text-sm mb-5" style={{ color: "var(--ink-500)" }}>Sign in to your sales workspace.</p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-md text-sm" style={{ background: "var(--rose-100)", color: "var(--rose-600)" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleCredentialsSubmit}>
                <label className="block mb-3.5">
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Email</div>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={inputStyle} placeholder="you@company.com" />
                </label>
                <label className="block mb-5">
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Password</div>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} style={inputStyle} placeholder="••••••••" />
                </label>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--ledger-600)" }}
                >
                  {loading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            </>
          ) : step.status === "totp_setup" ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} style={{ color: "var(--ledger-600)" }} />
                <h1 className="text-lg font-semibold" style={{ color: "var(--ink-900)" }}>Set up your authenticator</h1>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
                Scan this QR code with Google Authenticator, Authy, 1Password, or any TOTP app, then enter the 6-digit code it shows.
              </p>

              <div className="flex justify-center mb-4">
                <img src={step.qrCodeDataUrl} alt="Authenticator QR code" className="w-40 h-40 rounded-lg border" style={{ borderColor: "var(--ink-100)" }} />
              </div>

              <div className="mb-4 px-3 py-2 rounded-md text-center" style={{ background: "var(--ink-50)" }}>
                <div className="text-[10px] font-medium uppercase tracking-wide mb-1" style={{ color: "var(--ink-400)" }}>Can't scan? Enter this key manually</div>
                <code className="text-xs font-mono-num break-all" style={{ color: "var(--ink-700)" }}>{step.secret}</code>
              </div>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-md text-sm" style={{ background: "var(--rose-100)", color: "var(--rose-600)" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleTotpSubmit}>
                <label className="block mb-5">
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>6-digit code</div>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${inputClass} text-center tracking-[0.5em] font-mono-num text-lg`} style={inputStyle} placeholder="000000"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--ledger-600)" }}
                >
                  {loading ? "Verifying…" : "Verify & sign in"}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck size={18} style={{ color: "var(--ledger-600)" }} />
                <h1 className="text-lg font-semibold" style={{ color: "var(--ink-900)" }}>Enter your authenticator code</h1>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--ink-500)" }}>
                For your security, sign-in requires a fresh code from your authenticator app every 7 days.
              </p>

              {error && (
                <div className="mb-4 px-3 py-2 rounded-md text-sm" style={{ background: "var(--rose-100)", color: "var(--rose-600)" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleTotpSubmit}>
                <label className="block mb-5">
                  <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>6-digit code</div>
                  <input
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${inputClass} text-center tracking-[0.5em] font-mono-num text-lg`} style={inputStyle} placeholder="000000"
                  />
                </label>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
                  style={{ background: "var(--ledger-600)" }}
                >
                  {loading ? "Verifying…" : "Verify & sign in"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
