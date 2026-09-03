import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { getVisibleUserIds, requireCanAccess } from "../lib/rbac.js";

/**
 * Loads the owner/creator fields of the record an audit-log query is scoped to,
 * so the caller's visibility can be checked before its audit trail is returned.
 *
 * Every objectType that `logAudit()` is called with anywhere in the backend is
 * mapped here (ACCOUNT, CONTACT, LEAD, OPPORTUNITY, QUOTE, ACTIVITY, SEQUENCE).
 * All seven models expose both `ownerId` and `createdById`, which is exactly the
 * shape `requireCanAccess` expects, so no per-model field mapping is needed.
 *
 * Lookups are tenant-scoped (findFirst with tenantId) so a record id from another
 * tenant resolves to null rather than leaking a cross-tenant existence signal.
 *
 * Returns `null` when the objectType is not recognised, or when the record does
 * not exist / is not in the caller's tenant. Callers MUST treat null as "could
 * not verify" and degrade to the visible-user-ids filter rather than allowing
 * the query through unfiltered.
 */
async function loadRecordForVisibilityCheck(
  objectType: string,
  recordId: string,
  tenantId: string
): Promise<{ createdById?: string | null; ownerId?: string | null } | null> {
  const select = { createdById: true, ownerId: true } as const;
  const where = { id: recordId, tenantId };

  switch (objectType.toUpperCase()) {
    case "ACCOUNT":
      return prisma.account.findFirst({ where, select });
    case "CONTACT":
      return prisma.contact.findFirst({ where, select });
    case "LEAD":
      return prisma.lead.findFirst({ where, select });
    case "OPPORTUNITY":
      return prisma.opportunity.findFirst({ where, select });
    case "QUOTE":
      return prisma.quote.findFirst({ where, select });
    case "ACTIVITY":
      return prisma.activity.findFirst({ where, select });
    case "SEQUENCE":
      return prisma.sequence.findFirst({ where, select });
    default:
      // Unrecognised objectType (e.g. a future/system object with no owner
      // concept). We cannot evaluate ownership, so we return null and the
      // caller degrades to the visible-user-ids filter instead of trusting it.
      return null;
  }
}

export default async function auditHistoryRoutes(app: FastifyInstance) {
  // Audit log endpoint with RBAC hierarchy filtering:
  // Senior Partner -> Sees all logs
  // Partner -> Sees logs for self + managers/users reporting under them
  // Manager -> Sees logs for self + users reporting under them
  app.get("/api/v1/audit-log", { preHandler: [app.authenticate] }, async (req: any, reply: any) => {
    const { objectType, recordId, limit } = req.query as { objectType?: string; recordId?: string; limit?: string };

    const tenantId = req.authUser.tenantId;

    // Per-record visibility check. This runs for EVERY objectType, not just
    // OPPORTUNITY: previously a request such as
    //   GET /api/v1/audit-log?objectType=LEAD&recordId=<any id>
    // skipped both this check (Opportunity-only) and the visible-user-ids
    // fallback below (which only ran when no recordId was supplied), letting any
    // tenant user read the full audit trail of any record they cannot see.
    let recordVerified = false;
    if (recordId && objectType) {
      const record = await loadRecordForVisibilityCheck(objectType, recordId, tenantId);
      if (record) {
        try {
          await requireCanAccess(req.authUser, record, "read");
          recordVerified = true;
        } catch (err: any) {
          return reply.code(403).send({ error: `Access denied to ${objectType.toLowerCase()} logs` });
        }
      }
      // record === null => unknown objectType, or the record does not exist in
      // this tenant (this also covers the synthetic comma-joined recordIds that
      // bulk-update audit rows use). recordVerified stays false and the
      // visible-user-ids filter below applies, so we never fall through
      // unfiltered.
    }

    const where: any = {
      tenantId,
      ...(objectType ? { objectType } : {}),
      ...(recordId ? { recordId } : {}),
    };

    // Restrict logs to visible users in the team hierarchy unless the caller is a
    // Senior Partner, or we positively verified their access to the specific
    // record being requested (in which case they may see its full trail,
    // including entries written by users outside their hierarchy).
    if (req.authUser.orgRole !== "SENIOR_PARTNER" && !recordVerified) {
      const visibleUserIds = await getVisibleUserIds(req.authUser);
      where.userId = { in: visibleUserIds };
    }

    const data = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, orgRole: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit ? Math.min(Number(limit), 200) : 100,
    });

    return { data };
  });
}
