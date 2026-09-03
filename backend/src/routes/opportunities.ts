import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit, notify } from "../lib/audit.js";
import { toCsv } from "../lib/csv.js";
import { getCreatedByFilter, requireCanAccess, requireExportPermission } from "../lib/rbac.js";
import { computeOpportunityFinancials } from "../lib/financial.js";

export function isApprovalRequiredStage(stageName: string, userRole: string = "MANAGER"): boolean {
  if (!stageName) return false;
  if (userRole === "SENIOR_PARTNER" || userRole === "PARTNER") {
    return false;
  }
  const s = stageName.toLowerCase().trim();
  return s.includes("closed won") || s === "won";
}

export function formatOppWithFinancials(opp: any) {
  if (!opp) return opp;
  const financials = computeOpportunityFinancials({
    expectedOpportunityValue: opp.expectedOpportunityValue !== null && opp.expectedOpportunityValue !== undefined ? Number(opp.expectedOpportunityValue) : (opp.amount !== null && opp.amount !== undefined ? Number(opp.amount) : null),
    actualOpportunityValue: opp.actualOpportunityValue !== null && opp.actualOpportunityValue !== undefined ? Number(opp.actualOpportunityValue) : null,
    bottomLineCost: opp.bottomLineCost !== null && opp.bottomLineCost !== undefined ? Number(opp.bottomLineCost) : null,
    amount: Number(opp.amount || 0),
  });

  const isClosedWon = opp.stage ? (opp.stage.isClosed && opp.stage.isWon) : (opp.forecastCategory === "CLOSED_WON");
  const hasMissingActualValue = isClosedWon && (opp.actualOpportunityValue === null || opp.actualOpportunityValue === undefined);

  return {
    ...opp,
    amount: financials.expectedOpportunityValue ?? opp.amount,
    expectedOpportunityValue: financials.expectedOpportunityValue,
    actualOpportunityValue: financials.actualOpportunityValue,
    bottomLineCost: financials.bottomLineCost,
    expectedMargin: financials.expectedMargin,
    grossMargin: financials.grossMargin,
    marginLoss: financials.marginLoss,
    topLineRevenue: financials.topLineRevenue,
    marginValue: financials.marginValue,
    marginPercentage: financials.marginPercentage,
    hasMissingActualValue,
  };
}

const newAccountSchema = z.object({
  name: z.string().min(1),
  domain: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  ownerId: z.string().uuid().optional(),
});

const newContactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().regex(/^\d+$/, "Phone number must contain only numeric digits").optional().nullable().or(z.literal("")),
  jobTitle: z.string().optional().nullable(),
});

const opportunitySchema = z.object({
  name: z.string().min(1, "Opportunity name is required"),
  accountId: z.string().uuid().optional(),
  newAccount: newAccountSchema.optional(),
  contactId: z.string().uuid().optional().nullable(),
  newContact: newContactSchema.optional(),
  amount: z.number({ invalid_type_error: "Opportunity value must be a number" }).nonnegative("Opportunity value must be non-negative").optional(),
  expectedOpportunityValue: z.number({ invalid_type_error: "Expected Opportunity Value must be a number" }).nonnegative("Expected Opportunity Value must be non-negative").optional().nullable(),
  actualOpportunityValue: z.number({ invalid_type_error: "Topline Value must be a number" }).nonnegative("Topline Value must be non-negative").optional().nullable(),
  bottomLineCost: z.number({ invalid_type_error: "Cost Incurred to Company must be a number" }).nonnegative("Cost Incurred to Company must be non-negative").optional().nullable(),
  loeValue: z.string().optional().nullable(),
  loeUnit: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
  poValue: z.number().nonnegative().optional().nullable(),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid("Opportunity Stage is required"),
  probability: z.number().int().min(0).max(100).optional(),
  createdAt: z.string().datetime().optional(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  actualCloseDate: z.string().datetime().optional().nullable(),
  wonDate: z.string().datetime().optional().nullable(),
  lostReason: z.string().optional().nullable(),
  opportunityTypeLegacy: z.string().optional().nullable(),
  forecastCategory: z.enum(["PIPELINE", "BEST_CASE", "COMMIT", "CLOSED_WON", "CLOSED_LOST"]).optional(),
  ownerId: z.string().uuid("Assigned To is required"),
  opportunityType: z.enum(["NEW_BUSINESS", "EXPANSION", "RENEWAL"]).optional(),
  leadSource: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
  contactIds: z.array(z.string().uuid()).optional(),
  properties: z.record(z.any()).optional(),
});

const lineItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
});

export default async function opportunityRoutes(app: FastifyInstance) {
  app.get("/api/v1/opportunities", { preHandler: app.authenticate }, async (req) => {
    const q = req.query as {
      page?: string; pageSize?: string; search?: string; accountId?: string;
      ownerId?: string; stageId?: string; pipelineId?: string;
      includeArchived?: string; amountMin?: string; amountMax?: string; leadSource?: string;
      won?: string; forecastCategory?: string;
    };
    const page = Math.max(1, parseInt(q.page || "1"));
    const pageSize = Math.min(1000, Math.max(1, parseInt(q.pageSize || "25")));

    const rbacFilter = await getCreatedByFilter(req.authUser);
    const where = {
      tenantId: req.authUser.tenantId,
      ...rbacFilter,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.won === "true"
        ? {
            OR: [
              { stage: { isWon: true } },
              { stage: { name: { in: ["Proposal Won", "Closed Won", "Won"], mode: "insensitive" as const } } },
              { forecastCategory: "CLOSED_WON" as const },
            ],
          }
        : {}),
      ...(q.forecastCategory ? { forecastCategory: q.forecastCategory as any } : {}),
      ...(q.leadSource ? { leadSource: q.leadSource } : {}),
      ...(q.amountMin || q.amountMax
        ? { amount: { ...(q.amountMin ? { gte: Number(q.amountMin) } : {}), ...(q.amountMax ? { lte: Number(q.amountMax) } : {}) } }
        : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };

    const [total, data] = await prisma.$transaction([
      prisma.opportunity.count({ where }),
      prisma.opportunity.findMany({
        where,
        include: {
          account: {
            select: {
              id: true,
              name: true,
              ownerId: true,
              owner: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              jobTitle: true,
            },
          },
          stage: true,
          pipeline: true,
          owner: { select: { id: true, firstName: true, lastName: true } },
          stageApprovals: {
            where: { status: "PENDING" },
            include: {
              requestedBy: { select: { id: true, firstName: true, lastName: true } },
              toStage: true,
              fromStage: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: data.map(formatOppWithFinancials), pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  });

  // EXPORT — CSV of opportunities matching current filters (restricted for Manager)
  app.get("/api/v1/opportunities/export", { preHandler: app.authenticate }, async (req, reply) => {
    requireExportPermission(req.authUser);

    const q = req.query as { search?: string; accountId?: string; ownerId?: string; stageId?: string; includeArchived?: string; won?: string };
    const where = {
      tenantId: req.authUser.tenantId,
      ...(q.includeArchived === "true" ? {} : { archived: false }),
      ...(q.accountId ? { accountId: q.accountId } : {}),
      ...(q.ownerId ? { ownerId: q.ownerId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.won === "true"
        ? {
            OR: [
              { stage: { isWon: true } },
              { stage: { name: { in: ["Closed Won", "Won"], mode: "insensitive" as const } } },
              { forecastCategory: "CLOSED_WON" as const },
            ],
          }
        : {}),
      ...(q.search ? { name: { contains: q.search, mode: "insensitive" as const } } : {}),
    };
    const opps = await prisma.opportunity.findMany({
      where,
      include: {
        account: { select: { name: true, owner: { select: { firstName: true, lastName: true } } } },
        contact: { select: { firstName: true, lastName: true } },
        stage: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const rows = opps.map((o) => {
      const f = formatOppWithFinancials(o);
      return {
        name: o.name,
        account: o.account?.name || "",
        accountOwner: o.account?.owner ? `${o.account.owner.firstName} ${o.account.owner.lastName}` : "",
        contactPerson: o.contact ? `${o.contact.firstName} ${o.contact.lastName}` : "",
        stage: o.stage.name,
        opportunityType: o.opportunityTypeLegacy || o.opportunityType || "NEW_BUSINESS",
        assignedTo: o.owner ? `${o.owner.firstName} ${o.owner.lastName}` : "",
        expectedOpportunityValue: f.expectedOpportunityValue ?? "",
        toplineValue: f.actualOpportunityValue ?? "",
        costIncurred: f.bottomLineCost ?? "",
        marginValue: f.marginValue ?? "",
        marginPercentage: f.marginPercentage ?? "",
        remarks: o.description || "",
        createdDate: o.createdAt ? o.createdAt.toISOString().slice(0, 10) : "",
        closeDate: o.expectedCloseDate ? o.expectedCloseDate.toISOString().slice(0, 10) : "",
        lostReason: o.lostReason || "",
        loe: o.loeValue ? `${o.loeValue} ${o.loeUnit || "Hours"}` : "",
        poNumber: o.poNumber || "",
        poValue: o.poValue ? Number(o.poValue) : "",
      };
    });
    const csv = toCsv(rows, [
      { key: "name", label: "Opportunity Name" },
      { key: "account", label: "Account Name" },
      { key: "accountOwner", label: "Account Owner" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "stage", label: "Opportunity Stage" },
      { key: "opportunityType", label: "Opportunity Type" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "expectedOpportunityValue", label: "Expected Opportunity Value" },
      { key: "toplineValue", label: "Topline Value" },
      { key: "costIncurred", label: "Cost Incurred to Company" },
      { key: "marginValue", label: "Margin Value" },
      { key: "marginPercentage", label: "Margin Percentage" },
      { key: "remarks", label: "Remarks" },
      { key: "createdDate", label: "Created Date" },
      { key: "closeDate", label: "Close Date" },
      { key: "lostReason", label: "Closed Lost Reason" },
      { key: "loe", label: "LOE" },
      { key: "poNumber", label: "PO Number" },
      { key: "poValue", label: "PO Value" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="opportunities.csv"');
    return reply.send(csv);
  });

  // SAMPLE TEMPLATE — Download valid Opportunity CSV template (available to all roles)
  app.get("/api/v1/opportunities/sample-template", { preHandler: app.authenticate }, async (_req, reply) => {
    const sampleRows = [
      {
        name: "Enterprise Security Audit",
        account: "Acme Corporation",
        accountOwner: "John Doe",
        contactPerson: "Jane Smith",
        stage: "Lead Qualified",
        opportunityType: "NEW_BUSINESS",
        assignedTo: "John Doe",
        expectedOpportunityValue: "500000",
        toplineValue: "520000",
        costIncurred: "350000",
        remarks: "Scope covers cloud infrastructure penetration testing",
        createdDate: new Date().toISOString().slice(0, 10),
        closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        lostReason: "",
        loe: "160 Hours",
        poNumber: "PO-2026-001",
        poValue: "520000",
      },
    ];
    const csv = toCsv(sampleRows, [
      { key: "name", label: "Opportunity Name" },
      { key: "account", label: "Account" },
      { key: "accountOwner", label: "Account Owner" },
      { key: "contactPerson", label: "Contact Person" },
      { key: "stage", label: "Opportunity Stage" },
      { key: "opportunityType", label: "Opportunity Type" },
      { key: "assignedTo", label: "Assigned To" },
      { key: "expectedOpportunityValue", label: "Expected Opportunity Value" },
      { key: "toplineValue", label: "Topline Value" },
      { key: "costIncurred", label: "Cost Incurred to Company" },
      { key: "remarks", label: "Remarks" },
      { key: "createdDate", label: "Created Date" },
      { key: "closeDate", label: "Close Date" },
      { key: "lostReason", label: "Closed Lost Reason" },
      { key: "loe", label: "LOE" },
      { key: "poNumber", label: "PO Number" },
      { key: "poValue", label: "PO Value" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="opportunity_sample_template.csv"');
    return reply.send(csv);
  });

  // IMPORT — CSV upload → validate → duplicate check → preview/commit
  app.post("/api/v1/opportunities/import", { preHandler: app.authenticate }, async (req, reply) => {
    const importSchema = z.object({
      rows: z.array(z.record(z.string())),
      mapping: z.record(z.string()),
      commit: z.boolean().default(false),
      createMissingAccount: z.boolean().default(true),
      createMissingContact: z.boolean().default(true),
      duplicateStrategy: z.enum(["skip", "create_new", "update_existing"]).default("skip"),
      rowDecisions: z.record(z.enum(["skip", "create_new", "update_existing"])).optional(),
    });

    const body = importSchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    const [oppPipeline, users, accounts, contacts] = await Promise.all([
      prisma.pipeline.findFirst({ where: { tenantId, type: "OPPORTUNITY" }, include: { stages: { orderBy: { order: "asc" } } } }),
      prisma.user.findMany({ where: { tenantId } }),
      prisma.account.findMany({ where: { tenantId, archived: false } }),
      prisma.contact.findMany({ where: { tenantId, archived: false } }),
    ]);

    if (!oppPipeline || !oppPipeline.stages.length) {
      return reply.code(400).send({ error: "Opportunity pipeline not configured for workspace" });
    }

    const oppStageMap = new Map(oppPipeline.stages.map((s) => [s.name.toLowerCase().trim(), s]));
    const allowedOppStages = oppPipeline.stages.map((s) => s.name);

    const results: {
      row: number;
      status: "valid" | "duplicate" | "error";
      error?: string;
      duplicateDetails?: { existingName: string; accountName: string; existingId: string };
      data?: any;
    }[] = [];

    let importedCount = 0;
    let pendingApprovalCount = 0;
    let skippedCount = 0;

    const initialStage = oppPipeline.stages[0];

    for (let i = 0; i < body.rows.length; i++) {
      const raw = body.rows[i];
      const mapped: Record<string, string> = {};
      for (const [field, column] of Object.entries(body.mapping)) {
        if (column && raw[column] !== undefined) mapped[field] = String(raw[column]).trim();
      }

      const oppName = mapped.name || mapped.opportunityName || mapped.dealName;
      const accountName = mapped.account || mapped.accountName || mapped.companyName || mapped.company;
      const amountStr = mapped.amount || mapped.expectedOpportunityValue || mapped.expectedDealValue || mapped.dealValue || mapped.value;
      const toplineValueStr = mapped.toplineValue || mapped.actualOpportunityValue || mapped.actualDealValue;
      const costIncurredStr = mapped.costIncurred || mapped.bottomLineCost;
      const oppStageName = mapped.opportunityStage || mapped.stage || mapped.dealStage;
      const contactPersonName = mapped.contactPerson || mapped.contact;
      const accountOwnerName = mapped.accountOwner;
      const assignedToName = mapped.assignedTo || mapped.owner;
      const remarks = mapped.remarks || mapped.description || "";
      const createdDateStr = mapped.createdDate || mapped.createdAt;
      const closeDateStr = mapped.closeDate || mapped.expectedCloseDate;
      const lostReasonStr = mapped.closedLostReason || mapped.lostReason || "";
      const loeStr = mapped.loe || mapped.loeValue || "";
      const poNumberStr = mapped.poNumber || "";
      const poValueStr = mapped.poValue || "";

      if (!oppName) {
        results.push({ row: i, status: "error", error: "Opportunity Name is required" });
        continue;
      }
      if (!accountName) {
        results.push({ row: i, status: "error", error: "Account is required" });
        continue;
      }

      let parsedAmount = 0;
      if (amountStr !== undefined && amountStr !== "") {
        const cleanAmount = amountStr.replace(/[^0-9.-]+/g, "");
        parsedAmount = Number(cleanAmount);
        if (isNaN(parsedAmount) || parsedAmount < 0) {
          results.push({ row: i, status: "error", error: `Value must be a valid non-negative number (got "${amountStr}")` });
          continue;
        }
      }

      let parsedTopline: number | null = null;
      if (toplineValueStr) {
        const clean = Number(toplineValueStr.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(clean) && clean >= 0) parsedTopline = clean;
      }

      let parsedCost: number | null = null;
      if (costIncurredStr) {
        const clean = Number(costIncurredStr.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(clean) && clean >= 0) parsedCost = clean;
      }

      let parsedPoValue: number | null = null;
      if (poValueStr) {
        const clean = Number(poValueStr.replace(/[^0-9.-]+/g, ""));
        if (!isNaN(clean) && clean >= 0) parsedPoValue = clean;
      }

      let stage = initialStage;
      if (oppStageName) {
        const matched = oppStageMap.get(oppStageName.toLowerCase().trim());
        if (!matched) {
          results.push({
            row: i,
            status: "error",
            error: `Invalid Stage "${oppStageName}". Allowed: ${allowedOppStages.join(", ")}`,
          });
          continue;
        }
        stage = matched;
      }

      // Mandatory Closed Lost reason validation in CSV
      const isClosedLost = stage.isClosed && !stage.isWon;
      if (isClosedLost && (!lostReasonStr || !lostReasonStr.trim())) {
        results.push({ row: i, status: "error", error: `Closed Lost Reason is mandatory for opportunity "${oppName}" in Closed Lost stage.` });
        continue;
      }

      // Mandatory Closed Won validation in CSV
      const isClosedWon = stage.isClosed && stage.isWon;
      if (isClosedWon) {
        if (parsedPoValue === null || parsedPoValue <= 0) {
          results.push({ row: i, status: "error", error: `Valid positive PO Value is mandatory for opportunity "${oppName}" in Closed Won stage.` });
          continue;
        }
      }

      let createdAt = new Date();
      if (createdDateStr) {
        const d = new Date(createdDateStr);
        if (isNaN(d.getTime())) {
          results.push({ row: i, status: "error", error: `Invalid Created Date "${createdDateStr}"` });
          continue;
        }
        createdAt = d;
      }

      let closeDate: Date | null = null;
      if (closeDateStr) {
        const d = new Date(closeDateStr);
        if (isNaN(d.getTime())) {
          results.push({ row: i, status: "error", error: `Invalid Close Date "${closeDateStr}"` });
          continue;
        }
        closeDate = d;
      }

      let assignedUser = users.find((u) => u.id === req.authUser.id) || users[0];
      if (assignedToName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === assignedToName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === assignedToName.toLowerCase() ||
            u.firstName.toLowerCase() === assignedToName.toLowerCase()
        );
        if (found) assignedUser = found;
      }

      let accountOwner = req.authUser.orgRole === "MANAGER" ? (users.find(u => u.id === req.authUser.id) || assignedUser) : assignedUser;
      if (req.authUser.orgRole !== "MANAGER" && accountOwnerName) {
        const found = users.find(
          (u) =>
            u.email.toLowerCase() === accountOwnerName.toLowerCase() ||
            `${u.firstName} ${u.lastName}`.toLowerCase() === accountOwnerName.toLowerCase() ||
            u.firstName.toLowerCase() === accountOwnerName.toLowerCase()
        );
        if (found) accountOwner = found;
      }

      let existingAccount = accounts.find((a) => a.name.toLowerCase().trim() === accountName.toLowerCase().trim());
      if (!existingAccount && !body.createMissingAccount && !body.commit) {
        results.push({ row: i, status: "error", error: `Account "${accountName}" does not exist and auto-creation is disabled` });
        continue;
      }

      const existingOpp = await prisma.opportunity.findFirst({
        where: {
          tenantId,
          archived: false,
          name: { equals: oppName, mode: "insensitive" },
          ...(existingAccount ? { accountId: existingAccount.id } : {}),
        },
      });

      const isDuplicate = !!existingOpp;
      const stageReqApproval = isApprovalRequiredStage(stage.name, req.authUser.orgRole);
      const effectiveStage = stageReqApproval ? initialStage : stage;

      const previewData = {
        name: oppName,
        accountName,
        accountOwner: `${accountOwner.firstName} ${accountOwner.lastName}`,
        contactPerson: contactPersonName || "—",
        amount: parsedAmount,
        toplineValue: parsedTopline,
        costIncurred: parsedCost,
        stage: effectiveStage.name,
        requestedStage: stageReqApproval ? stage.name : undefined,
        pendingApproval: stageReqApproval,
        assignedTo: `${assignedUser.firstName} ${assignedUser.lastName}`,
        createdDate: createdAt.toISOString().slice(0, 10),
        closeDate: closeDate ? closeDate.toISOString().slice(0, 10) : "—",
        lostReason: lostReasonStr || undefined,
        loe: loeStr || undefined,
        poNumber: poNumberStr || undefined,
        poValue: parsedPoValue,
        remarks,
      };

      const decision = body.rowDecisions?.[i] || body.duplicateStrategy;

      if (isDuplicate && !body.commit) {
        results.push({
          row: i,
          status: "duplicate",
          duplicateDetails: {
            existingName: existingOpp.name,
            accountName: accountName,
            existingId: existingOpp.id,
          },
          data: previewData,
        });
        continue;
      }

      if (isDuplicate && body.commit && decision === "skip") {
        skippedCount++;
        results.push({ row: i, status: "duplicate", data: previewData });
        continue;
      }

      if (body.commit) {
        let accountId = existingAccount?.id;
        if (!accountId && body.createMissingAccount) {
          const newAcc = await prisma.account.create({
            data: {
              tenantId,
              name: accountName,
              ownerId: accountOwner.id,
              createdById: req.authUser.id,
            },
          });
          accounts.push(newAcc);
          accountId = newAcc.id;
        }

        let contactId: string | null = null;
        if (contactPersonName && accountId) {
          const parts = contactPersonName.split(" ");
          const firstName = parts[0] || contactPersonName;
          const lastName = parts.slice(1).join(" ") || "Contact";
          let existingContact = contacts.find(
            (c) =>
              c.accountId === accountId &&
              (`${c.firstName} ${c.lastName}`.toLowerCase() === contactPersonName.toLowerCase() ||
                c.email?.toLowerCase() === contactPersonName.toLowerCase())
          );
          if (!existingContact && body.createMissingContact) {
            existingContact = await prisma.contact.create({
              data: {
                tenantId,
                accountId,
                firstName,
                lastName,
                ownerId: assignedUser.id,
                createdById: req.authUser.id,
              },
            });
            contacts.push(existingContact);
          }
          if (existingContact) contactId = existingContact.id;
        }

        let createdOrUpdatedOppId: string;

        if (isDuplicate && decision === "update_existing" && existingOpp) {
          const updated = await prisma.opportunity.update({
            where: { id: existingOpp.id },
            data: {
              amount: parsedAmount,
              expectedOpportunityValue: parsedAmount,
              actualOpportunityValue: parsedTopline ?? undefined,
              bottomLineCost: parsedCost ?? undefined,
              stageId: stageReqApproval ? existingOpp.stageId : stage.id,
              probability: stageReqApproval ? existingOpp.probability : stage.probability,
              expectedCloseDate: closeDate,
              ownerId: assignedUser.id,
              contactId: contactId || undefined,
              lostReason: isClosedLost ? lostReasonStr : undefined,
              loeValue: isClosedWon && !stageReqApproval ? loeStr : undefined,
              poNumber: isClosedWon && !stageReqApproval ? poNumberStr : undefined,
              poValue: isClosedWon && !stageReqApproval ? parsedPoValue : undefined,
              description: remarks || undefined,
            },
          });
          createdOrUpdatedOppId = updated.id;
          importedCount++;
        } else {
          const created = await prisma.opportunity.create({
            data: {
              tenantId,
              pipelineId: oppPipeline.id,
              stageId: effectiveStage.id,
              accountId: accountId!,
              contactId,
              ownerId: assignedUser.id,
              createdById: req.authUser.id,
              name: oppName,
              amount: parsedAmount,
              expectedOpportunityValue: parsedAmount,
              actualOpportunityValue: parsedTopline ?? (isClosedWon && !stageReqApproval ? parsedPoValue : null),
              bottomLineCost: parsedCost ?? null,
              probability: effectiveStage.probability,
              expectedCloseDate: closeDate,
              lostReason: isClosedLost ? lostReasonStr : null,
              loeValue: isClosedWon && !stageReqApproval ? loeStr : null,
              poNumber: isClosedWon && !stageReqApproval ? poNumberStr : null,
              poValue: isClosedWon && !stageReqApproval ? parsedPoValue : null,
              forecastCategory: isClosedWon && !stageReqApproval ? "CLOSED_WON" : isClosedLost ? "CLOSED_LOST" : "PIPELINE",
              wonDate: isClosedWon && !stageReqApproval ? new Date() : null,
              actualCloseDate: isClosedWon && !stageReqApproval ? new Date() : null,
              description: remarks || null,
              createdAt,
            },
          });
          createdOrUpdatedOppId = created.id;
          importedCount++;
        }

        // If stage requires approval (e.g. Manager importing Closed Won or Proposal), create StageApproval
        if (stageReqApproval) {
          pendingApprovalCount++;
          const existingPending = await prisma.stageApproval.findFirst({
            where: { tenantId, opportunityId: createdOrUpdatedOppId, status: "PENDING" },
          });
          if (!existingPending) {
            await prisma.stageApproval.create({
              data: {
                tenantId,
                opportunityId: createdOrUpdatedOppId,
                requestedById: req.authUser.id,
                fromStageId: effectiveStage.id,
                toStageId: stage.id,
                status: "PENDING",
                loeValue: isClosedWon ? loeStr : null,
                poNumber: isClosedWon ? poNumberStr : null,
                poValue: isClosedWon ? parsedPoValue : null,
                requesterComment: `Requested stage "${stage.name}" via CSV import`,
              },
            });
          }
        }
      }

      results.push({ row: i, status: "valid", data: previewData });
    }

    const summary = {
      total: results.length,
      valid: results.filter((r) => r.status === "valid").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      errors: results.filter((r) => r.status === "error").length,
      imported: importedCount,
      pendingApproval: pendingApprovalCount,
      skipped: skippedCount,
      committed: body.commit,
    };

    return { summary, results };
  });

  app.post("/api/v1/opportunities", { preHandler: app.authenticate }, async (req, reply) => {
    const body = opportunitySchema.parse(req.body);
    const tenantId = req.authUser.tenantId;

    if (!body.accountId && !body.newAccount) {
      return reply.code(400).send({ error: "Account is required — select an existing account or create a new one" });
    }

    // Auto-select Account Owner as current Manager if Manager creates
    if (req.authUser.orgRole === "MANAGER") {
      body.ownerId = req.authUser.id;
      if (body.newAccount) {
        body.newAccount.ownerId = req.authUser.id;
      }
    }

    if (body.createdAt && body.expectedCloseDate) {
      if (new Date(body.expectedCloseDate) < new Date(body.createdAt)) {
        return reply.code(400).send({ error: "Close Date cannot be earlier than Created Date" });
      }
    }

    const [account, stage, oppPipeline] = await Promise.all([
      body.accountId ? prisma.account.findFirst({ where: { id: body.accountId, tenantId } }) : Promise.resolve(null),
      prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId, pipeline: { tenantId } },
      }),
      prisma.pipeline.findFirst({
        where: { id: body.pipelineId, tenantId },
        include: { stages: { orderBy: { order: "asc" } } },
      }),
    ]);
    if (body.accountId && !account) return reply.code(400).send({ error: "Account not found for this tenant" });
    if (!stage) return reply.code(400).send({ error: "Stage does not belong to the specified pipeline" });

    const isClosingWon = stage.isClosed && stage.isWon;
    const isClosingLost = stage.isClosed && !stage.isWon;

    // Closed Lost validation
    if (isClosingLost && (!body.lostReason || !body.lostReason.trim())) {
      return reply.code(400).send({ error: "A valid Closed Lost reason is mandatory when moving an opportunity to Closed Lost." });
    }

    // Closed Won validation
    if (isClosingWon) {
      if (body.poValue === undefined || body.poValue === null || Number(body.poValue) <= 0) {
        return reply.code(400).send({ error: "A valid positive PO Value is mandatory when moving an opportunity to Closed Won." });
      }
    }

    const stageReqApproval = isApprovalRequiredStage(stage.name, req.authUser.orgRole);
    const initialStage = oppPipeline?.stages[0] || stage;
    const effectiveStage = stageReqApproval ? initialStage : stage;

    const opportunity = await prisma.$transaction(async (tx) => {
      let accountId = body.accountId;
      if (!accountId && body.newAccount) {
        const newAcc = await tx.account.create({
          data: {
            tenantId,
            name: body.newAccount.name,
            domain: body.newAccount.domain || null,
            industry: body.newAccount.industry || null,
            phone: body.newAccount.phone || null,
            website: body.newAccount.website || null,
            ownerId: req.authUser.orgRole === "MANAGER" ? req.authUser.id : (body.newAccount.ownerId || body.ownerId),
            createdById: req.authUser.id,
          },
        });
        accountId = newAcc.id;
      }

      let contactId = body.contactId;
      if (!contactId && body.newContact) {
        const newCt = await tx.contact.create({
          data: {
            tenantId,
            accountId: accountId!,
            firstName: body.newContact.firstName,
            lastName: body.newContact.lastName,
            email: body.newContact.email || null,
            phone: body.newContact.phone || null,
            jobTitle: body.newContact.jobTitle || null,
            ownerId: body.ownerId,
            createdById: req.authUser.id,
          },
        });
        contactId = newCt.id;
      }

      const allContactIds = new Set<string>();
      if (contactId) allContactIds.add(contactId);
      if (body.contactIds) body.contactIds.forEach((id) => allContactIds.add(id));

      const expectedOpportunityValue = body.expectedOpportunityValue !== undefined && body.expectedOpportunityValue !== null
        ? body.expectedOpportunityValue
        : (body.amount ?? 0);
      const actualOpportunityValue = isClosingWon && !stageReqApproval ? (body.poValue ? Number(body.poValue) : body.actualOpportunityValue ?? null) : (body.actualOpportunityValue ?? null);
      const bottomLineCost = body.bottomLineCost ?? null;

      const opp = await tx.opportunity.create({
        data: {
          tenantId,
          name: body.name,
          accountId: accountId!,
          contactId: contactId || null,
          amount: expectedOpportunityValue,
          expectedOpportunityValue,
          actualOpportunityValue,
          bottomLineCost,
          pipelineId: body.pipelineId,
          stageId: effectiveStage.id,
          probability: effectiveStage.probability,
          createdAt: body.createdAt ? new Date(body.createdAt) : undefined,
          expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
          actualCloseDate: isClosingWon && !stageReqApproval ? new Date() : null,
          wonDate: isClosingWon && !stageReqApproval ? new Date() : null,
          lostReason: isClosingLost ? body.lostReason : null,
          loeValue: isClosingWon && !stageReqApproval ? body.loeValue : null,
          loeUnit: isClosingWon && !stageReqApproval ? (body.loeUnit || "Hours") : "Hours",
          poNumber: isClosingWon && !stageReqApproval ? body.poNumber : null,
          poValue: isClosingWon && !stageReqApproval ? body.poValue : null,
          opportunityTypeLegacy: body.opportunityTypeLegacy || null,
          forecastCategory: isClosingWon && !stageReqApproval ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : (body.forecastCategory || "PIPELINE"),
          ownerId: body.ownerId,
          createdById: req.authUser.id,
          opportunityType: body.opportunityType || "NEW_BUSINESS",
          leadSource: body.leadSource,
          description: body.description ?? body.remarks ?? null,
          properties: body.properties ?? {},
          contacts: allContactIds.size > 0
            ? { create: Array.from(allContactIds).map((cId) => ({ contactId: cId })) }
            : undefined,
        },
      });

      await tx.opportunityStageHistory.create({
        data: { opportunityId: opp.id, toStageId: effectiveStage.id, changedById: req.authUser.id },
      });

      if (stageReqApproval) {
        let partnerId = req.authUser.partnerId;
        if (!partnerId) {
          const partnerUser = await tx.user.findFirst({
            where: { tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
          });
          partnerId = partnerUser?.id || null;
        }
        await tx.stageApproval.create({
          data: {
            tenantId,
            opportunityId: opp.id,
            requestedById: req.authUser.id,
            approverId: partnerId,
            fromStageId: effectiveStage.id,
            toStageId: stage.id,
            status: "PENDING",
            loeValue: isClosingWon ? body.loeValue : null,
            loeUnit: isClosingWon ? (body.loeUnit || "Hours") : "Hours",
            poNumber: isClosingWon ? body.poNumber : null,
            poValue: isClosingWon ? body.poValue : null,
            requesterComment: body.remarks || body.description || `Requested stage "${stage.name}"`,
          },
        });
      } else if (isClosingWon) {
        const acct = await tx.account.findUnique({ where: { id: accountId! } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const addVal = body.poValue ? Number(body.poValue) : Number(opp.amount);
          await tx.account.update({
            where: { id: accountId! },
            data: { annualRevenue: currentRev + addVal },
          });
        }
      }

      return opp;
    });

    await logAudit({
      tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: opportunity.id, action: "CREATED", newValues: opportunity,
    });

    const fullOpp = await prisma.opportunity.findFirst({
      where: { id: opportunity.id },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        stage: true,
        pipeline: true,
        owner: { select: { id: true, firstName: true, lastName: true } },
        attachments: { include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });

    return reply.code(201).send(formatOppWithFinancials(fullOpp));
  });

  app.get("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const opp = await prisma.opportunity.findFirst({
      where: { id, tenantId: req.authUser.tenantId },
      include: {
        account: {
          include: {
            owner: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        contact: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        contacts: { include: { contact: true } },
        lineItems: { include: { product: true } },
        quotes: true,
        attachments: {
          include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: "desc" },
        },
        activities: { orderBy: { createdAt: "desc" } },
        notes: { include: { author: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        stageHistory: { orderBy: { changedAt: "desc" } },
        stageApprovals: {
          orderBy: { createdAt: "desc" },
          include: {
            requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            approver: { select: { id: true, firstName: true, lastName: true } },
            reviewedBy: { select: { id: true, firstName: true, lastName: true } },
            fromStage: true,
            toStage: true,
            attachments: {
              include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    await requireCanAccess(req.authUser, opp, "read");
    return formatOppWithFinancials(opp);
  });

  app.patch("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = opportunitySchema.partial().parse(req.body);
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    await requireCanAccess(req.authUser, existing, "write");

    const effectiveCreatedAt = body.createdAt ? new Date(body.createdAt) : existing.createdAt;
    const effectiveCloseDate = body.expectedCloseDate !== undefined ? (body.expectedCloseDate ? new Date(body.expectedCloseDate) : null) : existing.expectedCloseDate;
    if (effectiveCreatedAt && effectiveCloseDate && effectiveCloseDate < effectiveCreatedAt) {
      return reply.code(400).send({ error: "Close Date cannot be earlier than Created Date" });
    }

    let targetStage: any = null;
    const stageChanged = body.stageId && body.stageId !== existing.stageId;
    if (stageChanged) {
      targetStage = await prisma.pipelineStage.findFirst({
        where: { id: body.stageId, pipelineId: body.pipelineId ?? existing.pipelineId },
      });
      if (!targetStage) return reply.code(400).send({ error: "Invalid stage for this pipeline" });
    }

    const isMovingToClosedWon = targetStage ? (targetStage.isClosed && targetStage.isWon) : (body.forecastCategory === "CLOSED_WON");
    const isMovingToClosedLost = targetStage ? (targetStage.isClosed && !targetStage.isWon) : (body.forecastCategory === "CLOSED_LOST");

    // Closed Lost validation
    if (isMovingToClosedLost) {
      const candidateReason = body.lostReason !== undefined ? body.lostReason : existing.lostReason;
      if (!candidateReason || !candidateReason.trim()) {
        return reply.code(400).send({ error: "A valid Closed Lost reason is mandatory when moving an opportunity to Closed Lost." });
      }
    }

    // Closed Won validation
    if (isMovingToClosedWon) {
      if (body.poValue === undefined || body.poValue === null || Number(body.poValue) <= 0) {
        return reply.code(400).send({ error: "A valid positive PO Value is mandatory when moving an opportunity to Closed Won." });
      }
    }

    let isApprovalRequired = false;
    let pendingApprovalRecord: any = null;

    if (stageChanged && targetStage) {
      const targetRequiresApproval = isApprovalRequiredStage(targetStage.name, req.authUser.orgRole);

      if (targetRequiresApproval) {
        isApprovalRequired = true;

        let partnerId = req.authUser.partnerId;
        if (!partnerId) {
          const partnerUser = await prisma.user.findFirst({
            where: { tenantId: req.authUser.tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
          });
          partnerId = partnerUser?.id || null;
        }

        const activePending = await prisma.stageApproval.findFirst({
          where: { tenantId: req.authUser.tenantId, opportunityId: id, status: "PENDING" },
        });

        if (activePending) {
          return reply.code(400).send({
            error: "An active pending approval request already exists for this opportunity. Please wait for review or cancel the current request before submitting a new one.",
          });
        }

        pendingApprovalRecord = await prisma.stageApproval.create({
          data: {
            tenantId: req.authUser.tenantId,
            opportunityId: id,
            requestedById: req.authUser.id,
            approverId: partnerId,
            fromStageId: existing.stageId,
            toStageId: body.stageId!,
            status: "PENDING",
            loeValue: isMovingToClosedWon ? body.loeValue : null,
            loeUnit: isMovingToClosedWon ? (body.loeUnit || "Hours") : "Hours",
            poNumber: isMovingToClosedWon ? body.poNumber : null,
            poValue: isMovingToClosedWon ? body.poValue : null,
            requesterComment: body.remarks || body.description || null,
          },
          include: { toStage: true, fromStage: true },
        });

        const partnersToNotify = await prisma.user.findMany({
          where: { tenantId: req.authUser.tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
          select: { id: true },
        });

        for (const p of partnersToNotify) {
          await notify({
            tenantId: req.authUser.tenantId,
            userId: p.id,
            message: `Stage Change Requested: "${existing.name}" → "${targetStage.name}" requested by ${req.authUser.firstName} ${req.authUser.lastName}`,
            link: `/opportunities/${id}`,
          });
        }
      }
    }

    const { contactIds, remarks, newAccount, newContact, ...rest } = body;
    if (isApprovalRequired) {
      delete rest.stageId;
    }

    const updatedExpectedDealValue = rest.expectedOpportunityValue !== undefined ? rest.expectedOpportunityValue : (rest.amount !== undefined ? rest.amount : undefined);
    const updatedAmount = updatedExpectedDealValue !== undefined ? (updatedExpectedDealValue ?? existing.amount) : undefined;

    const opportunity = await prisma.$transaction(async (tx) => {
      const isClosingWon = !isApprovalRequired && !!targetStage?.isClosed && targetStage.isWon;
      const isClosingLost = !isApprovalRequired && !!targetStage?.isClosed && !targetStage.isWon;

      const finalActualCloseDate = rest.actualCloseDate
        ? new Date(rest.actualCloseDate)
        : (isClosingWon ? (existing.actualCloseDate ?? new Date()) : undefined);

      const updated = await tx.opportunity.update({
        where: { id },
        data: {
          ...rest,
          ...(updatedAmount !== undefined ? { amount: updatedAmount } : {}),
          ...(updatedExpectedDealValue !== undefined ? { expectedOpportunityValue: updatedExpectedDealValue } : {}),
          actualOpportunityValue: isClosingWon ? (rest.poValue ? Number(rest.poValue) : (rest.actualOpportunityValue ?? existing.actualOpportunityValue)) : rest.actualOpportunityValue,
          loeValue: isClosingWon ? rest.loeValue : (rest.loeValue !== undefined ? rest.loeValue : undefined),
          loeUnit: isClosingWon ? (rest.loeUnit || "Hours") : (rest.loeUnit !== undefined ? rest.loeUnit : undefined),
          poNumber: isClosingWon ? rest.poNumber : (rest.poNumber !== undefined ? rest.poNumber : undefined),
          poValue: isClosingWon ? rest.poValue : (rest.poValue !== undefined ? rest.poValue : undefined),
          probability: (!isApprovalRequired && stageChanged && targetStage) ? targetStage.probability : rest.probability,
          forecastCategory: isClosingWon ? "CLOSED_WON" : isClosingLost ? "CLOSED_LOST" : rest.forecastCategory,
          wonDate: isClosingWon ? (existing.wonDate ?? new Date()) : undefined,
          actualCloseDate: finalActualCloseDate,
          lostReason: isClosingLost ? (rest.lostReason ?? existing.lostReason) : undefined,
          description: rest.description !== undefined ? rest.description : (remarks !== undefined ? remarks : undefined),
          createdAt: rest.createdAt ? new Date(rest.createdAt) : undefined,
          expectedCloseDate: rest.expectedCloseDate !== undefined ? (rest.expectedCloseDate ? new Date(rest.expectedCloseDate) : null) : undefined,
          contactId: rest.contactId !== undefined ? rest.contactId : undefined,
        },
      });

      if (stageChanged && !isApprovalRequired) {
        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: id,
            fromStageId: existing.stageId,
            toStageId: body.stageId!,
            changedById: req.authUser.id,
          },
        });
      }

      if (contactIds || rest.contactId) {
        const idsToLink = new Set<string>(contactIds || []);
        if (rest.contactId) idsToLink.add(rest.contactId);

        await tx.opportunityContact.deleteMany({ where: { opportunityId: id } });
        if (idsToLink.size > 0) {
          await tx.opportunityContact.createMany({
            data: Array.from(idsToLink).map((contactId) => ({ opportunityId: id, contactId })),
          });
        }
      }

      if (isClosingWon) {
        const acct = await tx.account.findUnique({ where: { id: updated.accountId } });
        if (acct) {
          const currentRev = Number(acct.annualRevenue || 0);
          const addVal = updated.poValue ? Number(updated.poValue) : Number(updated.amount);
          await tx.account.update({
            where: { id: updated.accountId },
            data: { annualRevenue: currentRev + addVal },
          });
        }
      }

      return updated;
    });

    let fromStageName: string | null = null;
    if (stageChanged && existing.stageId) {
      const fromStageObj = await prisma.pipelineStage.findUnique({ where: { id: existing.stageId }, select: { name: true } });
      fromStageName = fromStageObj?.name || null;
    }
    const toStageName = targetStage?.name || null;

    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: isApprovalRequired ? "STAGE_APPROVAL_REQUESTED" : (stageChanged ? "STAGE_CHANGED" : "UPDATED"),
      oldValues: { ...existing, stageName: fromStageName },
      newValues: { ...opportunity, stageName: toStageName, fromStageName, toStageName },
    });

    if (!isApprovalRequired && targetStage?.isClosed) {
      await notify({
        tenantId: req.authUser.tenantId, userId: opportunity.ownerId,
        message: `Opportunity "${opportunity.name}" was marked ${targetStage.isWon ? "Closed Won 🎉" : "Closed Lost"}`,
        link: `/opportunities/${opportunity.id}`,
      });
    }

    const fullOpp = await prisma.opportunity.findFirst({
      where: { id },
      include: {
        account: { include: { owner: { select: { id: true, firstName: true, lastName: true } } } },
        contact: true,
        stage: true,
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        attachments: { include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } } },
        stageApprovals: {
          orderBy: { createdAt: "desc" },
          include: {
            requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
            approver: { select: { id: true, firstName: true, lastName: true } },
            reviewedBy: { select: { id: true, firstName: true, lastName: true } },
            fromStage: true,
            toStage: true,
          },
        },
      },
    });

    const formatted = formatOppWithFinancials(fullOpp);

    if (isApprovalRequired) {
      return {
        ...formatted,
        pendingApproval: true,
        message: `Stage change to "${targetStage?.name}" submitted for Partner approval.`,
        approval: pendingApprovalRecord,
      };
    }

    return formatted;
  });

  // ATTACHMENTS — Metadata endpoint for Opportunity attachments
  app.post("/api/v1/opportunities/:id/attachments", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const attachSchema = z.object({
      originalFilename: z.string().min(1),
      mimeType: z.string().min(1),
      size: z.number().int().positive(),
      storageKey: z.string().optional().nullable(),
      stageApprovalId: z.string().uuid().optional().nullable(),
    });
    const body = attachSchema.parse(req.body);
    const opp = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });

    const attachment = await prisma.opportunityAttachment.create({
      data: {
        tenantId: req.authUser.tenantId,
        opportunityId: id,
        stageApprovalId: body.stageApprovalId || null,
        originalFilename: body.originalFilename,
        mimeType: body.mimeType,
        size: body.size,
        storageKey: body.storageKey || `staged/${Date.now()}-${body.originalFilename}`,
        uploadedById: req.authUser.id,
      },
      include: { uploadedBy: { select: { id: true, firstName: true, lastName: true } } },
    });

    return reply.code(201).send({ data: attachment });
  });

  app.delete("/api/v1/opportunities/:id/attachments/:attachmentId", { preHandler: app.authenticate }, async (req, reply) => {
    const { id, attachmentId } = req.params as { id: string; attachmentId: string };
    const attachment = await prisma.opportunityAttachment.findFirst({
      where: { id: attachmentId, opportunityId: id, tenantId: req.authUser.tenantId },
    });
    if (!attachment) return reply.code(404).send({ error: "Attachment not found" });

    await prisma.opportunityAttachment.delete({ where: { id: attachmentId } });
    return reply.code(204).send();
  });

  app.delete("/api/v1/opportunities/:id", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    await prisma.opportunity.delete({ where: { id } });
    await logAudit({
      tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY",
      recordId: id, action: "DELETED", oldValues: existing,
    });
    return reply.code(204).send();
  });

  // --- Line items (Products on an Opportunity) ---
  app.post("/api/v1/opportunities/:id/line-items", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = lineItemSchema.parse(req.body);
    const opp = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    const product = await prisma.product.findFirst({ where: { id: body.productId, tenantId: req.authUser.tenantId } });
    if (!product) return reply.code(400).send({ error: "Product not found" });
    if (!product.active) return reply.code(400).send({ error: "Inactive products cannot be added" });

    const unitPrice = Number(product.unitPrice);
    const subtotal = body.quantity * unitPrice;
    const discountAmount = subtotal * ((body.discountPct ?? 0) / 100);
    const taxable = subtotal - discountAmount;
    const total = taxable + taxable * ((body.taxPct ?? 0) / 100);

    const lineItem = await prisma.lineItem.create({
      data: {
        productId: body.productId,
        opportunityId: id,
        quantity: body.quantity,
        unitPrice,
        discountPct: body.discountPct ?? 0,
        taxPct: body.taxPct ?? 0,
        total,
      },
    });

    const items = await prisma.lineItem.findMany({ where: { opportunityId: id } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.opportunity.update({ where: { id }, data: { amount: newAmount, expectedOpportunityValue: newAmount } });

    return reply.code(201).send(lineItem);
  });

  app.delete("/api/v1/opportunities/:opportunityId/line-items/:lineItemId", { preHandler: app.authenticate }, async (req, reply) => {
    const { opportunityId, lineItemId } = req.params as { opportunityId: string; lineItemId: string };
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId: req.authUser.tenantId } });
    if (!opp) return reply.code(404).send({ error: "Opportunity not found" });
    await prisma.lineItem.delete({ where: { id: lineItemId } });
    const items = await prisma.lineItem.findMany({ where: { opportunityId } });
    const newAmount = items.reduce((sum, li) => sum + Number(li.total), 0);
    await prisma.opportunity.update({ where: { id: opportunityId }, data: { amount: newAmount, expectedOpportunityValue: newAmount } });
    return reply.code(204).send();
  });

  app.post("/api/v1/opportunities/:id/archive", { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.opportunity.findFirst({ where: { id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Opportunity not found" });
    const opp = await prisma.opportunity.update({ where: { id }, data: { archived: true } });
    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY", recordId: id, action: "ARCHIVED" });
    return opp;
  });

  app.post("/api/v1/opportunities/bulk", { preHandler: app.authenticate }, async (req, reply) => {
    const body = z.object({
      ids: z.array(z.string().uuid()).min(1),
      action: z.enum(["assignOwner", "changeStage", "archive"]),
      ownerId: z.string().uuid().optional(),
      stageId: z.string().uuid().optional(),
      lostReason: z.string().optional(),
    }).parse(req.body);

    const tenantId = req.authUser.tenantId;
    const scoped = await prisma.opportunity.findMany({ where: { id: { in: body.ids }, tenantId }, select: { id: true } });
    const ids = scoped.map((o) => o.id);
    if (!ids.length) return reply.code(404).send({ error: "No matching opportunities found" });

    let data: any = {};
    if (body.action === "assignOwner") {
      if (!body.ownerId) return reply.code(400).send({ error: "ownerId is required" });
      data = { ownerId: body.ownerId };
    } else if (body.action === "changeStage") {
      if (!body.stageId) return reply.code(400).send({ error: "stageId is required" });
      const stage = await prisma.pipelineStage.findFirst({ where: { id: body.stageId, pipeline: { tenantId } } });
      if (!stage) return reply.code(400).send({ error: "Invalid stage" });

      if (stage.isClosed && !stage.isWon) {
        if (!body.lostReason || !body.lostReason.trim()) {
          return reply.code(400).send({ error: "A valid Closed Lost reason is required when moving opportunities to Closed Lost." });
        }
        data.lostReason = body.lostReason.trim();
        data.forecastCategory = "CLOSED_LOST";
      }

      const targetRequiresApproval = isApprovalRequiredStage(stage.name, req.authUser.orgRole);

      if (targetRequiresApproval) {
        let partnerId = req.authUser.partnerId;
        if (!partnerId) {
          const partnerUser = await prisma.user.findFirst({
            where: { tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
          });
          partnerId = partnerUser?.id || null;
        }

        let pendingCount = 0;

        for (const oppId of ids) {
          const opp = await prisma.opportunity.findUnique({ where: { id: oppId } });
          if (!opp || opp.stageId === body.stageId) continue;

          const existingApproval = await prisma.stageApproval.findFirst({
            where: { tenantId, opportunityId: oppId, status: "PENDING" },
          });

          if (!existingApproval) {
            await prisma.stageApproval.create({
              data: {
                tenantId,
                opportunityId: oppId,
                requestedById: req.authUser.id,
                approverId: partnerId,
                fromStageId: opp.stageId,
                toStageId: body.stageId,
                status: "PENDING",
                requesterComment: `Bulk stage change requested to "${stage.name}"`,
              },
            });
            pendingCount++;
          }
        }

        const partnersToNotify = await prisma.user.findMany({
          where: { tenantId, orgRole: { in: ["PARTNER", "SENIOR_PARTNER"] }, active: true, id: { not: req.authUser.id } },
          select: { id: true },
        });

        for (const p of partnersToNotify) {
          await notify({
            tenantId,
            userId: p.id,
            message: `Bulk Stage Change Requested: ${pendingCount} opportunities requested to move to "${stage.name}" by ${req.authUser.firstName} ${req.authUser.lastName}`,
            link: "/opportunities",
          });
        }

        return { updated: 0, pendingApproval: pendingCount, message: `${pendingCount} stage approval request(s) submitted to Partner for approval` };
      }

      data = { ...data, stageId: body.stageId, probability: stage.probability };
    } else if (body.action === "archive") {
      data = { archived: true };
    }

    await prisma.opportunity.updateMany({ where: { id: { in: ids }, tenantId }, data });
    await logAudit({ tenantId, userId: req.authUser.id, objectType: "OPPORTUNITY", recordId: ids.join(","), action: `BULK_${body.action.toUpperCase()}`, newValues: data });
    return { updated: ids.length };
  });
}
