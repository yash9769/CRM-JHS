import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp({ logger: true });
const port = Number(process.env.PORT) || 4000;
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`CRM API listening on port ${port}`);
});

