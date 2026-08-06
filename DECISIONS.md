# Decisions

## 1. Prioritized Core Functionality

**Chosen:** Simple CRUD architecture with robust core telemetry ingestion, localization, simulator, and dashboard.

**Rejected:** Complex event-driven architectures or incomplete AI features.

**Why:** The goal was to build a working, simple, maintainable system that can be easily explained, adhering to the principles of a robust production system without over-engineering.

---

## 2. PostgreSQL + Drizzle

**Chosen:** PostgreSQL with Drizzle ORM.

**Rejected:** Graph databases like Neo4j.

**Why:** The network is a tree structure, so relational tables with `parent_pole_id` were sufficient and simpler.

---

## 3. Transformer-Level Fallback

**Chosen:** When topology is unavailable, localize faults only to the transformer level with medium confidence.

**Rejected:** Guessing pole order from GPS or historical data.

**Why:** Returning a less precise but correct result is better than a potentially incorrect exact location.

---

## 4. Debounced Localization

**Chosen:** Run localization after a 2-second debounce.

**Rejected:** Running localization for every telemetry event.

**Why:** Prevents unnecessary processing during telemetry bursts.

---

## 5. Cached Pole Status

**Chosen:** Store the latest pole status (`is_energized`) in the `poles` table.

**Rejected:** Reading the latest telemetry event every time.

**Why:** Improves localization performance.

---

## 6. Polling Instead of WebSockets

**Chosen:** Poll the backend every 5 seconds.

**Rejected:** WebSockets.

**Why:** Easier deployment while still meeting the assignment requirements.

---

# Assumptions

- One fault creates one incident.
- Unknown topology requires at least two dark poles before creating a ticket.
- Missing PIN codes use the nearest available pincode.
- Entire transformer dark is treated as a transformer fault.

---

# Current Limitations
- No automated tests for localization yet.
- RSSI and battery values are stored but not used.
- Out-of-order telemetry handling can be improved.
- Device-less poles reduce localization accuracy.

---

# With More Time

- Add localization unit tests.
- Improve handling of out-of-order telemetry.
- Improve localization around poles without devices.
- Add more simulator scenarios.

---

# Libraries Used

- React
- Express.js
- PostgreSQL
- Drizzle ORM
- Redux Toolkit
- Axios
- Leaflet
- Docker