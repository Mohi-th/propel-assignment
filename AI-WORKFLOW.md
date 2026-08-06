# AI Workflow

## Tools Used
- **Antigravity IDE Agent**: Used for architecture design, boilerplate generation, and algorithm implementation.

## Wholesale vs. Custom
- **Wholesale Delegation**: React UI scaffolding, basic CRUD endpoints, Drizzle ORM schema creation, and Docker Compose configuration were generated wholesale. The AI is highly reliable for standard web patterns.
- **Custom / Heavily Steered**: The fault localization logic, simulator state management, and polling mechanisms were heavily steered. The AI tends to suggest complex event-driven architectures (like Kafka or WebSockets) for real-time telemetry. I explicitly constrained the AI to build a simple, explainable system using Express, PostgreSQL, and React polling, as this is easier to maintain and explain in an interview context.

## Cases where AI needed correction
1. **Integer Overflow**: The AI initially used `Date.now()` to generate sequence numbers for telemetry events, which overflowed the PostgreSQL `integer` column capacity (~2.1 billion max). I had to correct it to use a simple module-level incrementing counter to fit the integer constraints.
2. **Missing Imports**: The AI attempted to dynamically import a default export from a service file that only used named exports, resulting in a runtime `TypeError`. I corrected the import destructuring to match the actual file exports.
3. **Over-engineering**: The AI originally designed a complex architecture. I had to enforce strict rules (via an `AGENTS.md` file) to limit the stack to plain React, Redux, Node.js, and Postgres, preventing the introduction of unnecessary message queues and microservices.

## AI-Generated Code Estimation
Roughly 80% of the raw lines of code (boilerplate, CSS, simple API routes) were AI-generated. The core business logic (localization algorithm, simulator edge cases) was co-authored, with about 50% AI generation and 50% manual steering/refining to keep it simple and robust.
