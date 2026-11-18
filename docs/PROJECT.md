# I Love People project plan

Updated November 17, 2026. This document defines the implementation roadmap. Phase 0 is in progress, with local frontend/backend source and development checks. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for evidence and outstanding gates.

## Goal and scope

Build a responsive private website for remembering when you last saw people and deciding who to see next. It should work comfortably in iPhone Safari and on desktop, with a login page, secure account management, meetup history, optional priority levels, and gentle reminders. Target $0 monthly hosting for one personal user using provider subdomains and free quotas.

The product ideas and priority scale live in [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md). The web-specific decisions here supersede that document's original iPhone deployment assumptions. Preserve the original feature backlog as future ideas. Imported resume-project documents are preserved in [reference](reference). Their implementation and testing history belongs to their source project.

The proposed interface is outlined in [INTERACTION_SPEC.md](INTERACTION_SPEC.md), with a synthetic interactive mockup in the design conversation. It covers Phase 0–5 screens, recovery states, visual details, and Phase 6 boundaries. This planning deliverable does not start or complete an implementation phase.

## Proposed stack and budget

| Component | Proposal | Expected monthly cost for one user |
| --- | --- | --- |
| Website | React, Vite, strict TypeScript on Vercel Hobby | $0 within quotas |
| API | Python 3.12+, FastAPI on Vercel Functions | $0 within Hobby quotas |
| Database | Supabase Free PostgreSQL | $0 within quotas |
| Accounts | Supabase Auth, email and password | $0 within quotas |
| CI/CD | GitHub Actions Linux jobs and Vercel deployment CLI | $0 within included usage |
| Address and HTTPS | Provider subdomain and managed TLS | $0 |
| Push delivery | Web Push, with scheduling evaluated in Phase 4 | $0 target, subject to verified runtime limits |

These are planning estimates checked November 17, 2026. Vercel Hobby requires personal, non-commercial use. Supabase Free includes a 500 MB database and can pause after a week of inactivity. Free service limits and availability can change. Plan for manual unpause and maintain a portable export. A custom domain is optional and adds a renewal cost. Provider account setup and any deployment are future work.

Sources are [Vercel Hobby](https://vercel.com/docs/plans/hobby), [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi), [Supabase pricing](https://supabase.com/pricing), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), and [GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included).

## Phase 0 — Foundation and deployability

Current progress: the mockup has become a React/TypeScript synthetic component reference with the specified tokens and shared controls. A Python health/readiness API, generated contracts, locked dependencies, task runner, CI checks definition, Alembic baseline, local Supabase configuration, and candidate Vercel routing are present. Docker is installed and local database/Auth smoke, migration repeatability, database-backed API readiness, captured recovery links, and cleanup passed. Effective local port binding, hosted CI, trusted deployment setup, and preview smoke remain pending. Phase 0 is not complete, and no personal records are exposed.

- Establish design tokens, foundational styles, and a synthetic component reference following [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md). Include light/dark appearance, typography, spacing, states, and responsive review from the beginning. Apply its code and documentation standards throughout every phase.
- Configure local Supabase through its CLI and a Docker-compatible runtime, with synthetic accounts, locally captured recovery emails, and isolated PostgreSQL/Auth/Data API services. Test core flows locally before connecting a hosted project. Track hosted acceptance separately.
- Create frontend/backend folders, locked dependencies, environment examples, formatting, strict types, and a minimal health endpoint. Use Node 24 and pnpm 11.19.0 as the starting toolchain from the imported guidance.
- Establish router → service → repository boundaries, generated OpenAPI types, Alembic migrations, and an automated check command.
- Scaffold responsive navigation and logged-out/loading/error states using bundled assets. Configure secret exclusion and synthetic test data.
- Create GitHub Actions checks for lint, types, contract drift, tests, and production build. Set up deployment after successful checks, with deploy credentials limited to trusted branches. Fork pull requests receive no deployment secrets.
- Verify static assets, SPA deep-link routing, same-origin `/api` routing, HTTPS, Python dependencies, and database connectivity on an actual preview deployment.

Acceptance requires a reproducible local setup, passing checks, and a recorded hosted smoke result. A local build alone leaves the hosted gate pending. Phase 0 deploys no personal records.

## Phase 1 — Login and private data boundary

- Configure Supabase Auth. Provision the first owner account through administrative setup and disable public signups for initial personal use.
- Build login, logout, forgotten-password, reset-password, expired-session, and recovery error flows. Use Supabase's password storage and reset mechanisms. Configure a strong password policy and provider rate limits.
- Keep browser auth tokens in memory for the initial release. Reloading requires sign-in again. Clear all account query caches on logout or account change. Revisit persistence explicitly if repeated login becomes inconvenient.
- Verify access tokens in FastAPI using the configured signing keys, allowed algorithms, issuer, audience, and expiry. Derive the owner from the verified subject. Validate the current account/session with Auth for protected operations so logout/account disable is reflected. Fail closed on failed validation.
- Establish RLS for every application table and test both direct Data API access and API ownership checks with two synthetic users. Derive ownership on the server and reject foreign parent IDs.
- Document and test recovery delivery for the owner's address. Supabase default email delivery is restricted and rate limited. Verify recipient eligibility and real reset links before acceptance. Broader use requires a tested custom SMTP configuration and a separate cost review.

Acceptance requires successful hosted login/logout/reset, inaccessible protected APIs while logged out, expiry behavior, blocked signup, and failed cross-user reads/writes. The browser bundle and logs must contain no passwords, privileged keys, or auth tokens. Credentials are managed by Supabase Auth, which stores password hashes. Application tables contain no password fields.

Sources are [password security](https://supabase.com/docs/guides/auth/password-security), [email delivery limits](https://supabase.com/docs/guides/auth/auth-smtp), and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Phase 2 — People and meetup history

- Add/edit/archive/delete a person, search the list, and log/edit/delete a meetup with an optional note. Include confirmation and useful error states for destructive actions.
- Add the optional Closest, Close, Comme ci, comme ça, and Distant levels. Offer the existing cadence suggestions for confirmation. Allow clearing priority and changing cadence independently.
- Use calendar dates for meetups, UTC timestamps for audit fields, and a saved IANA timezone for the account. Reject future completed-meetup dates. Date precision is exact in this release.
- Preserve unknown last-seen dates. Compute last seen from the latest surviving meetup. Archive retains history. Explicit person deletion removes the owned dependent entries transactionally.
- Add request IDs/idempotency for meetup creation and revision checks for edits so retries avoid duplicate logs and stale tabs receive a conflict response.

Acceptance requires persistence across sessions/devices, backdated entries, editing/deleting the latest entry, duplicate-submit handling, conflicting edits, empty states, and owner-isolation regression checks.

## Phase 3 — Due list and in-app nudges

- Calculate due dates from the latest completed meetup and the explicit cadence. Define cadence units as days, weeks, or calendar months, clamping month ends to the last valid date. Include leap-year coverage.
- Show due now, due soon within seven days, later, and unknown-date states. Within timing groups sort by priority, unranked last, then due date and name, with ID as a stable final tie-breaker.
- Add snooze, dismiss-for-today, pause/unpause, and cadence editing. Snooze changes the next eligible nudge date. Dismiss-for-today hides the nudge until the next local date. Due dates remain visible on profiles. A new latest meetup clears snooze/dismiss state and calculates the next due date.
- Archive and pause suppress nudges. Removing all meetups clears recurring eligibility. Recalculate from current records on every read so server restarts preserve behavior.
- Add a small weekly review screen with last-seen dates and the reason each person is due.

Acceptance requires deterministic date/timezone tests and a real browser journey from adding Maya through seeing her due, snoozing, and recording a new meetup. In-app nudges are available whenever the website is opened. Closed-browser delivery becomes Phase 4 work.

## Phase 4 — Home Screen installation and external nudges

- Add a web manifest, install guidance, and a service worker caching only public app assets. Keep auth, API responses, personal records, and push subscriptions out of offline caches. Show a useful offline state and retain unsaved form text only in memory.
- Add explicit notification opt-in, permission-denied guidance, per-device push subscriptions, unsubscribe, and generic notification wording that keeps names and rankings private.
- Prototype a daily scheduled Web Push sender with durable database delivery records. Evaluate a free scheduled worker invoking a bounded protected API job. Keep delivery logic in services and transport adapters. Verify actual scheduler, Python invocation, cryptographic libraries, execution limits, and free quotas before adopting the route in DECISIONS.md.
- Handle timezone/quiet hours, revoked endpoints, retries, concurrent invocations, and suppression after archive, pause, logout opt-out, or deletion. Recheck eligibility immediately before sending. Record delivery attempts without sensitive content.
- Use unique delivery keys and leases to prevent concurrent duplicate sends. Document the possibility of repeated delivery after an ambiguous network failure and make clicks/logging idempotent.

Acceptance requires a real iPhone Home Screen web app receiving a nudge while closed, permission revocation, a desktop browser test, and a hosted scheduled run. iOS web push requires Home Screen installation on supported versions, beginning with iOS 16.4. Delivery remains subject to device permissions and connectivity. If the free runtime proof fails, mark this phase pending with its measured limitation and retain the usable in-app reminder release.

Sources are [WebKit web push](https://webkit.org/blog/13878/), [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## Phase 5 — Personal release, recovery, and operating checks

- Add full owned-data export, validated restore with preview/conflict handling, and delete-all with reauthentication. Exclude passwords, session credentials, privileged keys, and push endpoints from exports.
- Test restore into a fresh synthetic account. Document manual backups, inactive-project recovery, usage review, migration deployment, rollback, and database recovery. A code rollback does not roll back a migration.
- Finish responsive layout, keyboard flows, visible focus, screen-reader labels, large text/reflow, empty/error states, CSP/security headers, request bounds, dependency audits, and redacted errors/logs.
- Deploy migrations in a serialized trusted job before compatible application promotion. Maintain backward compatibility during rollout and check health plus login/CRUD on the real hosted release.

Acceptance requires an actual export/restore drill, passing ownership/security regression checks, hosted login and meetup smoke, and a recorded monthly cost review within free quotas. Track local checks, hosted CI, and hosted smoke separately.

## Phase 6 — Selected improvements

After the private release, choose features from the original backlog based on actual use. Candidates include groups, multi-person meetups, planned meetups, CSV import, birthdays, and calendar export. Each needs its own bounded acceptance checklist. Native iPhone widgets, Apple Watch, and App Store distribution require a later platform decision. Public registration or commercial use requires revisiting email, abuse controls, account lifecycle, and hosting terms.

## Session maintenance

Before ending work, update ../AGENTS.md, ARCHITECTURE.md, IMPLEMENTATION_STATUS.md, DECISIONS.md, SKILLS.md, and PROJECT.md with meaningful changes or a concise status confirmation. Preserve the original product backlog and imported references. Report only checks actually run and features actually implemented. Proceed through phases in order when implementation is requested.


Active project documentation now lives together in docs/. The documentation index is README.md in this folder; repository instructions remain at ../AGENTS.md.
