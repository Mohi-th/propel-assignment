/**
 * Simulator Service
 *
 * Lets the evaluator inject faults and repairs from the UI.
 * This is how the system gets evaluated (Gate G5).
 *
 * What it does:
 * 1. Inject a fault (span/DT/feeder) → marks poles as dark, sends
 *    simulated telemetry (with realistic 30% message loss)
 * 2. Repair a fault → marks poles as energized, sends restoration telemetry
 * 3. Kill a device → stops a device without affecting power (noise test)
 */

import { db } from "../db/index.js";
import { poles, transformers, feeders } from "../db/schema.js";
import { eq, inArray } from "drizzle-orm";
import { processTelemetry } from "./telemetry.service.js";

// Simple counter for seq values (fits in PostgreSQL integer)
let seqCounter = 1;

/**
 * Batch update poles as dark/live using a single query.
 * Much faster than updating one by one.
 */
async function batchUpdatePoles(poleIds, isEnergized) {
  if (poleIds.length === 0) return;
  await db
    .update(poles)
    .set({ isEnergized, lastSeenAt: new Date() })
    .where(inArray(poles.id, poleIds));
}

/**
 * Send telemetry for a list of poles with realistic message loss.
 * Returns { sent, dropped } counts.
 */
async function sendTelemetryBurst(polesToNotify, event, energized) {
  let sent = 0;
  let dropped = 0;

  for (const pole of polesToNotify) {
    if (!pole.deviceId) continue;

    // 30% message loss
    if (Math.random() < 0.3) {
      dropped++;
      continue;
    }

    // Firmware 1.2.x doesn't send power_lost
    if (!energized && pole.fwVersion && pole.fwVersion.startsWith("1.2")) {
      dropped++;
      continue;
    }

    await processTelemetry({
      device_id: pole.deviceId,
      pole_id: pole.id,
      event,
      energized,
      ts: new Date().toISOString(),
      seq: seqCounter++,
      battery_mv: energized ? 3600 : 3400,
      rssi: -85,
      fw: pole.fwVersion || "1.4.2",
    });
    sent++;
  }

  return { sent, dropped };
}

/**
 * Inject a span fault between two poles.
 */
export async function injectSpanFault(dtId) {
  let dt;
  if (dtId) {
    [dt] = await db.select().from(transformers).where(eq(transformers.id, dtId));
  } else {
    const allDts = await db.select().from(transformers);
    dt = allDts[Math.floor(Math.random() * allDts.length)];
  }

  if (!dt) {
    throw Object.assign(new Error("Transformer not found"), { statusCode: 404 });
  }

  const dtPoles = await db.select().from(poles).where(eq(poles.dtId, dt.id));

  if (dtPoles.length < 3) {
    throw Object.assign(
      new Error("Not enough poles under this DT to simulate a span fault"),
      { statusCode: 400 }
    );
  }

  let sortedPoles;
  if (dt.hasTopology) {
    sortedPoles = dtPoles
      .filter((p) => p.seqOnLine !== null)
      .sort((a, b) => a.seqOnLine - b.seqOnLine);
  } else {
    sortedPoles = [...dtPoles];
  }

  if (sortedPoles.length < 3) sortedPoles = [...dtPoles];

  const faultIndex = Math.max(1, Math.floor(sortedPoles.length / 3));
  const darkPoles = sortedPoles.slice(faultIndex);
  const livePoles = sortedPoles.slice(0, faultIndex);

  // Batch update — one query instead of N queries
  await batchUpdatePoles(darkPoles.map((p) => p.id), false);

  // Send telemetry with realistic drops
  const { sent, dropped } = await sendTelemetryBurst(darkPoles, "power_lost", false);

  return {
    faultType: "span",
    dtId: dt.id,
    hasTopology: dt.hasTopology,
    livePoles: livePoles.length,
    darkPoles: darkPoles.length,
    telemetrySent: sent,
    telemetryDropped: dropped,
    message: `Span fault injected on ${dt.id}. ${darkPoles.length} poles went dark, ${sent} telemetry messages sent (${dropped} dropped).`,
  };
}

/**
 * Inject a DT-level fault. All poles under the DT go dark.
 */
export async function injectDtFault(dtId) {
  let dt;
  if (dtId) {
    [dt] = await db.select().from(transformers).where(eq(transformers.id, dtId));
  } else {
    const allDts = await db.select().from(transformers);
    dt = allDts[Math.floor(Math.random() * allDts.length)];
  }

  if (!dt) {
    throw Object.assign(new Error("Transformer not found"), { statusCode: 404 });
  }

  const dtPoles = await db.select().from(poles).where(eq(poles.dtId, dt.id));

  // Batch update — one query
  await batchUpdatePoles(dtPoles.map((p) => p.id), false);

  const { sent, dropped } = await sendTelemetryBurst(dtPoles, "power_lost", false);

  return {
    faultType: "dt",
    dtId: dt.id,
    darkPoles: dtPoles.length,
    telemetrySent: sent,
    telemetryDropped: dropped,
    message: `DT fault injected on ${dt.id}. All ${dtPoles.length} poles went dark.`,
  };
}

/**
 * Inject a feeder-level fault. All poles under all DTs on this feeder go dark.
 */
export async function injectFeederFault(feederId) {
  let feeder;
  if (feederId) {
    [feeder] = await db.select().from(feeders).where(eq(feeders.id, feederId));
  } else {
    const allFeeders = await db.select().from(feeders);
    feeder = allFeeders[Math.floor(Math.random() * allFeeders.length)];
  }

  if (!feeder) {
    throw Object.assign(new Error("Feeder not found"), { statusCode: 404 });
  }

  // Get ALL poles on this feeder in one query
  const feederPoles = await db
    .select()
    .from(poles)
    .where(eq(poles.feederId, feeder.id));

  // Batch update — one query for all poles
  await batchUpdatePoles(feederPoles.map((p) => p.id), false);

  const { sent, dropped } = await sendTelemetryBurst(feederPoles, "power_lost", false);

  return {
    faultType: "feeder",
    feederId: feeder.id,
    darkPoles: feederPoles.length,
    telemetrySent: sent,
    telemetryDropped: dropped,
    message: `Feeder fault injected on ${feeder.id}. ${feederPoles.length} poles went dark.`,
  };
}

/**
 * Repair a fault — restore power to all poles linked to an incident.
 */
export async function repairFault(incidentId) {
  const incidentService = await import("./incident.service.js");
  const incident = await incidentService.getIncidentById(incidentId);

  if (!incident) {
    throw Object.assign(new Error("Incident not found"), { statusCode: 404 });
  }

  if (incident.status === "verified" || incident.status === "closed") {
    throw Object.assign(
      new Error("Incident is already verified/closed"),
      { statusCode: 400 }
    );
  }

  // Batch update — one query
  const poleIds = incident.poles.map((p) => p.poleId);
  await batchUpdatePoles(poleIds, true);

  // Send restoration telemetry
  const polesToNotify = incident.poles.filter((p) => p.deviceId);
  let sent = 0;

  for (const pole of polesToNotify) {
    await processTelemetry({
      device_id: pole.deviceId,
      pole_id: pole.poleId,
      event: "boot",
      energized: true,
      ts: new Date().toISOString(),
      seq: seqCounter++,
      battery_mv: 3600,
      rssi: -80,
      fw: "1.4.2",
    });
    sent++;

    await processTelemetry({
      device_id: pole.deviceId,
      pole_id: pole.poleId,
      event: "power_restored",
      energized: true,
      ts: new Date().toISOString(),
      seq: seqCounter++,
      battery_mv: 3600,
      rssi: -80,
      fw: "1.4.2",
    });
    sent++;
  }

  return {
    incidentId,
    restoredPoles: incident.poles.length,
    telemetrySent: sent,
    message: `Repair simulated for incident #${incidentId}. ${incident.poles.length} poles restored, ${sent} telemetry messages sent.`,
  };
}

/**
 * Kill a device — simulates a device dying while power is fine.
 * This should NOT create a fault ticket (noise test).
 */
export async function killDevice(poleId) {
  const [pole] = await db.select().from(poles).where(eq(poles.id, poleId));

  if (!pole) {
    throw Object.assign(new Error("Pole not found"), { statusCode: 404 });
  }

  if (!pole.deviceId) {
    throw Object.assign(
      new Error("This pole has no device to kill"),
      { statusCode: 400 }
    );
  }

  const oldDate = new Date(Date.now() - 60 * 60 * 1000);
  await db
    .update(poles)
    .set({ lastSeenAt: oldDate })
    .where(eq(poles.id, poleId));

  return {
    poleId,
    deviceId: pole.deviceId,
    message: `Device on ${poleId} killed. Pole is still energized but device stopped reporting. This should NOT trigger a fault alert.`,
  };
}

/**
 * Get network overview for the simulator UI.
 */
export async function getNetworkOverview() {
  const allFeeders = await db.select().from(feeders);
  const allDts = await db.select().from(transformers);
  const allPoles = await db.select().from(poles);

  const dtPoleCount = {};
  for (const pole of allPoles) {
    dtPoleCount[pole.dtId] = (dtPoleCount[pole.dtId] || 0) + 1;
  }

  const dtsWithCount = allDts.map((dt) => ({
    ...dt,
    poleCount: dtPoleCount[dt.id] || 0,
  }));

  return {
    feeders: allFeeders,
    transformers: dtsWithCount,
  };
}
