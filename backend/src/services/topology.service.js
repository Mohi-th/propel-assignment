/**
 * Topology Service
 *
 * Builds tree structures from pole data for DTs that have known topology.
 * For DTs without topology, groups poles by DT.
 *
 * The power network is a tree (no loops). Each pole has exactly one parent.
 * The DT (transformer) is the root.
 */

import { db } from "../db/index.js";
import { poles, transformers } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * Build a tree for a DT that has known topology.
 *
 * Returns an object like:
 * {
 *   root: "D-0001",
 *   nodes: {
 *     "P-000001": { id, parentId, children: ["P-000002"], isEnergized, ... },
 *     ...
 *   }
 * }
 */
export async function buildTreeForDt(dtId) {
  const dtPoles = await db
    .select()
    .from(poles)
    .where(eq(poles.dtId, dtId));

  if (dtPoles.length === 0) return null;

  // Build adjacency: each pole knows its children
  const nodes = {};

  for (const pole of dtPoles) {
    nodes[pole.id] = {
      id: pole.id,
      parentId: pole.parentPoleId,
      children: [],
      isEnergized: pole.isEnergized,
      lat: pole.lat,
      lon: pole.lon,
      deviceId: pole.deviceId,
      pincode: pole.pincode,
      seqOnLine: pole.seqOnLine,
    };
  }

  // Find root poles (those with no parent or parent not in this DT)
  const rootPoles = [];

  for (const pole of dtPoles) {
    if (pole.parentPoleId && nodes[pole.parentPoleId]) {
      nodes[pole.parentPoleId].children.push(pole.id);
    } else {
      rootPoles.push(pole.id);
    }
  }

  return { dtId, rootPoles, nodes };
}

/**
 * Get all poles grouped by DT for DTs without topology.
 * Used for DT-level localization.
 */
export async function getPolesForDt(dtId) {
  const dtPoles = await db
    .select()
    .from(poles)
    .where(eq(poles.dtId, dtId));

  return dtPoles;
}

/**
 * Find fault boundaries in a tree.
 *
 * A fault boundary is the edge between:
 *   - The last live pole (upstream)
 *   - The first dark pole (downstream)
 *
 * Walk from each root downward. When we find a live node with a dark child,
 * that edge is a fault boundary.
 *
 * Special cases:
 *   - Dark pole with ALL children live → dead sensor, not a fault
 *   - All poles dark, no live root → DT-level or feeder-level fault
 *
 * Returns array of boundaries:
 * [{ livePoleid, darkPoleId, affectedPoles: number }]
 */
export function findFaultBoundaries(tree) {
  if (!tree) return [];

  const boundaries = [];
  const { rootPoles, nodes } = tree;

  // Check if ALL poles are dark (possible DT/feeder fault)
  const allPoles = Object.values(nodes);
  const allDark = allPoles.every((p) => !p.isEnergized);
  if (allDark) {
    return [{ type: "all_dark", affectedPoles: allPoles.length }];
  }

  // Walk the tree from each root
  for (const rootId of rootPoles) {
    walkTree(rootId, nodes, boundaries);
  }

  return boundaries;
}

/**
 * Recursive tree walk to find live/dark boundaries.
 */
function walkTree(nodeId, nodes, boundaries) {
  const node = nodes[nodeId];
  if (!node) return;

  // Dead sensor check: this pole is dark but ALL its children are live
  // This is physically impossible as a line fault — the sensor is lying
  if (!node.isEnergized && node.children.length > 0) {
    const allChildrenLive = node.children.every(
      (childId) => nodes[childId] && nodes[childId].isEnergized
    );
    if (allChildrenLive) {
      // Dead sensor — skip, not a fault
      return;
    }
  }

  // If this pole is live, check each child
  if (node.isEnergized) {
    for (const childId of node.children) {
      const child = nodes[childId];
      if (!child) continue;

      if (!child.isEnergized) {
        // Found a boundary! Live parent → dark child
        const affected = countDarkDescendants(childId, nodes);
        boundaries.push({
          type: "span",
          livePoleId: nodeId,
          darkPoleId: childId,
          affectedPoles: affected,
        });
        // Don't walk further — everything below is already dark from this fault
      } else {
        // Child is live, keep walking
        walkTree(childId, nodes, boundaries);
      }
    }
  }
  // If this pole is dark and we got here, it means its parent was also dark
  // (part of a known fault downstream), so nothing to do
}

/**
 * Count how many poles are dark from this node downward (inclusive).
 */
function countDarkDescendants(nodeId, nodes) {
  const node = nodes[nodeId];
  if (!node) return 0;

  let count = node.isEnergized ? 0 : 1;

  for (const childId of node.children) {
    count += countDarkDescendants(childId, nodes);
  }

  return count;
}
