import dotenv from "dotenv";

dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: "../.env" });
}

/** @type {import("drizzle-kit").Config} */
export default {
  schema: "./src/db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: process.env.DATABASE_URL
    ? { url: process.env.DATABASE_URL }
    : {
        host: process.env.POSTGRES_HOST || "localhost",
        port: parseInt(process.env.POSTGRES_PORT) || 5432,
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "postgres",
        database: process.env.POSTGRES_DB || "power_grid",
      },
};
