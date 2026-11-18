# Proposed architecture

Updated November 18, 2026. This describes the target architecture and Phase 0/1/2 source. Phases 1 and 2 are accepted on the protected Preview. Current verification status is in IMPLEMENTATION_STATUS.md. Imported architecture history is retained in reference/ARCHITECTURE.md.

## Implemented foundation

The repository contains strict React/TypeScript, FastAPI, generated OpenAPI contracts, Alembic and a Vercel entrypoint. `/design` uses synthetic fixtures. Root/login, forgotten-password, reset-password and private account-preference screens use managed Supabase Auth. Only appearance is persisted in browser storage; access tokens, account state and drafts stay in tab memory. Refresh tokens are discarded. There are no external fonts/assets or telemetry.

`/api/auth/config` exposes only the validated provider URL, public key and password guidance. `/api/profile` follows router → AuthService/ProfileService → repositories. JWT verification restricts algorithms, issuer, audience, expiry, subject and session ID using provider JWKS. Current provider identity and a server-only read of Auth session/account state must also succeed; outages fail closed. The app never modifies managed Auth tables or stores passwords.

Profile repositories use the caller's verified bearer token and public key through the Data API. Alembic revisions `0002_profiles` and `0003_profile_timezone` add one profile per Auth user, forced owner RLS and timezone validation for API and direct Data API writes. A private no-argument SECURITY DEFINER function with empty search path checks only the calling JWT's active session/account, closing the direct Data API post-logout window. Execution is granted only to authenticated users. Other application data queries never use the privileged SQL credential.

The typed REST adapter delegates credential verification/reset to managed Auth and strips recovery credentials from the URL before rendering or account requests. Expiry, account changes and logout unmount private state and abort reads. Global logout clears local credentials even if offline and reports server revocation as unconfirmed when it fails. Bounded requests, generic errors and no-store avoid exposing provider details. There is no private offline cache.

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

Official platform references and cost caveats are recorded in PROJECT.md. Runtime authentication and RLS pass local integration checks. Hosted Phase 1, restore and iPhone push delivery remain unverified.


Documentation organization uses docs/ for active specifications and reference/ for imported historical material. The repository-root AGENTS.md points to these specifications.

Interface planning is recorded in [INTERACTION_SPEC.md](INTERACTION_SPEC.md). Its conversation preview uses synthetic browser-memory state and simulated account/push/backup actions. It introduces no application runtime, provider connection, storage architecture, or change to the React/TypeScript and Python boundaries above.


## Verified foundation and current Phase 1 boundary — November 18, 2026

Docker publications are explicitly bound to 127.0.0.1 before container creation by a project-scoped adapter and checked on start/status. Synthetic startup/restart, database/Auth checks and host loopback/non-loopback probes pass. `scripts/hosted_smoke.py` verifies HTTPS headers, assets, SPA/API routing, no-store and database readiness; mock transports only test the checker.

The isolated Supabase Free project `i-love-people-preview` (`efuixughigoyyyflyelm`) is in Smooshy, Canada Central. The Session pooler SSL database URL is ignored locally and stored only as a sensitive Vercel Preview setting. Alembic baseline and readiness passed on protected Preview `https://i-love-people-9xnbgkdx9-smooshy.vercel.app` for CI-passed `34305ba`. Node 24 is configured. Production was not promoted. Deployment Protection remains enabled; authenticated Vercel fetch verified the request path without weakening protection.

Phase 1 source passes real local Auth/browser recovery and API/RLS ownership/revocation checks. Its hosted migrations and runtime settings are not yet applied, and hosted Auth setup is pending in AUTH_SETUP.md. The admin test key is excluded from the application runtime. Real-device Phase 0 Safari results are user-reported; VoiceOver is untested.

Phase 1 handoff, November 18: local review branch `codex/phase-1-login-privacy` is not published. The connected GitHub integration rejected tree publication with HTTP 403 (Resource not accessible by integration), so current-source hosted CI is pending. Supabase setup and owner-email recovery in AUTH_SETUP.md remain required. Local verification passed; hosted Phase 1 acceptance is not claimed.

Hosted Auth follow-up, November 18: Alembic through 0003_profile_timezone is applied on the isolated Preview. Current source via local ASGI plus actual hosted Auth/Data API passes identity/RLS/revocation tests. JWT verification allows five seconds of clock skew, with future/expired-token regressions. Vercel Preview-only public URL/key and production-mode validation settings are stored; the admin test key remains local. Phase 1 Vercel deployment and actual owner-email recovery remain unverified because GitHub publication is blocked.

GitHub follow-up, November 18: user reconnection restored connector writes; a tree-write probe passed. Publishing the review branch and verifying CI/Preview are in progress. No Phase 1 acceptance is inferred before those and owner-email recovery pass.

Protected Preview integration, November 18: commit c031afa passed GitHub CI run 44340365242, including both Linux jobs. Live smoke found an injected Vercel feedback script; Preview Feedback was disabled and the same source rebuilt. HTTP/deployed two-user API/RLS checks then passed, but browser login exposed that credentials=omit blocked the hosting protection cookie. Same-origin API/config/health requests now retain only same-origin cookies; cross-origin Supabase requests continue to omit cookies. Application authentication still requires the verified bearer token. A protected-cookie browser regression passes locally. The fix is being published and reverified; earlier Preview URLs are not the final recovery target. Owner-email recovery and device evidence remain pending.

Current protected runtime, November 18: https://i-love-people-o73m6xnlh-smooshy.vercel.app runs CI-passed e60a47f. Same-origin API/config/health fetches include same-origin hosting cookies so Vercel protection works; managed Supabase calls continue to omit cookies. The API still requires and verifies bearer identity independently. Preview Feedback is disabled to prevent external toolbar injection. Actual deployed API/RLS and browser checks pass, with synthetic cleanup. Owner-email recovery and new-screen real-device evidence remain pending.

Phase 1 accepted, November 18: managed hosted recovery now passes through the verified exact Preview redirect, password replacement, old-password and used-link rejection in a disposable Chrome journey. Real owner email delivery and iPhone account flows pass by user report. This closes Phase 1 runtime acceptance without changing the architecture, managed Auth ownership, memory-only tokens or Production. VoiceOver remains a release check.


## Phase 2 implementation — November 18, 2026

`/api/people`, `/api/people/{id}/meetups` and `/api/meetups/{id}` follow router → PeopleService → PeopleRepository. The repository uses only the verified caller token and public provider key. Reads page through records; last seen selects the latest surviving meetup. The account timezone is read through the existing profile repository before completed-date validation.

Alembic `0004_people_meetups` creates people, meetups and request receipts with forced owner/session RLS, owner-consistent composite foreign keys, indexes and UTC audit timestamps. A database trigger also rejects future dates in the saved account timezone and enforces immutable identities, parents and revision increments. The invoker `journal_write` RPC locks affected rows, compares revisions and cascades person deletion transactionally. An account/request advisory lock serializes duplicate meetup creation; changed payloads return conflict. Receipts hold a payload fingerprint and response; editing/deleting a meetup scrubs its original response and later retries conflict. Deleting a person cascades receipts too.

The private account screen mounts the people list, profile, editors and confirmations. All personal state remains in memory and is discarded on session change. Meetup retries retain their exact request key/payload after ambiguous failures. No reminders or Phase 3 calculations are implemented. Hosted Phase 2 rollout is pending; Phase 1 remains the accepted deployed version.


Phase 2 cleanup verification: receipt scrubbing runs only for the calling owner. Managed Auth account deletion cascades all owned rows and receipts without running owner-only receipt updates as the provider Auth role. The live browser fixture cleanup verifies this path with an account containing people and meetup history. Private account grid tracks also allow shrinking and long-text wrapping at 200% text size.


Phase 2 hosted conflict adapter: Alembic 0005 changes only deliberately raised revision/request conflicts to PostgREST PT409. This preserves invoker permissions, ownership, row locks and request receipts while avoiding hosted retries of serialization errors. Real database serialization failures retain their original meaning.


Current Phase 2 runtime: CI-passed d377735 on protected Preview https://i-love-people-c2mef0l08-smooshy.vercel.app, Alembic 0005. Deployed browser/API/Data API checks verify the documented path, including explicit conflicts and account cleanup. Exact Auth URL configuration and new iPhone evidence remain pending; see IMPLEMENTATION_STATUS.md and AUTH_SETUP.md.


Phase 2 acceptance confirmation, November 18: the new exact Auth redirect now passes independent hosted browser recovery and the user reports the people/history iPhone and desktop journeys pass. The accepted architecture remains caller-scoped repositories, forced owner/session RLS, Alembic migrations, exact dates and explicit PT409 conflicts. No architectural or runtime code change accompanies closure; see IMPLEMENTATION_STATUS.md for evidence.
