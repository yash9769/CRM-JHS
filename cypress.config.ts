import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: ["tests/e2e/**/*.cy.ts", "tests/api/**/*.cy.ts"],
    supportFile: "tests/support/commands.ts",
    fixturesFolder: "tests/fixtures",
    screenshotsFolder: "cypress/screenshots",
    videosFolder: "cypress/videos",
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    env: {
      apiUrl: "http://localhost:4000/api/v1",
      MANAGER_EMAIL: process.env.CYPRESS_MANAGER_EMAIL || "manager@crm.com",
      MANAGER_PASSWORD: process.env.CYPRESS_MANAGER_PASSWORD || "Password123!",
      PARTNER_EMAIL: process.env.CYPRESS_PARTNER_EMAIL || "partner@crm.com",
      PARTNER_PASSWORD: process.env.CYPRESS_PARTNER_PASSWORD || "Password123!",
      SENIOR_PARTNER_EMAIL: process.env.CYPRESS_SENIOR_PARTNER_EMAIL || "senior.partner@crm.com",
      SENIOR_PARTNER_PASSWORD: process.env.CYPRESS_SENIOR_PARTNER_PASSWORD || "Password123!",
    },
    setupNodeEvents(on, config) {
      on("task", {
        log(message) {
          console.log(message);
          return null;
        },
      });
      return config;
    },
  },
});
