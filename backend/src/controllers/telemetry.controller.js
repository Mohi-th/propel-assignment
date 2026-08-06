import { asyncHandler } from "../middleware/errorHandler.js";
import { processTelemetry, processTelemetryBatch } from "../services/telemetry.service.js";

/**
 * POST /api/telemetry
 * Accept a single telemetry event from a pole device.
 */
export const ingestTelemetry = asyncHandler(async (req, res) => {
  const result = await processTelemetry(req.body);
  res.json(result);
});

/**
 * POST /api/telemetry/batch
 * Accept a batch of telemetry events.
 */
export const ingestTelemetryBatch = asyncHandler(async (req, res) => {
  const messages = req.body;

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Body must be an array of telemetry messages" });
  }

  const results = await processTelemetryBatch(messages);
  res.json({ processed: results.length, results });
});
