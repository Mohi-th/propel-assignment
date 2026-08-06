import {
  pgTable,
  text,
  real,
  integer,
  boolean,
  timestamp,
  serial,
} from "drizzle-orm/pg-core";

// --- Network hierarchy tables ---

export const substations = pgTable("substations", {
  id: text("id").primaryKey(),
  name: text("name"),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
});

export const feeders = pgTable("feeders", {
  id: text("id").primaryKey(),
  substationId: text("substation_id")
    .notNull()
    .references(() => substations.id),
  name: text("name"),
});

export const transformers = pgTable("transformers", {
  id: text("id").primaryKey(),
  feederId: text("feeder_id")
    .notNull()
    .references(() => feeders.id),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  capacityKva: integer("capacity_kva"),
  householdsServed: integer("households_served"),
  hasTopology: boolean("has_topology").notNull().default(false),
});

export const poles = pgTable("poles", {
  id: text("id").primaryKey(),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  feederId: text("feeder_id")
    .notNull()
    .references(() => feeders.id),
  dtId: text("dt_id")
    .notNull()
    .references(() => transformers.id),
  seqOnLine: integer("seq_on_line"),
  parentPoleId: text("parent_pole_id"),
  poleType: text("pole_type"),
  ward: text("ward"),
  pincode: text("pincode"),
  deviceId: text("device_id"),
  isEnergized: boolean("is_energized").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at"),
  fwVersion: text("fw_version"),
});

// --- Telemetry ---

export const telemetryEvents = pgTable("telemetry_events", {
  id: serial("id").primaryKey(),
  deviceId: text("device_id").notNull(),
  poleId: text("pole_id").references(() => poles.id),
  event: text("event").notNull(),
  energized: boolean("energized").notNull(),
  ts: timestamp("ts").notNull(),
  seq: integer("seq").notNull(),
  batteryMv: integer("battery_mv"),
  rssi: integer("rssi"),
  fw: text("fw"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
});

// --- Incidents / Tickets ---

export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  faultType: text("fault_type").notNull(), // span, dt, feeder
  status: text("status").notNull().default("detected"),
  localizationType: text("localization_type").notNull(), // span or dt
  faultSpanFrom: text("fault_span_from"), // last live pole
  faultSpanTo: text("fault_span_to"), // first dark pole
  dtId: text("dt_id").references(() => transformers.id),
  feederId: text("feeder_id").references(() => feeders.id),
  lat: real("lat").notNull(),
  lon: real("lon").notNull(),
  pincode: text("pincode"),
  affectedPoles: integer("affected_poles").notNull().default(0),
  confidence: text("confidence").notNull(), // high, medium, low
  confidenceReason: text("confidence_reason"),
  detectedAt: timestamp("detected_at").notNull().defaultNow(),
  acknowledgedAt: timestamp("acknowledged_at"),
  crewAssignedAt: timestamp("crew_assigned_at"),
  resolvedAt: timestamp("resolved_at"),
  verifiedAt: timestamp("verified_at"),
  closedAt: timestamp("closed_at"),
});

// --- Incident affected poles (which poles belong to which incident) ---

export const incidentPoles = pgTable("incident_poles", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id")
    .notNull()
    .references(() => incidents.id),
  poleId: text("pole_id")
    .notNull()
    .references(() => poles.id),
});

// --- Scheduled Outages ---

export const scheduledOutages = pgTable("scheduled_outages", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(), // feeder or dt
  targetId: text("target_id").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  reason: text("reason"),
});
