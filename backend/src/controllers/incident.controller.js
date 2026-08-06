import { asyncHandler } from "../middleware/errorHandler.js";
import * as incidentService from "../services/incident.service.js";

/**
 * GET /api/incidents
 * List all incidents, newest first.
 */
export const getAll = asyncHandler(async (req, res) => {
  const incidents = await incidentService.getAllIncidents();
  res.json(incidents);
});

/**
 * GET /api/incidents/:id
 * Get a single incident with its affected poles.
 */
export const getById = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid incident ID" });
  }

  const incident = await incidentService.getIncidentById(id);

  if (!incident) {
    return res.status(404).json({ error: "Incident not found" });
  }

  res.json(incident);
});

/**
 * PATCH /api/incidents/:id
 * Update incident status (ticket lifecycle transition).
 */
export const updateStatus = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid incident ID" });
  }

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  const updated = await incidentService.updateIncidentStatus(id, status);
  res.json(updated);
});
