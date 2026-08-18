import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Chargement prioritaire de .env.local (convention Next.js), puis fallback sur .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema/*",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
});
