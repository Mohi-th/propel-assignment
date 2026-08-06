/**
 * Incident Service
 *
 * Handles ticket lifecycle: detected → acknowledged → crew_assigned →
 * resolved → verified → closed.
 *
 * Business rules:
 * - Only forward transitions are allowed (no going back to detected)
 * - "resolved" can be rejected if poles are still dark
 * - "verified" is set automatically when telemetry confirms restoration
 * - "closed" is the final state after verification
 */

import { db } from "../db/index.js";
import { incidents, incidentPoles, poles } from "../db/schema.js";
import { eq, desc, inArray } from "drizzle-orm";

/**
 * Get all incidents, newest first.
 */
export async function getAllIncidents() {
  const results = await db
    .select()
    .from(incidents)
    .orderBy(desc(incidents.detectedAt));

  return results;
}

/**
 * Get a single incident by ID, with its affected poles.
 */
export async function getIncidentById(id) {
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) return null;

  // Get affected poles with their current state
  const affectedPoles = await db
    .select({
      poleId: incidentPoles.poleId,
      lat: poles.lat,
      lon: poles.lon,
      isEnergized: poles.isEnergized,
      deviceId: poles.deviceId,
      pincode: poles.pincode,
    })
    .from(incidentPoles)
    .innerJoin(poles, eq(incidentPoles.poleId, poles.id))
    .where(eq(incidentPoles.incidentId, id));

  return { ...incident, poles: affectedPoles };
}

/**
 * Update incident status.
 *
 * Allowed transitions:
 *   detected → acknowledged
 *   acknowledged → crew_assigned
 *   crew_assigned → resolved
 *   resolved → verified (auto only)
 *   verified → closed
 *
 * Special: "resolved" checks if poles are actually restored.
 * If not, the status stays at crew_assigned and we return a warning.
 */
export async function updateIncidentStatus(id, newStatus) {
  const [incident] = await db
    .select()
    .from(incidents)
    .where(eq(incidents.id, id));

  if (!incident) {
    throw Object.assign(new Error("Incident not found"), { statusCode: 404 });
  }

  // Define allowed transitions
  const allowedTransitions = {
    detected: ["acknowledged"],
    acknowledged: ["crew_assigned"],
    crew_assigned: ["resolved"],
    resolved: ["verified"],
    verified: ["closed"],
  };

  const allowed = allowedTransitions[incident.status] || [];
  if (!allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(
        `Cannot transition from "${incident.status}" to "${newStatus}". Allowed: ${allowed.join(", ") || "none"}`
      ),
      { statusCode: 400 }
    );
  }

  // Special check for "resolved": verify poles are actually restored
  if (newStatus === "resolved") {
    const linkedPoles = await db
      .select({ poleId: incidentPoles.poleId })
      .from(incidentPoles)
      .where(eq(incidentPoles.incidentId, id));

    const poleIds = linkedPoles.map((lp) => lp.poleId);

    if (poleIds.length > 0) {
      const currentPoles = await db
        .select({ id: poles.id, isEnergized: poles.isEnergized })
        .from(poles)
        .where(inArray(poles.id, poleIds));

      const stillDark = currentPoles.filter((p) => !p.isEnergized);

      if (stillDark.length > 0) {
        throw Object.assign(
          new Error(
            `Cannot mark as resolved: ${stillDark.length} poles are still dark. Telemetry does not confirm restoration.`
          ),
          { statusCode: 400 }
        );
      }
    }
  }

  // Build the update object with the right timestamp
  const now = new Date();
  const updateData = { status: newStatus };

  if (newStatus === "acknowledged") updateData.acknowledgedAt = now;
  if (newStatus === "crew_assigned") updateData.crewAssignedAt = now;
  if (newStatus === "resolved") updateData.resolvedAt = now;
  if (newStatus === "verified") updateData.verifiedAt = now;
  if (newStatus === "closed") updateData.closedAt = now;

  const [updated] = await db
    .update(incidents)
    .set(updateData)
    .where(eq(incidents.id, id))
    .returning();

  return updated;
}
