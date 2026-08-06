# Power Grid Fault Localization System

A system that turns pole-level telemetry ("this pole is dark / this pole is
live") into located, ticketed faults for a domestic LT distribution network —
built for the Karnataka State Power Distribution Board (fictional) take-home
assignment.

Given a stream of pole liveness signals, it finds the live/dark boundary,
groups symptoms into one incident per real fault, tells the control room the
span (or transformer, if the wiring order is unknown) and the PIN code, and
auto-verifies restoration from telemetry rather than trusting a button click.

## Quick start

```bash
git clone <YOUR_REPO_URL>
cd <YOUR_REPO_DIR>
docker compose up
```

That's it — one command. On first boot, the backend waits for Postgres, pushes
the schema, and seeds a synthetic network (~4 substations, ~30 feeders, ~50
transformers, ~3,000 poles) if the database is empty.

Open:

- **Operator console:** http://localhost:5173
- **Backend API / health check:** http://localhost:3001/api/health

## Public deployment

- **Live URL:** `<FILL IN — public URL, no login required>`
- **Demo video:** `<FILL IN — Loom/YouTube/Drive link, ~5 min>`

> If the live URL is on a free tier that cold-starts, the first request may
> take 10–30 seconds. Give it a moment before assuming it's down.

## Try it

1. Open the operator console.
2. Open the **Simulator** panel in the sidebar.
3. Inject a **Span Fault** on any transformer.
4. Within a few seconds, a new ticket appears on the map and in the incident
   list with a location, PIN code, affected-pole count, and a confidence
   reason.
5. Click the ticket, walk it through **acknowledged → crew assigned →
   resolved**. Try clicking "resolved" before repairing — the system will
   refuse.
6. Click **Repair** in the simulator for that incident. Watch the ticket
   auto-verify and close itself from telemetry, with no further clicks.

## Documentation map

| Doc | What's in it |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Data flow, storage model, the localization algorithm, noise handling, API surface, UI reasoning, AI feature |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Prerequisites, exact commands, env vars, troubleshooting |
| [`DECISIONS.md`](./DECISIONS.md) | Decision log, assumptions made where the brief was ambiguous, what's next |
| [`AI-WORKFLOW.md`](./AI-WORKFLOW.md) | How AI tooling was used to build this, what was checked/rewritten |

## Stack

- **Backend:** Node.js, Express, PostgreSQL, Drizzle ORM
- **Frontend:** React, Redux Toolkit, Axios, Leaflet
- **Infra:** Docker Compose (Postgres + backend + nginx-served frontend)

## Known gaps

See the "What's currently wrong or fragile" section of `DECISIONS.md` for the
full list. Headline item: no automated tests yet on the localization logic.