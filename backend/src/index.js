import express from "express";
import cors from "cors";
import config from "./config/index.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import telemetryRoutes from "./routes/telemetry.routes.js";
import incidentRoutes from "./routes/incident.routes.js";
import simulatorRoutes from "./routes/simulator.routes.js";
import poleRoutes from "./routes/pole.routes.js";
import transformerRoutes from "./routes/transformer.routes.js";
import feederRoutes from "./routes/feeder.routes.js";
import scheduledOutageRoutes from "./routes/scheduledOutage.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "5mb" })); // larger limit for batch telemetry

// API routes
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/simulator", simulatorRoutes);
app.use("/api/poles", poleRoutes);
app.use("/api/transformers", transformerRoutes);
app.use("/api/feeders", feederRoutes);
app.use("/api/scheduled-outages", scheduledOutageRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

export default app;
