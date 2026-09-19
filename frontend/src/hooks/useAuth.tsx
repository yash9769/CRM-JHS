import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  orgRole: "SUPER_ADMIN" | "SENIOR_PARTNER" | "PARTNER" | "MANAGER";
  partnerId?: string | null;
  partner?: { id: string; firstName: string; lastName: string } | null;
}
export interface Tenant {
  id: string;
  name: string;
}

export type LoginResult =
  | { status: "authenticated" }
  | { status: "totp_setup"; setupToken: string; secret: string; otpauthUrl: string; qrCodeDataUrl: string }
  | { status: "totp_challenge"; challengeToken: string };

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  completeTotpSetup: (setupToken: string, code: string) => Promise<void>;
  completeTotpChallenge: (challengeToken: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const authActionIdRef = useRef(0);

  async function fetchMe() {
    const currentActionId = ++authActionIdRef.current;
    try {
      const res = await api.get("/auth/me");
      if (currentActionId === authActionIdRef.current) {
        setUser(res.data.user);
        setTenant(res.data.tenant);
      }
    } catch {
      if (currentActionId === authActionIdRef.current) {
        setUser(null);
        setTenant(null);
      }
    } finally {
      if (currentActionId === authActionIdRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("crm_token");
    if (token) fetchMe();
    else setLoading(false);
  }, []);

  async function applySession(token: string) {
    localStorage.setItem("crm_token", token);
    authActionIdRef.current++;
    await fetchMe();
  }

  async function login(email: string, password: string): Promise<LoginResult> {
    const res = await api.post("/auth/login", { email, password });
    if (res.data.requiresTotpSetup) {
      return {
        status: "totp_setup",
        setupToken: res.data.setupToken,
        secret: res.data.secret,
        otpauthUrl: res.data.otpauthUrl,
        qrCodeDataUrl: res.data.qrCodeDataUrl,
      };
    }
    if (res.data.requiresTotpChallenge) {
      return { status: "totp_challenge", challengeToken: res.data.challengeToken };
    }
    await applySession(res.data.token);
    return { status: "authenticated" };
  }

  async function completeTotpSetup(setupToken: string, code: string) {
    const res = await api.post("/auth/totp/setup-verify", { token: setupToken, code });
    await applySession(res.data.token);
  }

  async function completeTotpChallenge(challengeToken: string, code: string) {
    const res = await api.post("/auth/totp/challenge-verify", { token: challengeToken, code });
    await applySession(res.data.token);
  }

  function logout() {
    localStorage.removeItem("crm_token");
    setUser(null);
    setTenant(null);
    window.location.replace("/login");
  }

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, completeTotpSetup, completeTotpChallenge, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ---- RBAC helpers ----
export function isSuperAdmin(user: AuthUser | null) {
  return user?.orgRole === "SUPER_ADMIN";
}
export function isSeniorPartner(user: AuthUser | null) {
  return user?.orgRole === "SENIOR_PARTNER";
}
export function isPartner(user: AuthUser | null) {
  return user?.orgRole === "PARTNER";
}
export function isManager(user: AuthUser | null) {
  return user?.orgRole === "MANAGER";
}
export function canManageUsers(user: AuthUser | null) {
  return user?.orgRole === "SUPER_ADMIN" || user?.orgRole === "SENIOR_PARTNER" || user?.orgRole === "PARTNER";
}
export function canViewOrgChart(user: AuthUser | null) {
  return user?.orgRole === "SUPER_ADMIN" || user?.orgRole === "SENIOR_PARTNER" || user?.orgRole === "PARTNER";
}

/** Human-readable role label */
export function roleLabel(orgRole?: string) {
  if (orgRole === "SUPER_ADMIN") return "Super Admin";
  if (orgRole === "SENIOR_PARTNER") return "Senior Partner";
  if (orgRole === "PARTNER") return "Partner";
  if (orgRole === "MANAGER") return "Manager";
  return orgRole || "—";
}
