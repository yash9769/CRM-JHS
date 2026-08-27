import { api } from "./api";
import type { RelationshipOption } from "../components/RelationshipSelector";

export async function fetchAccountOptions(search: string): Promise<RelationshipOption[]> {
  const { data } = await api.get("/accounts", { params: { search, pageSize: 8, sortBy: "name", sortDir: "asc" } });
  return data.data.map((a: any) => ({
    id: a.id,
    label: a.name,
    sublabel: a.domain || a.industry || undefined,
    ownerId: a.ownerId || (a.owner?.id ?? null),
    ownerLabel: a.owner ? `${a.owner.firstName} ${a.owner.lastName}` : null,
  }));
}

export async function fetchContactOptions(search: string, accountId?: string): Promise<RelationshipOption[]> {
  const { data } = await api.get("/contacts", { params: { search, pageSize: 8, ...(accountId ? { accountId } : {}) } });
  return data.data.map((c: any) => ({
    id: c.id,
    label: `${c.firstName} ${c.lastName}`,
    sublabel: c.jobTitle ? `${c.jobTitle} · ${c.account?.name || c.email || ""}` : (c.email || c.account?.name || undefined),
    accountId: c.accountId || (c.account?.id ?? null),
    accountLabel: c.account?.name || null,
  }));
}

export async function fetchOpportunityOptions(search: string, accountId?: string): Promise<RelationshipOption[]> {
  const { data } = await api.get("/opportunities", { params: { search, pageSize: 8, ...(accountId ? { accountId } : {}) } });
  return data.data.map((o: any) => ({ id: o.id, label: o.name, sublabel: o.account?.name || undefined }));
}

let userCache: RelationshipOption[] | null = null;
export async function fetchOwnerOptions(search: string): Promise<RelationshipOption[]> {
  if (!userCache) {
    const { data } = await api.get("/users");
    userCache = data.data.map((u: any) => ({ id: u.id, label: `${u.firstName} ${u.lastName}`, sublabel: u.email }));
  }
  const q = search.trim().toLowerCase();
  const list = userCache || [];
  if (!q) return list.slice(0, 8);
  return list.filter((u) => u.label.toLowerCase().includes(q) || u.sublabel?.toLowerCase().includes(q)).slice(0, 8);
}
