import { asyncHandler } from "../middleware/errorHandler.js";
import { db } from "../db/index.js";
import { poles, transformers, feeders, substations } from "../db/schema.js";
import { eq } from "drizzle-orm";

/**
 * GET /api/poles
 * Get all poles. Optionally filter by dtId or feederId.
 */
export const getAll = asyncHandler(async (req, res) => {
  const { dtId, feederId } = req.query;

  let results;

  if (dtId) {
    results = await db.select().from(poles).where(eq(poles.dtId, dtId));
  } else if (feederId) {
    results = await db.select().from(poles).where(eq(poles.feederId, feederId));
  } else {
    results = await db.select().from(poles);
  }

  res.json(results);
});

/**
 * GET /api/poles/:id
 * Get a single pole.
 */
export const getById = asyncHandler(async (req, res) => {
  const [pole] = await db
    .select()
    .from(poles)
    .where(eq(poles.id, req.params.id));

  if (!pole) {
    return res.status(404).json({ error: "Pole not found" });
  }

  res.json(pole);
});

/**
 * GET /api/transformers
 * Get all transformers.
 */
export const getTransformers = asyncHandler(async (req, res) => {
  const results = await db.select().from(transformers);
  res.json(results);
});

/**
 * GET /api/feeders
 * Get all feeders.
 */
export const getFeeders = asyncHandler(async (req, res) => {
  const results = await db.select().from(feeders);
  res.json(results);
});

/**
 * GET /api/substations
 * Get all substations.
 */
export const getSubstations = asyncHandler(async (req, res) => {
  const results = await db.select().from(substations);
  res.json(results);
});
