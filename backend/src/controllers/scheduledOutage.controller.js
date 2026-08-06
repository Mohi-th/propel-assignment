import { asyncHandler } from "../middleware/errorHandler.js";
import * as scheduledOutageService from "../services/scheduledOutage.service.js";

/**
 * GET /api/scheduled-outages
 * Get scheduled outages. Optional query params: from, to.
 */
export const getAll = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const outages = await scheduledOutageService.getScheduledOutages(from, to);
  res.json(outages);
});

/**
 * POST /api/scheduled-outages
 * Create a scheduled outage (used by simulator).
 */
export const create = asyncHandler(async (req, res) => {
  const { scope, target_id, start, end, reason } = req.body;

  if (!scope || !target_id || !start || !end) {
    return res.status(400).json({
      error: "scope, target_id, start, and end are required",
    });
  }

  const result = await scheduledOutageService.createScheduledOutage(req.body);
  res.status(201).json(result);
});
