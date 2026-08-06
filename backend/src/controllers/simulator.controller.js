import { asyncHandler } from "../middleware/errorHandler.js";
import * as simulatorService from "../services/simulator.service.js";

/**
 * POST /api/simulator/fault
 * Inject a fault. Body: { type: "span"|"dt"|"feeder", targetId?: string }
 */
export const injectFault = asyncHandler(async (req, res) => {
  const { type, targetId } = req.body;

  if (!type) {
    return res.status(400).json({ error: "Fault type is required (span, dt, feeder)" });
  }

  let result;

  switch (type) {
    case "span":
      result = await simulatorService.injectSpanFault(targetId);
      break;
    case "dt":
      result = await simulatorService.injectDtFault(targetId);
      break;
    case "feeder":
      result = await simulatorService.injectFeederFault(targetId);
      break;
    default:
      return res.status(400).json({ error: "Invalid fault type. Use: span, dt, feeder" });
  }

  res.json(result);
});

/**
 * POST /api/simulator/repair
 * Repair a fault (restore power). Body: { incidentId: number }
 */
export const repairFault = asyncHandler(async (req, res) => {
  const { incidentId } = req.body;

  if (!incidentId) {
    return res.status(400).json({ error: "incidentId is required" });
  }

  const result = await simulatorService.repairFault(incidentId);
  res.json(result);
});

/**
 * POST /api/simulator/kill-device
 * Kill a device (noise test). Body: { poleId: string }
 */
export const killDevice = asyncHandler(async (req, res) => {
  const { poleId } = req.body;

  if (!poleId) {
    return res.status(400).json({ error: "poleId is required" });
  }

  const result = await simulatorService.killDevice(poleId);
  res.json(result);
});

/**
 * GET /api/simulator/network
 * Get network overview (feeders, transformers) for the simulator UI.
 */
export const getNetwork = asyncHandler(async (req, res) => {
  const overview = await simulatorService.getNetworkOverview();
  res.json(overview);
});
