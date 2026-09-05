import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { inputClass, inputStyle } from "../components/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ink-950)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/envista_logo.png" alt="Envista Cyber Defence" className="h-16 md:h-20 max-w-[280px] object-contain drop-shadow-md" />
        </div>

        <div className="bg-[var(--surface-raised)] rounded-xl p-7 shadow-2xl">
          <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--ink-900)" }}>Welcome back</h1>
          <p className="text-sm mb-5" style={{ color: "var(--ink-500)" }}>Sign in to your sales workspace.</p>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-md text-sm" style={{ background: "var(--rose-100)", color: "var(--rose-600)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
        </div>

        <p className="text-center text-sm mt-5" style={{ color: "var(--ink-400)" }}>
          New here? <Link to="/register" className="font-medium" style={{ color: "var(--ledger-500)" }}>Create a workspace</Link>
        </p>
      </div>
    </div>
  );
}
