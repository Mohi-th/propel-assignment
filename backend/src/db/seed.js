/**
 * Seed script — generates a synthetic power distribution network.
 *
 * Shape:
 *   4 substations → ~30 feeders → ~50 DTs → ~3000 poles
 *   40% of DTs have full topology (seq_on_line, parent_pole_id)
 *   60% of DTs have only dt_id + GPS (no topology)
 *   ~9% of poles have no device
 *   ~3% of poles have no pincode
 *
 * This runs on startup via docker-compose, so the reviewer sees
 * a working system immediately.
 */

import { db, pool } from "./index.js";
import {
  substations,
  feeders,
  transformers,
  poles,
  scheduledOutages,
} from "./schema.js";
import { sql } from "drizzle-orm";

// --- Helpers ---

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Bangalore area coordinates as center
const CENTER_LAT = 12.9716;
const CENTER_LON = 77.5946;

// PIN codes in the Bangalore area
const PINCODES = [
  "560001", "560002", "560003", "560004", "560005",
  "560008", "560009", "560010", "560011", "560012",
  "560017", "560018", "560020", "560021", "560022",
  "560024", "560025", "560027", "560029", "560030",
  "560033", "560034", "560036", "560038", "560040",
  "560041", "560043", "560045", "560047", "560048",
  "560050", "560051", "560052", "560053", "560054",
  "560055", "560056", "560058", "560060", "560062",
  "560064", "560066", "560068", "560070", "560071",
  "560073", "560075", "560076", "560078", "560079",
];

const POLE_TYPES = [
  "LT-8m-Steel",
  "LT-9m-PCC",
  "LT-9m-Steel",
  "LT-10m-PCC",
  "LT-11m-Steel",
];

const FW_VERSIONS = ["1.2.0", "1.2.1", "1.3.0", "1.3.1", "1.4.0", "1.4.2"];

/**
 * Generates pole positions along a line from the DT location.
 * Simulates a realistic LT line: main run with occasional branches.
 */
function generatePolePositions(dtLat, dtLon, count) {
  const positions = [];
  // Pick a random direction for the main line
  const angle = randomBetween(0, 2 * Math.PI);
  // Pole spacing: ~30-50 meters
  const spacing = randomBetween(0.0003, 0.0005); // roughly 30-50m in degrees

  let currentLat = dtLat;
  let currentLon = dtLon;

  // Main line
  const mainLineCount = Math.ceil(count * 0.7);
  const branchCount = count - mainLineCount;

  for (let i = 0; i < mainLineCount; i++) {
    // Add some jitter to make it look like a real road-following line
    const jitter = randomBetween(-0.00005, 0.00005);
    currentLat += Math.cos(angle) * spacing + jitter;
    currentLon += Math.sin(angle) * spacing + jitter;
    positions.push({
      lat: currentLat,
      lon: currentLon,
      isBranch: false,
      mainLineIndex: i,
    });
  }

  // Branch(es) off the main line
  if (branchCount > 0 && mainLineCount > 3) {
    // Pick a branch point somewhere in the middle of the main line
    const branchPointIndex = randomInt(2, mainLineCount - 2);
    const branchPoint = positions[branchPointIndex];
    const branchAngle = angle + randomBetween(Math.PI / 4, Math.PI / 2);

    let branchLat = branchPoint.lat;
    let branchLon = branchPoint.lon;

    for (let i = 0; i < branchCount; i++) {
      const jitter = randomBetween(-0.00005, 0.00005);
      branchLat += Math.cos(branchAngle) * spacing + jitter;
      branchLon += Math.sin(branchAngle) * spacing + jitter;
      positions.push({
        lat: branchLat,
        lon: branchLon,
        isBranch: true,
        branchPointIndex,
        branchIndex: i,
      });
    }
  }

  return positions;
}

async function seed() {
  console.log("Seeding database...");

  // Clear existing data (order matters due to foreign keys)
  await db.delete(scheduledOutages);
  await db.delete(poles);
  await db.delete(transformers);
  await db.delete(feeders);
  await db.delete(substations);

  // Also clear incidents and related tables
  await db.execute(sql`DELETE FROM incident_poles`);
  await db.execute(sql`DELETE FROM incidents`);
  await db.execute(sql`DELETE FROM telemetry_events`);

  // --- 1. Substations ---
  const substationData = [];
  for (let i = 1; i <= 4; i++) {
    substationData.push({
      id: `SS-0${i}`,
      name: `Substation ${i}`,
      lat: CENTER_LAT + randomBetween(-0.03, 0.03),
      lon: CENTER_LON + randomBetween(-0.03, 0.03),
    });
  }
  await db.insert(substations).values(substationData);
  console.log(`  Created ${substationData.length} substations`);

  // --- 2. Feeders ---
  const feederData = [];
  let feederCount = 0;
  for (const ss of substationData) {
    const feedersPerSS = randomInt(6, 9);
    for (let j = 1; j <= feedersPerSS; j++) {
      feederCount++;
      feederData.push({
        id: `F-${ss.id.replace("SS-", "")}-${String(j).padStart(2, "0")}`,
        substationId: ss.id,
        name: `Feeder ${feederCount}`,
      });
    }
  }
  await db.insert(feeders).values(feederData);
  console.log(`  Created ${feederData.length} feeders`);

  // --- 3. Transformers ---
  const transformerData = [];
  let dtCount = 0;
  for (const feeder of feederData) {
    const ss = substationData.find((s) => s.id === feeder.substationId);
    const dtsPerFeeder = randomInt(1, 3);
    for (let k = 1; k <= dtsPerFeeder; k++) {
      dtCount++;
      // 40% have topology, 60% do not
      const hasTopology = Math.random() < 0.4;
      transformerData.push({
        id: `D-${String(dtCount).padStart(4, "0")}`,
        feederId: feeder.id,
        lat: ss.lat + randomBetween(-0.015, 0.015),
        lon: ss.lon + randomBetween(-0.015, 0.015),
        capacityKva: pickRandom([100, 160, 250, 315, 500]),
        householdsServed: randomInt(50, 500),
        hasTopology,
      });
    }
  }
  await db.insert(transformers).values(transformerData);
  console.log(
    `  Created ${transformerData.length} transformers (${transformerData.filter((d) => d.hasTopology).length} with topology)`
  );

  // --- 4. Poles ---
  let poleCount = 0;
  let totalPoles = 0;
  const allPoleData = [];

  for (const dt of transformerData) {
    const polesPerDt = randomInt(15, 80);
    const positions = generatePolePositions(dt.lat, dt.lon, polesPerDt);
    const dtPincode = pickRandom(PINCODES);
    const ward = `W-${String(randomInt(1, 120)).padStart(3, "0")}`;

    for (let p = 0; p < positions.length; p++) {
      poleCount++;
      totalPoles++;

      const poleId = `P-${String(poleCount).padStart(6, "0")}`;
      const pos = positions[p];

      // ~9% of poles have no device
      const hasDevice = Math.random() > 0.09;
      const deviceId = hasDevice
        ? `KSPDB-${dt.feederId.replace("F-", "SD")}-${dt.id}-${poleCount}`
        : null;

      // ~3% missing pincode
      const pincode = Math.random() > 0.03 ? dtPincode : null;

      // Firmware: ~8% on 1.2.x
      let fwVersion = null;
      if (hasDevice) {
        fwVersion =
          Math.random() < 0.08
            ? pickRandom(["1.2.0", "1.2.1"])
            : pickRandom(["1.3.0", "1.3.1", "1.4.0", "1.4.2"]);
      }

      // Topology fields: only for DTs that have topology
      let seqOnLine = null;
      let parentPoleId = null;

      if (dt.hasTopology) {
        if (pos.isBranch) {
          seqOnLine = positions.length - positions.filter(pp => !pp.isBranch).length + pos.branchIndex + 1;
          if (pos.branchIndex === 0) {
            // First branch pole's parent is the main line pole at the branch point
            const branchPointPoleIndex = pos.branchPointIndex;
            const branchPointGlobalId = `P-${String(poleCount - (p - branchPointPoleIndex)).padStart(6, "0")}`;
            parentPoleId = branchPointGlobalId;
          } else {
            // Parent is the previous branch pole
            parentPoleId = `P-${String(poleCount - 1).padStart(6, "0")}`;
          }
        } else {
          seqOnLine = pos.mainLineIndex + 1;
          if (pos.mainLineIndex === 0) {
            parentPoleId = null; // First pole, parent is the DT itself
          } else {
            parentPoleId = `P-${String(poleCount - 1).padStart(6, "0")}`;
          }
        }
      }

      allPoleData.push({
        id: poleId,
        lat: pos.lat,
        lon: pos.lon,
        feederId: dt.feederId,
        dtId: dt.id,
        seqOnLine,
        parentPoleId,
        poleType: pickRandom(POLE_TYPES),
        ward,
        pincode,
        deviceId,
        isEnergized: true,
        lastSeenAt: new Date(),
        fwVersion,
      });
    }
  }

  // Insert poles in batches of 500 (Postgres has a parameter limit)
  const BATCH_SIZE = 500;
  for (let i = 0; i < allPoleData.length; i += BATCH_SIZE) {
    const batch = allPoleData.slice(i, i + BATCH_SIZE);
    await db.insert(poles).values(batch);
  }
  console.log(`  Created ${totalPoles} poles`);
  console.log(
    `    - With devices: ${allPoleData.filter((p) => p.deviceId).length}`
  );
  console.log(
    `    - Without devices: ${allPoleData.filter((p) => !p.deviceId).length}`
  );
  console.log(
    `    - Missing pincode: ${allPoleData.filter((p) => !p.pincode).length}`
  );
  console.log(
    `    - Firmware 1.2.x: ${allPoleData.filter((p) => p.fwVersion && p.fwVersion.startsWith("1.2")).length}`
  );

  // --- 5. Scheduled Outages (a few samples) ---
  const now = new Date();
  const scheduledOutageData = [
    {
      id: `SO-${now.toISOString().slice(0, 10)}-001`,
      scope: "feeder",
      targetId: feederData[0].id,
      startTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 4.5 * 60 * 60 * 1000),
      reason: "Planned maintenance - jumper replacement",
    },
    {
      id: `SO-${now.toISOString().slice(0, 10)}-002`,
      scope: "dt",
      targetId: transformerData[0].id,
      startTime: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 7 * 60 * 60 * 1000),
      reason: "Load shedding",
    },
  ];
  await db.insert(scheduledOutages).values(scheduledOutageData);
  console.log(`  Created ${scheduledOutageData.length} scheduled outages`);

  console.log("\nSeed complete!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
