# I Love People project plan

Updated November 19, 2026. This document defines the implementation roadmap. Phase 0 is accepted. Phases 1, 2 and 3 are accepted on the protected Preview. Phase 3 acceptance is recorded November 19, 2026 for application 97e40ea after UI approval and final-origin recovery verification. VoiceOver remains unverified before release. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for evidence and outstanding gates.

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

These are planning estimates checked November 17, 2026. Vercel Hobby requires personal, non-commercial use. Supabase Free includes a 500 MB database and can pause after a week of inactivity. Free service limits and availability can change. Plan for manual unpause and maintain a portable export. A custom domain is optional and adds a renewal cost. An isolated synthetic Supabase Free project and protected Vercel Preview are configured; Production was not promoted.

Sources are [Vercel Hobby](https://vercel.com/docs/plans/hobby), [FastAPI deployment](https://vercel.com/docs/frameworks/backend/fastapi), [Supabase pricing](https://supabase.com/pricing), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), and [GitHub included usage](https://docs.github.com/en/billing/reference/product-usage-included).

## Phase 0 — Foundation and deployability

Current progress: foundation source, local setup/checks, GitHub CI for `34305ba`, hosted HTTP/database smoke and Docker loopback isolation pass. The user reports the non-VoiceOver Safari checklist passed on iPhone 16 Pro / iOS 27.2. Written Phase 0 acceptance is met; VoiceOver remains an unverified pre-release check. The existing hosted deployment is synthetic.

- Establish design tokens, foundational styles, and a synthetic component reference following [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md). Include light/dark appearance, typography, spacing, states, and responsive review from the beginning. Apply its code and documentation standards throughout every phase.
- Configure local Supabase through its CLI and a Docker-compatible runtime, with synthetic accounts, locally captured recovery emails, and isolated PostgreSQL/Auth/Data API services. Test core flows locally before connecting a hosted project. Track hosted acceptance separately.
- Create frontend/backend folders, locked dependencies, environment examples, formatting, strict types, and a minimal health endpoint. Use Node 24 and pnpm 11.19.0 as the starting toolchain from the imported guidance.
- Establish router → service → repository boundaries, generated OpenAPI types, Alembic migrations, and an automated check command.
- Scaffold responsive navigation and logged-out/loading/error states using bundled assets. Configure secret exclusion and synthetic test data.
- Create GitHub Actions checks for lint, types, contract drift, tests, and production build. Set up deployment after successful checks, with deploy credentials limited to trusted branches. Fork pull requests receive no deployment secrets.
- Verify static assets, SPA deep-link routing, same-origin `/api` routing, HTTPS, Python dependencies, and database connectivity on an actual preview deployment.

Acceptance requires a reproducible local setup, passing checks, and a recorded hosted smoke result. A local build alone leaves the hosted gate pending. Phase 0 deploys no personal records.

## Phase 1 — Login and private data boundary

Current progress: accepted November 18, 2026 for CI-passed `e60a47f` on the protected Preview. Local source/database/Auth/browser, deployed API/RLS/revocation and browser expiry checks pass. The user reports successful owner email recovery and iPhone account-screen journeys with no keyboard/screen problems. A disposable hosted browser recovery independently verified the final redirect, password update, old-password rejection and used-link rejection. Rate limits are recorded in [AUTH_SETUP.md](AUTH_SETUP.md). VoiceOver remains untested before private release. Phase 2 is also accepted on the protected Preview.

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

## Hosted-gate sequencing confirmation — November 17, 2026

After requesting Phase 1, the user explicitly chose to finish Phase 0 hosted gates first. Phase 1 remains planned. The repository now includes a read-only `hosted-smoke` task and manual checks workflow dispatch; hosted CI is now verified for commit `34305ba`, while an isolated synthetic preview still requires Vercel/Supabase access. These tools do not satisfy acceptance until run against the hosted environment with recorded results.

## Hosted provisioning progress — November 17, 2026

The $0/month synthetic Supabase preview `i-love-people-preview` is created in Smooshy / Canada Central and healthy. A control-plane SQL probe passed; no application schema migration, hosted Auth verification, Vercel preview, or cross-provider connectivity check has run. Vercel is connected on Hobby, but Smooshy project access still returns 403 after reported team consent; a fresh consent flow is pending. Phase 0 remains in progress and Phase 1 remains planned.

## Preview smoke progress — November 17, 2026

Vercel team access is resolved. A synthetic Preview from CI-passed commit `34305ba` is READY using Node 24. HTTPS, assets, SPA deep links, headers, Python health, and API 404/no-store behavior pass. Database readiness still returns 503 with no connection setting. Awaiting secure database credential provisioning, Alembic application, and a repeated hosted readiness/smoke check. Local network isolation and device evidence remain pending; Phase 0 is not accepted and Phase 1 is unstarted.

Hosted connection follow-up, November 18, 2026. The supplied direct preview URL passed format/project/SSL validation but its hostname failed local DNS resolution (11001). Alembic did not reach the database and no Vercel secret was configured. Requested the full Session pooler URI in ignored `.env.preview`; credentials were not printed. Existing architecture and phase sequencing are unchanged; hosted readiness remains pending.

## Hosted foundation gates verified — November 18, 2026

GitHub Linux CI and [the synthetic Node 24 Preview](https://i-love-people-9xnbgkdx9-smooshy.vercel.app) pass for commit `34305ba`. Alembic baseline repeatability, migration metadata isolation, asset delivery, SPA deep links, same-origin Python health/readiness, HTTPS/security headers, and API 404/no-store behavior are verified. The runtime URL is a sensitive Preview-only variable. No production release occurred. Phase 0 remains in progress for measured local port isolation and the outstanding device/accessibility review; Phase 1 remains unstarted. The locally added hosted-smoke/manual-dispatch tooling is not yet pushed or covered by that hosted commit.

## Local isolation and device handoff — November 18, 2026

Explicit project-scoped Docker port binding is implemented and verified across two startup cycles, with database/Auth regressions passing. Windows listeners are loopback-only and same-host non-loopback probes are rejected. See IMPLEMENTATION_STATUS.md for exact evidence. The new launcher/tests/tooling remain local and are not covered by the earlier hosted CI commit. Phase 0 remains in progress for device/accessibility review; Phase 1 remains unstarted. Follow DEVICE_REVIEW.md on a real iPhone before recording that evidence.

Device evidence and sequencing, November 18, 2026. November 18, 2026: user-reported pass on iPhone 16 Pro, iOS 27.2, for all non-VoiceOver steps in DEVICE_REVIEW.md. VoiceOver was explicitly not tested. This is user-reported device evidence, not an agent-observed session. The written Phase 0 acceptance (reproducible local foundation, passing checks, recorded hosted smoke) is satisfied; device Safari review is additionally reported passed. VoiceOver is carried as an unverified pre-release accessibility check under DESIGN_STANDARDS.md, not silently marked passed. Earlier statements treating VoiceOver as a prerequisite for Phase 1 were too strict. Phase 1 implementation now begins under the original user request.

Phase 1 handoff, November 18: local review branch `codex/phase-1-login-privacy` is not published. The connected GitHub integration rejected tree publication with HTTP 403 (Resource not accessible by integration), so current-source hosted CI is pending. Supabase setup and owner-email recovery in AUTH_SETUP.md remain required. Local verification passed; hosted Phase 1 acceptance is not claimed.

Phase 1 hosted-service progress, November 18: signup/anonymous denial, password rules, Alembic through 0003_profile_timezone and two-user hosted Auth/Data API isolation/revocation with local ASGI pass. Public Auth settings are stored only for Preview. GitHub write authentication still blocks current-source CI/deployment. Deployed browser/API checks, owner-email recovery, actual provider-limit values and account-screen device review remain pending. Phase 1 acceptance is unchanged.

GitHub follow-up, November 18: user reconnection restored connector writes; a tree-write probe passed. Publishing the review branch and verifying CI/Preview are in progress. No Phase 1 acceptance is inferred before those and owner-email recovery pass.

Protected Preview integration, November 18: commit c031afa passed GitHub CI run 44340365242, including both Linux jobs. Live smoke found an injected Vercel feedback script; Preview Feedback was disabled and the same source rebuilt. HTTP/deployed two-user API/RLS checks then passed, but browser login exposed that credentials=omit blocked the hosting protection cookie. Same-origin API/config/health requests now retain only same-origin cookies; cross-origin Supabase requests continue to omit cookies. Application authentication still requires the verified bearer token. A protected-cookie browser regression passes locally. The fix is being published and reverified; earlier Preview URLs are not the final recovery target. Owner-email recovery and device evidence remain pending.

Verified Phase 1 application candidate, November 18: e60a47f passes both Linux CI jobs and protected Preview https://i-love-people-o73m6xnlh-smooshy.vercel.app, including deployed two-user API/RLS/revocation and browser login/preferences/reload/logout/expiry. Draft PR #1 remains open. Acceptance still requires final redirect configuration, actual owner-email reset/reuse/old-password checks, recorded rate limits and account-screen device review. VoiceOver remains an open pre-release check. No later phase begins yet.


## Phase 2 implementation progress — November 18, 2026

Phase 2 source is implemented locally: people lifecycle/search, optional priority with confirmed suggestions and independent cadence, dated meetup history/notes, future-date rejection, derived last seen, transactional delete, retry receipts and revision conflicts. See IMPLEMENTATION_STATUS.md for local verification. Phase 2 hosted CI/migration/Preview and new-screen iPhone review remain pending; acceptance is not yet claimed. Phase 3 is unstarted.


Phase 2 hosted progress: source is published in draft PR #2. Initial Linux CI and HTTP/readiness pass, hosted 0004 is applied, and explicit PT409 conflict handling is being verified through forward migration 0005. Final hosted and iPhone evidence remains pending; do not use the first deployment as the device acceptance target.


Phase 2 is hosted and verified for CI-passed d377735 on https://i-love-people-c2mef0l08-smooshy.vercel.app. Full results are in IMPLEMENTATION_STATUS.md. Acceptance awaits the new exact Auth URL configuration and iPhone people/history review; VoiceOver remains a pre-release check. Phase 3 is unstarted; no merge or Production promotion.


Phase 2 accepted November 18, 2026 for CI-passed d377735 on https://i-love-people-c2mef0l08-smooshy.vercel.app. New Auth settings are confirmed by the user and the exact redirect/password-replacement journey passed an independent disposable browser test. The user reports all requested iPhone Safari and desktop people/history flows pass without screen, keyboard or functional problems. Full evidence is in IMPLEMENTATION_STATUS.md. Phase 3 remains planned until requested. VoiceOver is still a pre-release check; no merge or Production promotion.


Phase 3 progress, November 18: due-date calculations, ordering, durable in-app controls and weekly review are implemented locally. Deterministic calendar/timezone tests and the actual Maya due, snooze and new-meetup browser journey pass. Current-source Linux CI and hosted migration/Preview/API/browser checks pass. Final Auth URL configuration and new-screen device review remain pending. This does not begin Phase 4 or promote Production.


Phase 3 hosted handoff, November 18: application `a559aa5` passes [both Linux CI jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/44416468153), hosted Alembic 0006, HTTP/deployed API/Data API checks and the actual Maya due/snooze/new-meetup/review browser journey at [the protected Preview](https://i-love-people-k5cwd4tp3-smooshy.vercel.app). Cleanup is verified. [Draft PR #3](https://github.com/TonyL-dev/I-Love-People/pull/3) targets the accepted Phase 2 branch. Final exact Auth URL configuration and new-screen iPhone review remain pending; VoiceOver remains a pre-release check. No Phase 3 acceptance, Phase 4, merge or Production promotion.


Phase 3 usability follow-up, November 19: the user reports the existing mobile date/keyboard/text/appearance/error checks work, and requested clearer current-section navigation, success toasts and visible profile opening. These refinements are implemented and locally verified, with hosted validation pending; the latest evidence is in IMPLEMENTATION_STATUS.md. This is not a request for Phase 4. Auth configuration and VoiceOver are not confirmed by this report.


November 19 usability follow-up verified: `cedb269` passes [both Linux jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/44547451534) and hosted HTTP/actual browser checks at [the revised protected Preview](https://i-love-people-kipv1n31u-smooshy.vercel.app). Clear selected sections, focused details/Back and confirmed-success toasts are delivered in draft PR #3. The earlier mobile passes are user-reported; a focused recheck of the revised interactions, final Auth URL configuration and VoiceOver remain outstanding. Phase 4 is not started.


Phase 3 menu refinement, November 19: implement the user's requested on-demand preferences/account side menu and first-line mobile toast checkmark. Existing authentication, due logic and phase scope stay unchanged. Source/build, 36 browser checks and the real local account journey pass; hosted verification is pending. Revised device review, Auth URL configuration and VoiceOver remain unconfirmed; Phase 4 is not started.


Settings-menu follow-up verified: `97e40ea` passes [both Linux CI jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/44554413689) and actual hosted drawer/toast/account/library checks at [the updated protected Preview](https://i-love-people-pfoktasn6-smooshy.vercel.app). Preferences/account are hidden until Menu opens; toast cues align with the first line. Draft PR #3 is updated. Current-device review, exact recovery URL configuration and VoiceOver remain unconfirmed. No Phase 4, merge or Production promotion.


Phase 3 readiness review, November 19: the user now approves the revised UI. Implementation, CI, hosted browser/security and UI review evidence are complete for 97e40ea. A fresh no-email probe confirms that password recovery for the final pfoktasn6 Preview still falls back to the older kipv1n31u origin. Save the final exact Auth URLs in AUTH_SETUP.md, then verify new-origin password replacement and old-password/used-link rejection to close Phase 3 acceptance. VoiceOver remains a pre-release check; Phase 4 has not started.


## Phase 3 accepted - November 19, 2026

Phase 3 is accepted for application `97e40ea` at [the protected Preview](https://i-love-people-pfoktasn6-smooshy.vercel.app). The user approves the latest UI and confirms saving the final Auth URLs. An independent disposable hosted Chrome journey verified the exact `/reset-password` redirect, password replacement, old-password rejection and used-link rejection, with login/profile responses 200 and no page errors. No test email was sent. Account deletion and absence passed; zero synthetic verification accounts remain. Temporary protected access was revoked and its local file removed.

Together with [both passing Linux CI jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/44554413689), hosted API/RLS/browser evidence and the recorded user device/UI review, this closes Phase 3 acceptance. VoiceOver remains untested before private release. Phase 4 has not started; no merge or Production promotion occurred. The application, Alembic 0006 and API contracts are unchanged by this documentation-only closure.
