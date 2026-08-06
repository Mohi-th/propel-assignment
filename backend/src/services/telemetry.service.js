import { db } from "../db/index.js";
import { telemetryEvents, poles } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { runLocalization } from "./localization.service.js";

/**
 * Debounce timer for localization.
 * Instead of triggering localization on every single event,
 * we wait 2 seconds after the LAST event. This way a burst
 * of 50 power_lost events only triggers one localization run.
 */
let localizationTimer = null;

function scheduleLocalization() {
  if (localizationTimer) clearTimeout(localizationTimer);
  localizationTimer = setTimeout(() => {
    localizationTimer = null;
    runLocalization().catch((err) =>
      console.error("Localization error:", err.message)
    );
  }, 2000);
}

/**
 * Processes an incoming telemetry message from a pole device.
 *
 * Steps:
 * 1. Validate required fields
 * 2. De-duplicate using (device_id, seq)
 * 3. Store the event
 * 4. Update the pole's current state
 * 5. If power_lost, trigger fault localization (debounced)
 */
export async function processTelemetry(payload) {
  const { device_id, pole_id, event, energized, ts, seq, battery_mv, rssi, fw } = payload;

  if (!device_id || !pole_id || !event || energized === undefined || !ts || seq === undefined) {
    throw Object.assign(new Error("Missing required telemetry fields"), { statusCode: 400 });
  }

  const validEvents = ["heartbeat", "power_lost", "power_restored", "boot"];
  if (!validEvents.includes(event)) {
    throw Object.assign(new Error(`Invalid event type: ${event}`), { statusCode: 400 });
  }

  // De-duplicate: check if we already have this (device_id, seq) combo
  const existing = await db
    .select({ id: telemetryEvents.id })
    .from(telemetryEvents)
    .where(and(eq(telemetryEvents.deviceId, device_id), eq(telemetryEvents.seq, seq)))
    .limit(1);

  if (existing.length > 0) {
    return { status: "duplicate", message: "Event already processed" };
  }

  // Check if this is a stale message (device clock > 30 minutes old)
  const eventTime = new Date(ts);
  const now = new Date();
  const ageMs = now.getTime() - eventTime.getTime();
  const isStale = ageMs > 30 * 60 * 1000;

  // Store the event
  await db.insert(telemetryEvents).values({
    deviceId: device_id,
    poleId: pole_id,
    event,
    energized,
    ts: eventTime,
    seq,
    batteryMv: battery_mv || null,
    rssi: rssi || null,
    fw: fw || null,
    receivedAt: now,
  });

  // Update the pole's current state (skip stale messages)
  if (!isStale) {
    await db
      .update(poles)
      .set({
        isEnergized: energized,
        lastSeenAt: now,
        fwVersion: fw || undefined,
      })
      .where(eq(poles.id, pole_id));

    // If power state changed, schedule localization (debounced)
    if (event === "power_lost" || event === "power_restored" || event === "boot") {
      scheduleLocalization();
    }
  }

  return { status: "ok", stale: isStale };
}

/**
 * Process a batch of telemetry messages.
 * Used for burst handling.
 */
export async function processTelemetryBatch(messages) {
  const results = [];
  for (const msg of messages) {
    try {
      const result = await processTelemetry(msg);
      results.push({ pole_id: msg.pole_id, ...result });
    } catch (err) {
      results.push({ pole_id: msg.pole_id, status: "error", message: err.message });
    }
  }
  return results;
}
