import dotenv from "dotenv";

dotenv.config();

// For local dev, also try loading .env from parent directory
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: "../.env" });
}

const config = {
  port: parseInt(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || "development",
  db: {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "postgres",
    database: process.env.POSTGRES_DB || "power_grid",
  },
  databaseUrl: process.env.DATABASE_URL || null,
};

export default config;
