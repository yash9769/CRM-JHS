import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../lib/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "SALES_MANAGER" | "SALES_REP" | "VIEWER";
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

  async function fetchMe() {
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
      setTenant(res.data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
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
