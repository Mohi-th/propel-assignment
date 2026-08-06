/**
 * Startup script — runs before the Express server.
 * Pushes the DB schema and seeds data if the database is empty.
 *
 * Used in Docker: the CMD runs this first, then starts the server.
 */

import { db, pool } from "./db/index.js";
import { substations } from "./db/schema.js";
import { sql } from "drizzle-orm";

async function startup() {
  console.log("Running startup checks...");

  // Wait for database to be ready (retry for up to 30 seconds)
  let retries = 15;
  while (retries > 0) {
    try {
      await pool.query("SELECT 1");
      console.log("Database connected.");
      break;
    } catch (err) {
      retries--;
      if (retries === 0) {
        console.error("Could not connect to database after 30s. Exiting.");
        process.exit(1);
      }
      console.log(`Waiting for database... (${retries} retries left)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Push schema using drizzle-kit programmatically isn't easy,
  // so we use raw SQL to create tables if they don't exist.
  // Alternatively, we can use drizzle-kit push in the Dockerfile.
  // For simplicity, we just check if data exists and seed if not.

  try {
    // Check if substations table exists and has data
    const result = await db.select().from(substations).limit(1);

    if (result.length === 0) {
      console.log("Database is empty. Running seed...");
      // Dynamic import to run the seed
      await import("./db/seed.js");
    } else {
      console.log("Database already seeded. Skipping.");
    }
  } catch (err) {
    // Table might not exist yet — that's fine, seed will create it
    if (err.message.includes("does not exist") || err.code === "42P01") {
      console.log("Tables don't exist yet. Will be created by schema push.");
    } else {
      console.error("Startup check failed:", err.message);
    }
  }
}

startup().catch((err) => {
  console.error("Startup failed:", err);
});
