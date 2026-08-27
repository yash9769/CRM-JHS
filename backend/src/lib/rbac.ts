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
 * Usage:
 *   const rbacFilter = await getCreatedByFilter(req.authUser);
 *   const where = { tenantId: ..., ...rbacFilter, ... };
 */
export async function getCreatedByFilter(user: AuthUser): Promise<{ createdById?: { in: string[] } }> {
  if (user.orgRole === "SENIOR_PARTNER") return {}; // no restriction
  const ids = await getVisibleUserIds(user);
  return { createdById: { in: ids } };
}

/**
 * Throws a 403-compatible error if `user` is not allowed to read/write `record`.
 *
 * `record.createdById` — the user ID that created the record.
 * Senior Partners can always access. Partners can access own + their managers'.
 * Managers can only access their own.
 */
export async function requireCanAccess(
  user: AuthUser,
  record: { createdById?: string | null },
  _action: "read" | "write" = "read"
) {
  if (user.orgRole === "SENIOR_PARTNER") return;

  if (!record.createdById) return; // legacy/null records — allow for now

  const visibleIds = await getVisibleUserIds(user);
  if (!visibleIds.includes(record.createdById)) {
    const err: any = new Error("Access denied");
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
