import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Building2 } from "lucide-react";
import { api, getActiveTenantId, setActiveTenantId } from "../lib/api";
import { useClickOutside } from "../hooks/useClickOutside";

interface TenantOption {
  id: string;
  name: string;
  _count: { users: number };
}

/**
 * SUPER_ADMIN-only control: lets the platform admin pick which tenant's data
 * every subsequent request should operate on (see plugins/auth.ts's
 * x-active-tenant-id header handling on the backend). Switching invalidates
 * every query so the whole app immediately reflects the new tenant.
 */
export function TenantSwitcher({ currentTenantName }: { currentTenantName?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  const { data } = useQuery<{ data: TenantOption[] }>({
    queryKey: ["tenants"],
    queryFn: async () => (await api.get("/tenants")).data,
    enabled: open,
  });

  function selectTenant(tenantId: string | null) {
    setActiveTenantId(tenantId);
    setOpen(false);
    qc.invalidateQueries();
  }

  const activeTenantId = getActiveTenantId();

  return (
    <div ref={ref} className="relative px-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium text-[var(--ink-300)] hover:bg-[var(--ink-900)] hover:text-white transition-colors"
        title="Switch tenant (Super Admin)"
      >
        <span className="flex items-center gap-1.5 truncate">
          <Building2 size={12} className="shrink-0 text-[var(--ledger-500)]" />
          <span className="truncate">{currentTenantName || "Select tenant…"}</span>
        </span>
        <ChevronDown size={12} className="shrink-0" />
      </button>

      {open && (
        <div className="absolute bottom-full left-1 mb-1 w-64 max-h-72 overflow-y-auto rounded-lg bg-white border border-[var(--ink-200)] shadow-xl py-1 z-50">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-400)]">
            Viewing as Super Admin
          </div>
          {data?.data.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTenant(t.id)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-[var(--ink-50)] ${
                activeTenantId === t.id ? "font-semibold text-[var(--ledger-700)]" : "text-[var(--ink-800)]"
              }`}
            >
              <span className="truncate">{t.name}</span>
              <span className="text-[10px] text-[var(--ink-400)] shrink-0 ml-2">{t._count.users} users</span>
            </button>
          ))}
          {!data && <div className="px-3 py-2 text-xs text-[var(--ink-400)]">Loading tenants…</div>}
        </div>
      )}
    </div>
  );
}
