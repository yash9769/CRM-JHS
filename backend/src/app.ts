import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { registerAuth } from "./plugins/auth.js";

import authRoutes from "./routes/auth.js";
import pipelineRoutes from "./routes/pipelines.js";
import accountRoutes from "./routes/accounts.js";
import leadRoutes from "./routes/leads.js";
import savedViewRoutes from "./routes/savedViews.js";
import auditHistoryRoutes from "./routes/auditHistory.js";
import contactRoutes from "./routes/contacts.js";
import opportunityRoutes from "./routes/opportunities.js";
import dealRoutes from "./routes/deals.js";
import productRoutes from "./routes/products.js";
import activityRoutes from "./routes/activities.js";
import dashboardRoutes from "./routes/dashboard.js";
import quoteRoutes from "./routes/quotes.js";
import sequenceRoutes from "./routes/sequences.js";
import forecastingRoutes from "./routes/forecasting.js";
import notificationRoutes from "./routes/notifications.js";
import searchRoutes from "./routes/search.js";
import reportRoutes from "./routes/reports.js";
import userRoutes from "./routes/users.js";

export async function buildApp(opts = {}) {
  const app = Fastify({ logger: false, ...opts });

  await app.register(cors, { origin: true });
  await registerAuth(app);

  app.get("/api/v1/health", async () => ({ status: "ok" }));

  app.setErrorHandler((err: any, _req, reply) => {
    let issues = err.issues;
    if (!issues && typeof err.message === "string" && err.message.trim().startsWith("[")) {
      try {
        const parsed = JSON.parse(err.message);
        if (Array.isArray(parsed) && parsed[0]?.code) {
          issues = parsed;
        }
      } catch {}
    }

    if (err.name === "ZodError" || err instanceof ZodError || issues) {
      return reply.code(400).send({ error: "Validation error", details: issues || err.message });
    }

    app.log.error(err);
    const status = err.statusCode || (err.status && typeof err.status === "number" ? err.status : 500);
    reply.code(status).send({ error: err.message || "Internal server error" });
  });

  await app.register(authRoutes);
  await app.register(pipelineRoutes);
  await app.register(accountRoutes);
  await app.register(leadRoutes);
  await app.register(savedViewRoutes);
  await app.register(auditHistoryRoutes);
  await app.register(contactRoutes);
  await app.register(opportunityRoutes);
  await app.register(dealRoutes);
  await app.register(productRoutes);
  await app.register(activityRoutes);
  await app.register(dashboardRoutes);
  await app.register(quoteRoutes);
  await app.register(sequenceRoutes);
  await app.register(forecastingRoutes);
  await app.register(notificationRoutes);
  await app.register(searchRoutes);
  await app.register(reportRoutes);
  await app.register(userRoutes);

  return app;
}
