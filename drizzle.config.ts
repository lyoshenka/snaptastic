import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_URL ?? "file:./local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
