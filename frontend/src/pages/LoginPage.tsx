import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, type LoginResult } from "../hooks/useAuth";
import { api } from "../lib/api";
import { inputClass, inputStyle } from "../components/ui";
import { PasswordInput } from "../components/PasswordInput";
import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, KeyRound, Loader2, Lock, Mail, ShieldCheck, TrendingUp, Users } from "lucide-react";

const PIPELINE_STAGES = [
  { name: "Lead" },
  { name: "Scope Discussion" },
  { name: "Proposal Sent" },
  { name: "Negotiation" },
  { name: "Closed Won", note: "PO number, value & attachment" },
];

const HIGHLIGHTS = [
  { icon: TrendingUp, text: "Pipeline, forecasts and win/loss in one view" },
  { icon: Users, text: "Partner approvals built into every stage change" },
  { icon: ShieldCheck, text: "Two-factor authentication on every account" },
];

function BrandPanel() {
  return (
    <aside
      className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 xl:p-14 text-white"
      style={{
        background:
          "radial-gradient(70% 55% at 0% 0%, rgba(23,151,111,0.28) 0%, transparent 60%), radial-gradient(60% 50% at 100% 100%, rgba(15,107,78,0.35) 0%, transparent 65%), var(--ink-950)",
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "radial-gradient(ellipse at 30% 40%, #000 0%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 30% 40%, #000 0%, transparent 75%)",
        }}
      />

      <div className="relative">
        <div className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 shadow-xl">
          <img src="/jhs_logo.png" alt="JHS CRM" className="h-10 max-w-[200px] object-contain" />
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-4xl xl:text-[2.75rem] font-semibold tracking-tight leading-[1.12]">
          Every deal, from first conversation to signed PO.
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-white/60 [@media(max-height:560px)]:hidden">
          One workspace for your opportunities, the approvals your firm needs, and a clear view of what's closing.
        </p>

        <ol className="relative mt-6 w-fit [@media(max-height:700px)]:hidden min-w-[18rem] rounded-2xl border border-white/10 bg-white/[0.04] p-5 pb-4 pr-10 backdrop-blur-sm">
          <div aria-hidden className="absolute left-[30px] top-[38px] bottom-[38px] w-px bg-white/15" />
          {PIPELINE_STAGES.map((stage, i) => {
            const last = i === PIPELINE_STAGES.length - 1;
            return (
              <li key={stage.name} className="relative flex items-start gap-3.5 py-2">
                <span
                  className={`relative z-10 mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    last ? "" : "border-2 bg-[var(--ink-950)]"
                  }`}
                  style={last ? { background: "var(--ledger-500)" } : { borderColor: "rgba(23,151,111,0.65)" }}
                >
                  {last && <Check size={12} strokeWidth={3} className="text-white" />}
                </span>
                <div>
                  <div className={`text-sm font-medium ${last ? "text-white" : "text-white/80"}`}>{stage.name}</div>
                  {stage.note && <div className="mt-0.5 text-xs text-[var(--ledger-100)]/60">{stage.note}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <ul className="relative space-y-2 [@media(max-height:780px)]:hidden">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-sm text-white/60">
            <Icon size={15} className="shrink-0 text-[var(--ledger-500)]" />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mb-3 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm"
      style={{ background: "var(--rose-100)", color: "var(--rose-600)", borderColor: "rgba(181,66,58,0.2)" }}
    >
      <AlertCircle size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function NoticeAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm"
      style={{ background: "var(--ledger-50)", color: "var(--ledger-700)", borderColor: "rgba(15,107,78,0.2)" }}
    >
      <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function SubmitButton({ loading, disabled, idle, busy }: { loading: boolean; disabled?: boolean; idle: string; busy: string }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="group inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition hover:brightness-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ledger-600)]"
      style={{ background: "var(--ledger-600)" }}
    >
      {loading ? (
        <>
          <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> {busy}
        </>
      ) : (
        <>
          {idle} <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </>
      )}
    </button>
  );
}

function CodeInput({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>6-digit code</div>
      <input
        type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} autoFocus required autoComplete="one-time-code"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        className={`${inputClass} py-2 text-center text-lg tracking-[0.5em] font-mono-num`} style={inputStyle} placeholder="000000"
      />
    </label>
  );
}

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
  const [view, setView] = useState<"signin" | "forgot">("signin");
  const [notice, setNotice] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

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

  function backToSignIn() {
    setStep({ status: "authenticated" });
    setStarted(false);
    setView("signin");
    setCode("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }

  function openForgot() {
    setView("forgot");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setNotice("");
  }

  async function handleForgotSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
    if (newPassword !== confirmPassword) return setError("The two passwords don't match.");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email, totpCode: code, newPassword });
      backToSignIn();
      setNotice("Password updated. Sign in with your new password.");
    } catch (err: any) {
      setError(
        err?.response?.status === 429
          ? "Too many attempts. Please wait 15 minutes and try again."
          : err?.response?.data?.error || "Could not reset your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const showTotp = started && (step.status === "totp_setup" || step.status === "totp_challenge");

  const backLink = (
    <button
      type="button"
      onClick={backToSignIn}
      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
      style={{ color: "var(--ink-500)" }}
    >
      <ArrowLeft size={14} /> Back to sign in
    </button>
  );

  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-[1.05fr_1fr]" style={{ background: "var(--paper)" }}>
      <BrandPanel />

      <main className="flex min-h-0 flex-col justify-center px-6 py-4 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-4 flex shrink-0 justify-center lg:hidden">
            <div className="inline-flex items-center rounded-xl bg-white px-4 py-2.5 shadow-md ring-1 ring-black/5">
              <img src="/jhs_logo.png" alt="JHS CRM" className="h-9 max-w-[180px] object-contain" />
            </div>
          </div>

          {view === "forgot" && !showTotp ? (
            <>
              <div
                className="mb-3 grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: "var(--ledger-50)", color: "var(--ledger-600)" }}
              >
                <KeyRound size={20} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>Reset your password</h1>
              <p className="mb-4 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
                Enter your email and the current 6-digit code from your authenticator app, then choose a new password.
              </p>

              {error && <ErrorAlert>{error}</ErrorAlert>}

              <form onSubmit={handleForgotSubmit}>
                <label className="mb-3 block">
                  <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>Email</div>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
                    <input
                      type="email" required autoComplete="username" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass} pl-10`} style={inputStyle} placeholder="you@company.com"
                    />
                  </div>
                </label>
                <CodeInput code={code} setCode={setCode} />
                <label className="mb-3 block">
                  <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>New password</div>
                  <PasswordInput
                    required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters"
                    icon={<Lock size={16} />}
                  />
                </label>
                <label className="mb-4 block">
                  <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>Confirm new password</div>
                  <PasswordInput
                    required autoComplete="new-password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter new password"
                    icon={<Lock size={16} />}
                  />
                </label>
                <SubmitButton loading={loading} disabled={code.length !== 6} idle="Reset password" busy="Resetting…" />
              </form>
              {backLink}
            </>
          ) : !showTotp ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>Welcome back</h1>
              <p className="mb-5 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>Sign in to your JHS CRM workspace.</p>

              {notice && <NoticeAlert>{notice}</NoticeAlert>}
              {error && <ErrorAlert>{error}</ErrorAlert>}

              <form onSubmit={handleCredentialsSubmit}>
                <label className="mb-3 block">
                  <div className="mb-1.5 text-xs font-medium" style={{ color: "var(--ink-600)" }}>Email</div>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-400)]" />
                    <input
                      type="email" required autoFocus autoComplete="username" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`${inputClass} pl-10`} style={inputStyle} placeholder="you@company.com"
                    />
                  </div>
                </label>
                <div className="mb-5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-medium" style={{ color: "var(--ink-600)" }}>Password</label>
                    <button
                      type="button" onClick={openForgot}
                      className="text-xs font-medium hover:underline" style={{ color: "var(--ledger-700)" }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <PasswordInput
                    id="login-password" required autoComplete="current-password" value={password}
                    onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                    icon={<Lock size={16} />}
                  />
                </div>
                <SubmitButton loading={loading} idle="Sign in" busy="Signing in…" />
              </form>

            </>
          ) : step.status === "totp_setup" ? (
            <>
              <div
                className="mb-3 grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: "var(--ledger-50)", color: "var(--ledger-600)" }}
              >
                <ShieldCheck size={20} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>Set up your authenticator</h1>
              <p className="mb-3 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
                Scan this QR code with Google Authenticator, Authy, 1Password, or any TOTP app, then enter the 6-digit code it shows.
              </p>

              <div className="mb-3 flex justify-center">
                <img src={step.qrCodeDataUrl} alt="Authenticator QR code" className="h-32 w-32 rounded-xl border bg-white p-2" style={{ borderColor: "var(--ink-100)" }} />
              </div>

              <div className="mb-3 rounded-lg px-3 py-2 text-center" style={{ background: "var(--ink-50)" }}>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-400)" }}>Can't scan? Enter this key manually</div>
                <code className="break-all text-xs font-mono-num" style={{ color: "var(--ink-700)" }}>{step.secret}</code>
              </div>

              {error && <ErrorAlert>{error}</ErrorAlert>}

              <form onSubmit={handleTotpSubmit}>
                <CodeInput code={code} setCode={setCode} />
                <SubmitButton loading={loading} disabled={code.length !== 6} idle="Verify & sign in" busy="Verifying…" />
              </form>
              {backLink}
            </>
          ) : (
            <>
              <div
                className="mb-3 grid h-9 w-9 place-items-center rounded-xl"
                style={{ background: "var(--ledger-50)", color: "var(--ledger-600)" }}
              >
                <ShieldCheck size={20} />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "var(--ink-900)" }}>Enter your authenticator code</h1>
              <p className="mb-4 mt-1 text-sm" style={{ color: "var(--ink-500)" }}>
                For your security, sign-in requires a fresh code from your authenticator app every 7 days.
              </p>

              {error && <ErrorAlert>{error}</ErrorAlert>}

              <form onSubmit={handleTotpSubmit}>
                <CodeInput code={code} setCode={setCode} />
                <SubmitButton loading={loading} disabled={code.length !== 6} idle="Verify & sign in" busy="Verifying…" />
              </form>
              {backLink}
            </>
          )}

          <p className="mt-5 text-center text-[11px]" style={{ color: "var(--ink-400)" }}>
            © {new Date().getFullYear()} JHS &amp; Associates LLP
          </p>
        </div>
      </main>
    </div>
  );
}
