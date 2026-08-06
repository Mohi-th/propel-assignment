import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import config from "../config/index.js";
import * as schema from "./schema.js";

/**
 * Uses DATABASE_URL if available (for Neon, Supabase, etc.)
 * Falls back to individual connection params (for Docker).
 */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.POSTGRES_HOST === "db"
    ? false
    : { rejectUnauthorized: false },
});

const db = drizzle(pool, { schema });

export { pool, db };
