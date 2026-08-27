import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  orgRole: "SENIOR_PARTNER" | "PARTNER" | "MANAGER";
  partnerId?: string | null;
  partner?: { id: string; firstName: string; lastName: string } | null;
}
export interface Tenant {
  id: string;
  name: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { companyName: string; firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
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

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });
    localStorage.setItem("crm_token", res.data.token);
    setUser(res.data.user);
    await fetchMe();
  }

  async function register(data: { companyName: string; firstName: string; lastName: string; email: string; password: string }) {
    const res = await api.post("/auth/register", data);
    localStorage.setItem("crm_token", res.data.token);
    setUser(res.data.user);
    setTenant(res.data.tenant);
    authActionIdRef.current++;
    setLoading(false);
  }

  function logout() {
    localStorage.removeItem("crm_token");
    setUser(null);
    setTenant(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, register, logout }}>
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
  return user?.orgRole === "SENIOR_PARTNER" || user?.orgRole === "PARTNER";
}
export function canViewOrgChart(user: AuthUser | null) {
  return user?.orgRole === "SENIOR_PARTNER" || user?.orgRole === "PARTNER";
}

/** Human-readable role label */
export function roleLabel(orgRole?: string) {
  if (orgRole === "SENIOR_PARTNER") return "Senior Partner";
  if (orgRole === "PARTNER") return "Partner";
  if (orgRole === "MANAGER") return "Manager";
  return orgRole || "—";
}
