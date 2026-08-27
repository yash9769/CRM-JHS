import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { generateQuotePdf } from "../lib/quotePdf.js";
import { toCsv } from "../lib/csv.js";

const CreateQuoteSchema = z.object({
  dealId: z.string(),
  accountId: z.string(),
  expirationDate: z.string().optional(),
  discountPct: z.number().min(0).max(100).default(0),
  taxPct: z.number().min(0).max(100).default(0),
  currency: z.string().default("USD"),
  lineItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive().optional(),
    discountPct: z.number().min(0).max(100).default(0),
  })).optional(),
});

const UpdateQuoteSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]).optional(),
  expirationDate: z.string().optional(),
  discountPct: z.number().min(0).max(100).optional(),
  taxPct: z.number().min(0).max(100).optional(),
});

export default async function quoteRoutes(app: FastifyInstance) {
  // List quotes
  app.get("/api/v1/quotes", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const { dealId, accountId, status, page = "1", pageSize = "20" } = req.query as any;
    const where: any = { tenantId: req.authUser.tenantId };
    if (dealId) where.dealId = dealId;
    if (accountId) where.accountId = accountId;
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          deal: { select: { id: true, name: true } },
          account: { select: { id: true, name: true } },
          owner: { select: { id: true, firstName: true, lastName: true } },
          lineItems: { include: { product: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
      }),
      prisma.quote.count({ where }),
    ]);

    return { data, pagination: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) } };
  });

  // Export quotes CSV
  app.get("/api/v1/quotes/export", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const { status, dealId, accountId, search } = req.query as any;
    const where: any = { tenantId: req.authUser.tenantId };
    if (status) where.status = status;
    if (dealId) where.dealId = dealId;
    if (accountId) where.accountId = accountId;
    if (search) {
      where.OR = [
        { quoteNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    const quotes = await prisma.quote.findMany({
      where,
      include: {
        deal: { select: { name: true } },
        account: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const rows = quotes.map((q) => ({
      quoteNumber: q.quoteNumber,
      deal: q.deal?.name || "",
      account: q.account?.name || "",
      status: q.status,
      amount: Number(q.amount),
      currency: q.currency,
      owner: q.owner ? `${q.owner.firstName} ${q.owner.lastName}` : "",
      expirationDate: q.expirationDate ? q.expirationDate.toISOString().slice(0, 10) : "",
      createdAt: q.createdAt ? q.createdAt.toISOString().slice(0, 10) : "",
    }));
    const csv = toCsv(rows, [
      { key: "quoteNumber", label: "Quote Number" },
      { key: "deal", label: "Deal" },
      { key: "account", label: "Account" },
      { key: "status", label: "Status" },
      { key: "amount", label: "Amount" },
      { key: "currency", label: "Currency" },
      { key: "owner", label: "Owner" },
      { key: "expirationDate", label: "Expiration Date" },
      { key: "createdAt", label: "Created Date" },
    ]);
    reply.header("Content-Type", "text/csv");
    reply.header("Content-Disposition", 'attachment; filename="quotes.csv"');
    return reply.send(csv);
  });

  // Get single quote
  app.get("/api/v1/quotes/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const quote = await prisma.quote.findFirst({
      where: { id: req.params.id, tenantId: req.authUser.tenantId },
      include: {
        deal: { select: { id: true, name: true } },
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
        lineItems: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!quote) return reply.code(404).send({ error: "Quote not found" });
    return quote;
  });

  // Create quote
  app.post("/api/v1/quotes", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = CreateQuoteSchema.parse(req.body);

    // Verify deal/account belong to tenant
    const deal = await prisma.deal.findFirst({ where: { id: body.dealId, tenantId: req.authUser.tenantId } });
    if (!deal) return reply.code(404).send({ error: "Deal not found" });

    // Generate quote number
    const count = await prisma.quote.count({ where: { tenantId: req.authUser.tenantId } });
    const quoteNumber = `Q-${String(count + 1).padStart(5, "0")}`;

    // Build line items from deal's line items if none provided
    let lineItemsToCreate = body.lineItems || [];
    if (!lineItemsToCreate.length) {
      const dealItems = await prisma.lineItem.findMany({ where: { dealId: body.dealId }, include: { product: true } });
      lineItemsToCreate = dealItems.map(li => ({
        productId: li.productId,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        discountPct: Number(li.discountPct),
      }));
    }

    // If still no line items, use deal amount directly
    if (!lineItemsToCreate.length) {
      const taxAmt2 = Number(deal.amount) * (body.taxPct / 100);
      const discountAmt2 = Number(deal.amount) * (body.discountPct / 100);
      const quoteAmount = Number(deal.amount) - discountAmt2 + taxAmt2;
      const quote = await prisma.quote.create({
        data: {
          tenantId: req.authUser.tenantId,
          quoteNumber,
          dealId: body.dealId,
          accountId: body.accountId,
          ownerId: req.authUser.id,
          amount: quoteAmount,
          discountPct: body.discountPct,
          taxPct: body.taxPct,
          currency: body.currency,
          expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        },
        include: { account: { select: { id: true, name: true } }, deal: { select: { id: true, name: true } }, owner: { select: { id: true, firstName: true, lastName: true } }, lineItems: { include: { product: true } } },
      });
      await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, action: "CREATE", objectType: "Quote", recordId: quote.id, newValues: quote });
      return reply.code(201).send(quote);
    }

    // Calculate totals
    let subtotal = 0;
    const preparedItems = await Promise.all(lineItemsToCreate.map(async (item) => {
      const product = await prisma.product.findFirst({ where: { id: item.productId, tenantId: req.authUser.tenantId } });
      if (!product) throw new Error(`Product ${item.productId} not found`);
      const unitPrice = item.unitPrice ?? Number(product.unitPrice);
      const discountAmt = unitPrice * item.quantity * (item.discountPct / 100);
      const total = unitPrice * item.quantity - discountAmt;
      subtotal += total;
      return { productId: item.productId, quantity: item.quantity, unitPrice, discountPct: item.discountPct, taxPct: 0, total };
    }));

    const taxAmt = subtotal * (body.taxPct / 100);
    const discountAmt = subtotal * (body.discountPct / 100);
    const amount = subtotal - discountAmt + taxAmt;

    const quote = await prisma.quote.create({
      data: {
        tenantId: req.authUser.tenantId,
        quoteNumber,
        dealId: body.dealId,
        accountId: body.accountId,
        ownerId: req.authUser.id,
        amount,
        discountPct: body.discountPct,
        taxPct: body.taxPct,
        currency: body.currency,
        expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
        lineItems: { create: preparedItems },
      },
      include: {
        lineItems: { include: { product: true } },
        account: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, action: "CREATE", objectType: "Quote", recordId: quote.id, newValues: quote });
    return reply.code(201).send(quote);
  });

  // Update quote status
  app.patch("/api/v1/quotes/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const body = UpdateQuoteSchema.parse(req.body);
    const existing = await prisma.quote.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Quote not found" });
    if (existing.status === "ACCEPTED" && body.status && body.status !== "ACCEPTED") {
      return reply.code(400).send({ error: "Cannot change status of an accepted quote" });
    }

    const updated = await prisma.quote.update({
      where: { id: req.params.id },
      data: {
        ...(body.status && { status: body.status as any }),
        ...(body.expirationDate && { expirationDate: new Date(body.expirationDate) }),
        ...(body.discountPct !== undefined && { discountPct: body.discountPct }),
        ...(body.taxPct !== undefined && { taxPct: body.taxPct }),
      },
      include: {
        lineItems: { include: { product: true } },
        account: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, action: "UPDATE", objectType: "Quote", recordId: updated.id, oldValues: existing, newValues: updated });
    return updated;
  });

  // Delete quote (draft only)
  app.delete("/api/v1/quotes/:id", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const existing = await prisma.quote.findFirst({ where: { id: req.params.id, tenantId: req.authUser.tenantId } });
    if (!existing) return reply.code(404).send({ error: "Quote not found" });
    if (existing.status !== "DRAFT") return reply.code(400).send({ error: "Only draft quotes can be deleted" });
    await prisma.lineItem.deleteMany({ where: { quoteId: req.params.id } });
    await prisma.quote.delete({ where: { id: req.params.id } });
    return reply.code(204).send();
  });

  // Generate & download PDF
  app.get("/api/v1/quotes/:id/pdf", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const quote = await prisma.quote.findFirst({
      where: { id: req.params.id, tenantId: req.authUser.tenantId },
      include: {
        deal: { select: { name: true } },
        account: { select: { name: true } },
        owner: { select: { firstName: true, lastName: true, email: true } },
        lineItems: { include: { product: { select: { name: true, sku: true } } }, orderBy: { createdAt: "asc" } },
        tenant: { select: { name: true } },
      },
    });
    if (!quote) return reply.code(404).send({ error: "Quote not found" });

    const pdfBuffer = await generateQuotePdf({
      quoteNumber: quote.quoteNumber,
      quoteDate: quote.quoteDate,
      expirationDate: quote.expirationDate,
      status: quote.status,
      currency: quote.currency,
      discountPct: Number(quote.discountPct),
      taxPct: Number(quote.taxPct),
      amount: Number(quote.amount),
      account: quote.account,
      deal: quote.deal,
      owner: quote.owner,
      lineItems: quote.lineItems.map((li) => ({
        product: li.product,
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        discountPct: Number(li.discountPct),
        total: Number(li.total),
      })),
      tenantName: quote.tenant.name,
    });

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${quote.quoteNumber}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // Duplicate a quote (e.g. to re-propose after a rejection)
  app.post("/api/v1/quotes/:id/duplicate", { preHandler: [app.authenticate] }, async (req: any, reply) => {
    const existing = await prisma.quote.findFirst({
      where: { id: req.params.id, tenantId: req.authUser.tenantId },
      include: { lineItems: true },
    });
    if (!existing) return reply.code(404).send({ error: "Quote not found" });

    const count = await prisma.quote.count({ where: { tenantId: req.authUser.tenantId } });
    const quoteNumber = `Q-${String(count + 1).padStart(5, "0")}`;

    const duplicate = await prisma.quote.create({
      data: {
        tenantId: req.authUser.tenantId,
        quoteNumber,
        dealId: existing.dealId,
        accountId: existing.accountId,
        ownerId: req.authUser.id,
        amount: existing.amount,
        discountPct: existing.discountPct,
        taxPct: existing.taxPct,
        currency: existing.currency,
        status: "DRAFT",
        lineItems: {
          create: existing.lineItems.map((li) => ({
            productId: li.productId,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            discountPct: li.discountPct,
            taxPct: li.taxPct,
            total: li.total,
          })),
        },
      },
      include: {
        lineItems: { include: { product: true } },
        account: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({ tenantId: req.authUser.tenantId, userId: req.authUser.id, action: "DUPLICATED", objectType: "QUOTE", recordId: duplicate.id, newValues: { duplicatedFrom: existing.id } });
    return reply.code(201).send(duplicate);
  });
}
