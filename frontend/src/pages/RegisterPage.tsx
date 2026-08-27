import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { inputClass, inputStyle } from "../components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: "", firstName: "", lastName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-10" style={{ background: "var(--ink-950)" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <img src="/envista_logo.png" alt="Envista Cyber Defence" className="h-16 md:h-20 max-w-[280px] object-contain drop-shadow-md" />
        </div>

        <div className="bg-white rounded-xl p-7 shadow-2xl">
          <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--ink-900)" }}>Create your workspace</h1>
          <p className="text-sm mb-5" style={{ color: "var(--ink-500)" }}>Set up your sales pipeline in under a minute.</p>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-md text-sm" style={{ background: "var(--rose-100)", color: "var(--rose-600)" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label className="block mb-3.5">
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Company name</div>
              <input name="companyName" required value={form.companyName} onChange={(e) => set("companyName", e.target.value)} className={inputClass} style={inputStyle} placeholder="Acme Technologies" />
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3.5">
              <label className="block">
                <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>First name</div>
                <input name="firstName" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputClass} style={inputStyle} placeholder="Jane" />
              </label>
              <label className="block">
                <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Last name</div>
                <input name="lastName" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputClass} style={inputStyle} placeholder="Doe" />
              </label>
            </div>
            <label className="block mb-3.5">
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Work email</div>
              <input name="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} className={inputClass} style={inputStyle} placeholder="you@company.com" />
            </label>
            <label className="block mb-5">
              <div className="text-xs font-medium mb-1.5" style={{ color: "var(--ink-600)" }}>Password</div>
              <input name="password" type="password" required minLength={8} value={form.password} onChange={(e) => set("password", e.target.value)} className={inputClass} style={inputStyle} placeholder="At least 8 characters" />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-md text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--ledger-600)" }}
            >
              {loading ? "Creating workspace…" : "Create workspace"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-5" style={{ color: "var(--ink-400)" }}>
          Already have an account? <Link to="/login" className="font-medium" style={{ color: "var(--ledger-500)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
