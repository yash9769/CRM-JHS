import { prisma } from "./prisma.js";
import type { AuthUser } from "../plugins/auth.js";

/**
 * Returns the list of user IDs whose records are visible to `user`.
 *
 * SENIOR_PARTNER → all user IDs in the tenant
 * PARTNER        → self + IDs of all Managers whose partnerId = self.id
 * MANAGER        → only self
 */
export async function getVisibleUserIds(user: AuthUser): Promise<string[]> {
  if (user.orgRole === "SENIOR_PARTNER") {
    const all = await prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true },
    });
    return all.map((u) => u.id);
  }

  if (user.orgRole === "PARTNER") {
    const managers = await prisma.user.findMany({
      where: { tenantId: user.tenantId, partnerId: user.id },
      select: { id: true },
    });
    return [user.id, ...managers.map((m) => m.id)];
  }

  // MANAGER — can only see their own records
  return [user.id];
}

/**
 * Returns a Prisma `where` fragment that restricts entity queries to records
 * created by users visible to `user`.
 *
 * IMPORTANT: the returned fragment contains an `OR` key. NEVER spread it into
 * the same object literal as another conditional filter that also produces an
 * `OR` key (a `search` clause, a `won` clause, a date window, ...) — in a JS
 * object literal the later `OR` silently REPLACES the earlier one, deleting the
 * RBAC restriction with no error. Always compose with `AND`, which is an array
 * and therefore cannot collide:
 *
 *   const rbacFilter = await getCreatedByFilter(req.authUser);
 *   const where: any = { tenantId: ..., AND: [rbacFilter] };
 *   if (q.search) where.AND.push({ OR: [ ...search clauses... ] });
 */
export async function getCreatedByFilter(user: AuthUser): Promise<any> {
  if (user.orgRole === "SENIOR_PARTNER") return {}; // no restriction
  const ids = await getVisibleUserIds(user);
  return {
    OR: [
      { createdById: { in: ids } },
      { ownerId: { in: ids } },
    ],
  };
}

/**
 * Throws a 403-compatible error if `user` is not allowed to read/write `record`.
 */
export async function requireCanAccess(
  user: AuthUser,
  record: { createdById?: string | null; ownerId?: string | null },
  _action: "read" | "write" = "read"
) {
  if (user.orgRole === "SENIOR_PARTNER") return;

  const visibleIds = await getVisibleUserIds(user);
  const createdByIdMatch = record.createdById && visibleIds.includes(record.createdById);
  const ownerIdMatch = record.ownerId && visibleIds.includes(record.ownerId);

  if (!createdByIdMatch && !ownerIdMatch) {
    const err: any = new Error("Access denied: You do not have permission to view or edit this record.");
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Checks whether `actorUser` can create or manage `targetUser` based on hierarchy rules.
 *
 * Rules:
 *  - SENIOR_PARTNER can create/manage Partners and Managers
 *  - PARTNER can create/manage only Managers whose partnerId = self.id
 *  - MANAGER cannot manage any user
 */
export function canManageUser(
  actor: AuthUser,
  targetOrgRole: "SENIOR_PARTNER" | "PARTNER" | "MANAGER",
  targetPartnerId?: string | null
): boolean {
  if (actor.orgRole === "SENIOR_PARTNER") {
    // SP can create Partners or Managers, but not another SP
    return targetOrgRole !== "SENIOR_PARTNER";
  }
  if (actor.orgRole === "PARTNER") {
    // Partner can only create/manage Managers who report to them
    return targetOrgRole === "MANAGER" && targetPartnerId === actor.id;
  }
  return false; // MANAGER cannot manage users
}

/**
 * Throws a 403 error if `user` does not have permission to export CRM data.
 * Rule: MANAGER role cannot export or download CRM datasets.
 * PARTNER and SENIOR_PARTNER are permitted.
 */
export function requireExportPermission(user: AuthUser) {
  if (user.orgRole === "MANAGER") {
    const err: any = new Error("Access denied: Managers are not authorized to export or download dataset records.");
    err.statusCode = 403;
    throw err;
  }
}

