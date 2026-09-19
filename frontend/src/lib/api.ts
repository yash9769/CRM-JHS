import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
});

const ACTIVE_TENANT_KEY = "crm_active_tenant_id";

/** Only meaningful for a SUPER_ADMIN session -- see plugins/auth.ts's x-active-tenant-id handling. */
export function getActiveTenantId(): string | null {
  return localStorage.getItem(ACTIVE_TENANT_KEY);
}
export function setActiveTenantId(tenantId: string | null) {
  if (tenantId) localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
  else localStorage.removeItem(ACTIVE_TENANT_KEY);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("crm_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const activeTenantId = getActiveTenantId();
  if (activeTenantId) config.headers["x-active-tenant-id"] = activeTenantId;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem("crm_token");
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);
