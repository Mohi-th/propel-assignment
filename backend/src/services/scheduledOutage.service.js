/**
 * Scheduled Outage Service
 *
 * Checks if a feeder or DT is currently under a scheduled outage.
 * Used to suppress false-positive fault alerts during load shedding
 * or planned maintenance.
 *
 * The scheduled outage feed is unreliable:
 *   - Shutdowns start late and overrun by 20-40 minutes
 *   - ~10% are cancelled without updating the feed
 * So we add a 40-minute buffer to end times.
 */

import { db } from "../db/index.js";
import { scheduledOutages } from "../db/schema.js";
import { eq, and, lte, gte } from "drizzle-orm";

const BUFFER_MINUTES = 40;

/**
 * Check if a feeder is currently in a scheduled outage window.
 */
export async function isFeederInScheduledOutage(feederId) {
  const now = new Date();

  const outages = await db
    .select()
    .from(scheduledOutages)
    .where(
      and(
        eq(scheduledOutages.scope, "feeder"),
        eq(scheduledOutages.targetId, feederId),
        lte(scheduledOutages.startTime, now)
      )
    );

  // Check if any outage covers the current time (with buffer)
  for (const outage of outages) {
    const endWithBuffer = new Date(
      outage.endTime.getTime() + BUFFER_MINUTES * 60 * 1000
    );
    if (now <= endWithBuffer) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a DT is currently in a scheduled outage window.
 * Checks both DT-level and feeder-level outages.
 */
export async function isDtInScheduledOutage(dtId, feederId) {
  const now = new Date();

  // Check DT-level outages
  const dtOutages = await db
    .select()
    .from(scheduledOutages)
    .where(
      and(
        eq(scheduledOutages.scope, "dt"),
        eq(scheduledOutages.targetId, dtId),
        lte(scheduledOutages.startTime, now)
      )
    );

  for (const outage of dtOutages) {
    const endWithBuffer = new Date(
      outage.endTime.getTime() + BUFFER_MINUTES * 60 * 1000
    );
    if (now <= endWithBuffer) {
      return true;
    }
  }

  // Also check feeder-level outages
  if (feederId) {
    return isFeederInScheduledOutage(feederId);
  }

  return false;
}

/**
 * Get all scheduled outages (for the UI / mock API).
 */
export async function getScheduledOutages(from, to) {
  let query = db.select().from(scheduledOutages);

  // Simple filtering — in production you'd add proper date range queries
  const results = await query;

  if (from || to) {
    return results.filter((o) => {
      const start = new Date(o.startTime);
      if (from && start < new Date(from)) return false;
      if (to && start > new Date(to)) return false;
      return true;
    });
  }

  return results;
}

/**
 * Create a scheduled outage (used by simulator).
 */
export async function createScheduledOutage(data) {
  const result = await db.insert(scheduledOutages).values({
    id: data.id || `SO-${Date.now()}`,
    scope: data.scope,
    targetId: data.target_id,
    startTime: new Date(data.start),
    endTime: new Date(data.end),
    reason: data.reason || "Scheduled outage",
  });

  return result;
}
