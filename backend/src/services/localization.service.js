/**
 * Localization Service — the core fault detection algorithm.
 *
 * This is the brain of the system. It runs periodically and when
 * triggered by a power_lost event. It:
 *
 * 1. Gets all transformers grouped by feeder
 * 2. Checks for feeder-level faults first (all DTs on a feeder dark)
 * 3. For each DT, checks if there are dark poles
 * 4. For known topology (40%): walks the tree to find the exact
 *    live/dark boundary → span-level localization
 * 5. For unknown topology (60%): groups dark poles by DT →
 *    DT-level localization
 * 6. Checks scheduled outages to avoid false positives
 * 7. Creates incidents for real faults (avoids duplicates)
 */

import { db } from "../db/index.js";
import {
  poles,
  transformers,
  feeders,
  incidents,
  incidentPoles,
} from "../db/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { buildTreeForDt, findFaultBoundaries } from "./topology.service.js";
import {
  isDtInScheduledOutage,
  isFeederInScheduledOutage,
} from "./scheduledOutage.service.js";

// Prevent concurrent localization runs
let isRunning = false;

/**
 * Main localization entry point. Called after telemetry events arrive.
 */
export async function runLocalization() {
  if (isRunning) return;
  isRunning = true;

  try {
    const allDts = await db.select().from(transformers);
    const allFeeders = await db.select().from(feeders);
    const allPoles = await db.select().from(poles);

    // Group DTs by feeder
    const dtsByFeeder = {};
    for (const dt of allDts) {
      if (!dtsByFeeder[dt.feederId]) dtsByFeeder[dt.feederId] = [];
      dtsByFeeder[dt.feederId].push(dt);
    }

    // Group poles by DT
    const polesByDt = {};
    for (const pole of allPoles) {
      if (!polesByDt[pole.dtId]) polesByDt[pole.dtId] = [];
      polesByDt[pole.dtId].push(pole);
    }

    // Track which DTs are handled by a feeder-level incident
    const handledDts = new Set();

    // --- Step 1: Check for feeder-level faults ---
    for (const feeder of allFeeders) {
      const feederDts = dtsByFeeder[feeder.id] || [];
      if (feederDts.length === 0) continue;

      // Check if ALL DTs on this feeder have mostly dark poles
      let allDtsDark = true;
      let totalDarkPoles = 0;
      let totalPolesWithDevices = 0;
      const allDarkPoleIds = [];

      for (const dt of feederDts) {
        const dtPoles = polesByDt[dt.id] || [];
        const withDevices = dtPoles.filter((p) => p.deviceId);
        const dark = withDevices.filter((p) => !p.isEnergized);

        totalPolesWithDevices += withDevices.length;
        totalDarkPoles += dark.length;
        allDarkPoleIds.push(...dark.map((p) => p.id));

        // A DT is "dark" if more than half its poles with devices are dark
        if (withDevices.length > 0 && dark.length < withDevices.length * 0.5) {
          allDtsDark = false;
        }
      }

      // Feeder fault: all DTs are dark AND there are enough dark poles
      if (!allDtsDark || totalDarkPoles < 3) continue;

      // Check scheduled outage
      const isScheduled = await isFeederInScheduledOutage(feeder.id);
      if (isScheduled) continue;

      // Check for existing feeder-level incident
      const existing = await db
        .select()
        .from(incidents)
        .where(
          and(
            eq(incidents.feederId, feeder.id),
            eq(incidents.faultType, "feeder"),
            inArray(incidents.status, [
              "detected",
              "acknowledged",
              "crew_assigned",
            ])
          )
        );

      if (existing.length > 0) {
        // Mark these DTs as handled so we don't create DT-level incidents too
        for (const dt of feederDts) handledDts.add(dt.id);
        continue;
      }

      // Calculate feeder location as average of its DT positions
      const feederLat =
        feederDts.reduce((sum, dt) => sum + dt.lat, 0) / feederDts.length;
      const feederLon =
        feederDts.reduce((sum, dt) => sum + dt.lon, 0) / feederDts.length;

      const pincode = allPoles.find(
        (p) => p.feederId === feeder.id && p.pincode
      )?.pincode || null;

      await createIncident({
        faultType: "feeder",
        localizationType: "feeder",
        dtId: feederDts[0].id,
        feederId: feeder.id,
        lat: feederLat,
        lon: feederLon,
        pincode,
        affectedPoles: totalDarkPoles,
        confidence: "high",
        confidenceReason: `All ${feederDts.length} transformers on feeder ${feeder.id} are dark (${totalDarkPoles} poles affected). Likely an 11kV feeder fault or substation issue.`,
        darkPoleIds: allDarkPoleIds,
      });

      // Mark these DTs as handled
      for (const dt of feederDts) handledDts.add(dt.id);
    }

    // --- Step 2: Check each DT individually ---
    for (const dt of allDts) {
      // Skip if already handled by a feeder-level incident
      if (handledDts.has(dt.id)) continue;

      const dtPoles = polesByDt[dt.id] || [];
      if (dtPoles.length === 0) continue;

      const polesWithDevices = dtPoles.filter((p) => p.deviceId);
      const darkPoles = polesWithDevices.filter((p) => !p.isEnergized);

      if (darkPoles.length === 0) continue;

      // Check scheduled outage
      const isScheduled = await isDtInScheduledOutage(dt.id, dt.feederId);
      if (isScheduled) continue;

      // Check existing incident for this DT
      const existing = await db
        .select()
        .from(incidents)
        .where(
          and(
            eq(incidents.dtId, dt.id),
            inArray(incidents.status, [
              "detected",
              "acknowledged",
              "crew_assigned",
            ])
          )
        );

      if (existing.length > 0) continue;

      if (dt.hasTopology) {
        await localizeWithTopology(dt, dtPoles);
      } else {
        await localizeWithoutTopology(dt, dtPoles, darkPoles);
      }
    }

    // --- Step 3: Auto-verification ---
    await checkAutoVerification();
  } catch (err) {
    console.error("Localization run failed:", err.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Span-level localization for DTs with known topology.
 */
async function localizeWithTopology(dt, dtPoles) {
  const tree = await buildTreeForDt(dt.id);
  if (!tree) return;

  const boundaries = findFaultBoundaries(tree);

  for (const boundary of boundaries) {
    if (boundary.type === "all_dark") {
      const allDark = dtPoles.filter((p) => !p.isEnergized);
      await createIncident({
        faultType: "dt",
        localizationType: "dt",
        dtId: dt.id,
        feederId: dt.feederId,
        lat: dt.lat,
        lon: dt.lon,
        pincode: dtPoles[0]?.pincode || null,
        affectedPoles: allDark.length,
        confidence: "high",
        confidenceReason:
          "All poles under this transformer are dark. Likely a transformer or fuse failure.",
        darkPoleIds: allDark.map((p) => p.id),
      });
    } else if (boundary.type === "span") {
      const liveNode = tree.nodes[boundary.livePoleId];
      const darkNode = tree.nodes[boundary.darkPoleId];

      const faultLat = (liveNode.lat + darkNode.lat) / 2;
      const faultLon = (liveNode.lon + darkNode.lon) / 2;
      const pincode = darkNode.pincode || liveNode.pincode || null;

      const affectedIds = collectDarkDescendants(
        boundary.darkPoleId,
        tree.nodes
      );

      await createIncident({
        faultType: "span",
        localizationType: "span",
        faultSpanFrom: boundary.livePoleId,
        faultSpanTo: boundary.darkPoleId,
        dtId: dt.id,
        feederId: dt.feederId,
        lat: faultLat,
        lon: faultLon,
        pincode,
        affectedPoles: boundary.affectedPoles,
        confidence: "high",
        confidenceReason: `Clear live/dark boundary between ${boundary.livePoleId} (live) and ${boundary.darkPoleId} (dark). Span-level fault on known topology.`,
        darkPoleIds: affectedIds,
      });
    }
  }
}

/**
 * DT-level localization for transformers without known topology.
 * Threshold: at least 2 dark poles to avoid false positives.
 */
async function localizeWithoutTopology(dt, dtPoles, darkPoles) {
  if (darkPoles.length < 2) return;

  const pincode = darkPoles[0]?.pincode || dtPoles[0]?.pincode || null;

  await createIncident({
    faultType: "span",
    localizationType: "dt",
    dtId: dt.id,
    feederId: dt.feederId,
    lat: dt.lat,
    lon: dt.lon,
    pincode,
    affectedPoles: darkPoles.length,
    confidence: "medium",
    confidenceReason: `Pole ordering not available for transformer ${dt.id}. ${darkPoles.length} poles are dark. Fault localized to transformer level only.`,
    darkPoleIds: darkPoles.map((p) => p.id),
  });
}

/**
 * Collect all dark pole IDs from a node downward.
 */
function collectDarkDescendants(nodeId, nodes) {
  const ids = [];
  const node = nodes[nodeId];
  if (!node) return ids;

  if (!node.isEnergized) ids.push(nodeId);

  for (const childId of node.children) {
    ids.push(...collectDarkDescendants(childId, nodes));
  }

  return ids;
}

/**
 * Create an incident in the database.
 */
async function createIncident(data) {
  const [incident] = await db
    .insert(incidents)
    .values({
      faultType: data.faultType,
      status: "detected",
      localizationType: data.localizationType,
      faultSpanFrom: data.faultSpanFrom || null,
      faultSpanTo: data.faultSpanTo || null,
      dtId: data.dtId,
      feederId: data.feederId,
      lat: data.lat,
      lon: data.lon,
      pincode: data.pincode,
      affectedPoles: data.affectedPoles,
      confidence: data.confidence,
      confidenceReason: data.confidenceReason,
      detectedAt: new Date(),
    })
    .returning();

  // Link affected poles to the incident
  if (data.darkPoleIds && data.darkPoleIds.length > 0) {
    const poleLinkData = data.darkPoleIds.map((poleId) => ({
      incidentId: incident.id,
      poleId,
    }));

    const BATCH = 500;
    for (let i = 0; i < poleLinkData.length; i += BATCH) {
      await db.insert(incidentPoles).values(poleLinkData.slice(i, i + BATCH));
    }
  }

  console.log(
    `Incident #${incident.id} created: ${data.faultType} fault at ${data.localizationType} level, ${data.affectedPoles} poles affected`
  );

  return incident;
}

/**
 * Auto-verification: checks if active incidents have been restored.
 */
export async function checkAutoVerification() {
  const activeIncidents = await db
    .select()
    .from(incidents)
    .where(
      inArray(incidents.status, [
        "detected",
        "acknowledged",
        "crew_assigned",
        "resolved",
      ])
    );

  for (const incident of activeIncidents) {
    const linkedPoles = await db
      .select({ poleId: incidentPoles.poleId })
      .from(incidentPoles)
      .where(eq(incidentPoles.incidentId, incident.id));

    if (linkedPoles.length === 0) continue;

    const poleIds = linkedPoles.map((lp) => lp.poleId);

    const currentPoles = await db
      .select({ id: poles.id, isEnergized: poles.isEnergized })
      .from(poles)
      .where(inArray(poles.id, poleIds));

    const allEnergized = currentPoles.every((p) => p.isEnergized);

    if (allEnergized) {
      const now = new Date();
      await db
        .update(incidents)
        .set({
          status: "verified",
          verifiedAt: now,
          resolvedAt: incident.resolvedAt || now,
        })
        .where(eq(incidents.id, incident.id));

      console.log(`Incident #${incident.id} auto-verified: all poles restored`);
    } else if (incident.status === "resolved") {
      await db
        .update(incidents)
        .set({ status: "crew_assigned", resolvedAt: null })
        .where(eq(incidents.id, incident.id));

      console.log(
        `Incident #${incident.id} rejected: marked resolved but ${currentPoles.filter((p) => !p.isEnergized).length} poles still dark`
      );
    }
  }
}
