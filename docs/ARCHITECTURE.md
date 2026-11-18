# Proposed architecture

Updated November 17, 2026. This describes the target architecture and the implemented Phase 0 subset. Current verification status is in IMPLEMENTATION_STATUS.md. Imported architecture history is retained in reference/ARCHITECTURE.md.

## Implemented foundation

The repository now contains `frontend/src` (strict React/TypeScript), `backend/ilp` (FastAPI), `api/index.py` (candidate Vercel entrypoint), and `scripts/tasks.py`. The frontend's `/design` routes use synthetic fixtures only. The root/login route renders an unavailable sign-in control rather than simulating identity. Browser storage contains only a non-sensitive appearance preference. There are no application data tables, private endpoints, tokens, external fonts/assets, or telemetry.

The implemented request path is `/api/health` or `/api/ready` → health router → HealthService → HealthRepository. Liveness reads no data. Readiness delegates `SELECT 1` to DatabaseHealthRepository, returns a generic 503 on failure, and exposes no credentials. The readiness repository's database credential is server-only and scoped to this infrastructure probe, not a future application-data access path. Future people/meetup repositories must use verified user-scoped credentials as specified below. API responses use `no-store`; the local API runner disables access logging.

`contracts/openapi.json` and `frontend/src/api/schema.d.ts` are generated together and checked for drift. The frontend health client uses the generated response shape and validates the received response. Vite proxies `/api` to loopback Python during development. `vercel.json` proposes separate API and SPA rewrites plus security headers; hosted behavior remains unverified.

Alembic has an empty foundation revision and an isolated `ilp_migrations` version schema. It does not manage Supabase Auth tables. Supabase CLI 3.2.0 configuration disables public signup, anonymous access, analytics, and CLI application migrations/seeds, and enables local email capture. The disposable two-user Auth smoke and baseline migration have now run against Docker successfully. `scripts/tasks.py db-check` obtains local CLI credentials only in process memory, verifies the migration twice, checks real database-backed readiness and metadata isolation, exercises captured recovery links, and removes its temporary accounts/messages.

`scripts/local_services.py` detects standard Docker installation paths and suppresses credential-bearing CLI output. It requests a dedicated network with a loopback-binding option. Docker Desktop still reported all-interface published ports with that option set, so effective host binding remains a measured limitation. The stack is stopped after checks and contains no personal data. The CI definition now includes the same local-database integration sequence; hosted execution is still unverified.

Shared UI components, page-specific synthetic views, semantic CSS tokens, native dialogs, draft/discard behavior, responsive navigation, and a component reference are implemented. Authentication, ownership/RLS, persistent CRUD, reminder rules, and backup/push services remain future domains. Fixture dates and groups are not production business logic.

## Request flow

The browser loads a React/Vite/TypeScript application from Vercel. It signs in through Supabase Auth and holds its session in memory. Requests to the same-origin /api route include the access token. FastAPI verifies the token and checks current account/session validity before dispatching to owner-scoped services and repositories. Repositories use Supabase's Data API with the publishable key and the verified user's token so PostgreSQL RLS runs as that user.

Database writes and business operations pass through the API. RLS also protects direct Data API requests, since the publishable key is public. Tables need owner checks, WITH CHECK write policies, constrained fields, and owner-valid parent relationships regardless of which entry point receives a request. Use constrained SQL functions for atomic multi-row operations, with invoker permissions and RLS, called exclusively from repositories.

Alembic uses a separate migration credential in trusted environments. Runtime requests use user-scoped credentials. Administrative account provisioning and eventual push scheduling require narrowly scoped server operations. Keep their credentials out of browser code and ordinary request handling.

## Domains and contracts

The frontend will centralize semantic design tokens and accessible shared components following [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md). Layout and theme choices belong to presentation. Domain services own meetup and reminder rules. Phase 0 also establishes local Supabase services for real authentication/database integration tests, with hosted behavior verified separately.

- auth handles identity verification and account/session checks through Supabase Auth.
- people owns names, priority, cadence, archive state, and person lifecycle.
- meetups owns completed dates and optional notes, with owner-valid person references.
- reminders derives eligibility and owns snooze, pause, and eventual delivery records.
- privacy owns account-data export, restore, and deletion orchestration.

Each implemented domain has HTTP routers, business services, and data repositories. Infrastructure owns configuration and clients. Services return typed data, repositories return detached DTOs, and routers translate outcomes into HTTP responses. Generate the frontend contract from FastAPI's OpenAPI schema. Validate all input independently of the UI.

## Planned data model

| Entity | Essential fields and constraints |
| --- | --- |
| profiles | Auth user ID, timezone, timestamps; one owned profile per account |
| people | UUID, owner ID, name, nullable priority, cadence unit/count, archive state, revision |
| meetups | UUID, owner ID, person ID, completed calendar date, optional note, request ID, revision |
| reminder_preferences | Owner/person association, nullable snooze date, dismissed date, pause state |
| push_subscriptions | Future owner/device endpoint and encryption keys, enabled state |
| reminder_deliveries | Future unique owner/person/device/due-cycle key, lease, status, retry metadata |

Foreign keys enforce owner-consistent relationships. Index owner/person/date lookups. Bound text lengths and cadence counts. Use transactions for dependent changes, unique constraints for idempotency keys, and optimistic revisions for conflicting edits. Derive last seen and due dates from authoritative records instead of independently editable copies.

## Authentication and browser security

Supabase stores password hashes and handles credential verification/reset. Application models store the Auth user identifier. Initial account creation is administrative with public signup disabled. Establish a tested recovery channel for the owner's email. Apply a password policy and rate limits, generic login errors, allowlisted reset destinations, HTTPS, CSP, and no-store responses for private APIs.

FastAPI validates JWT signature, configured issuer/audience/algorithm, expiry, and current Auth account/session state. Fail closed if validation is unavailable. Verify provider logout semantics during implementation, including previously issued access tokens, and add a server revocation check if provider validation does not reject them. Initial memory-only sessions require a fresh login on reload. Clear application caches and subscriptions on identity changes. Persistent login is a future deliberate decision.

## Deployment and operations

Propose Vercel Hobby for the static website and Python API plus Supabase Free for Auth/PostgreSQL. Prove same-origin routing in Phase 0, using explicit rewrites if separate frontend/API projects are necessary. Use the provider address and TLS. Python functions are stateless with bounded request execution. Store durable data in PostgreSQL. Background loops and in-process timers cannot provide scheduled reminders across restarts.

GitHub Actions runs checks on Linux. Trusted deployment jobs run only after successful checks, serialize schema migrations, and promote a compatible release. Preview environments use isolated synthetic data and explicitly configured auth redirect URLs. Fork builds have no production secrets. Keep migrations backward compatible during rollout and document code rollback separately from database recovery.

In Phase 4, select a durable scheduler only after verifying free quotas and real Web Push library compatibility. An external trigger must authenticate to a bounded job endpoint. Delivery records, leases, revalidation, and retries survive invocation restarts. In-app due lists remain usable before external delivery exists.

Supabase Free can pause on inactivity. Plan for recovery and manual portable exports. Private records are available online after authentication. A later service worker caches only public assets. Browser offline editing and synchronization require a separate design.

Official platform references and cost caveats are recorded in PROJECT.md. Runtime authentication, RLS, CI, deployments, restore, and iPhone delivery are all pending implementation and verification.


Documentation organization uses docs/ for active specifications and reference/ for imported historical material. The repository-root AGENTS.md points to these specifications.

Interface planning is recorded in [INTERACTION_SPEC.md](INTERACTION_SPEC.md). Its conversation preview uses synthetic browser-memory state and simulated account/push/backup actions. It introduces no application runtime, provider connection, storage architecture, or change to the React/TypeScript and Python boundaries above.
