# Implementation status

Updated November 22, 2026. Phases 0 through 4 are accepted. Phase 5 is live at the protected Production URL. Stable-origin owner recovery and signed-in confirmation remain open.

| Phase | State |
| --- | --- |
| 0 Foundation | Accepted, with a real Safari pass reported |
| 1 Login and privacy | Accepted on the protected Preview; Production unchanged |
| 2 People and meetups | Accepted on the protected Preview; iPhone/desktop pass reported |
| 3 Due list | Accepted on the protected Preview; UI approval and final-origin recovery pass |
| 4 PWA and Web Push | Accepted on the protected Preview. Hosted schedule, desktop and iPhone evidence recorded |
| 5 Personal release | Promoted to protected Production. Preview recovery, iPhone VoiceOver, staged meetup smoke and stable HTTP smoke passed. Owner recovery and signed-in stable-origin smoke remain open. |
| 6 Enhancements | Backlog |

## Phase 5 implementation — November 22, 2026

Settings now offers JSON export, validated restore with preview and conflict handling, and application-data deletion with same-account password reauthentication. Alembic 0008 adds caller-scoped recovery routines and transactional locking. The [operating runbook](OPERATIONS.md) covers backups, inactive-project/database recovery, serialized trusted migration, staged promotion, rollback and the November 22 published-quota review.

| Verification | Observed result |
| --- | --- |
| Local source and audits | 93 Python and 7 frontend tests, static checks, contract generation and build passed. pnpm and Python production-dependency audits reported no known vulnerabilities. |
| Local database and Auth | Repeat upgrade, readiness and prior ownership/RLS regressions passed. The new drill verified export, preserved archived/paused state and meetup notes in a fresh account, rejected stale and concurrent conflicts, confirmed password proof, checked device and receipt deletion, and removed the disposable accounts. The advisory lock rejected an overlapping migration, and a test downgrade to 0007 and re-upgrade to 0008 passed. |
| Local Chrome | The existing browser suite and the new backup UI regression passed across the browser runs. The new review checked overflow at 320, 390, 768 and 1440 CSS px, axe in both appearances at 320 and 1440 px, and 200% text reflow. Phone and desktop screenshots were inspected. Actual local Auth login/CRUD, nudge changes and captured-email recovery passed separately. |
| GitHub Linux CI | Both jobs passed for `931b522` in [run 45073829273](https://github.com/TonyL-dev/I-Love-People/actions/runs/45073829273), including real local database/Auth/browser drills. The 320 px dark component scan reported transient destructive-button contrast on its first attempt and passed on retry. [Draft PR #4](https://github.com/TonyL-dev/I-Love-People/pull/4) holds the review branch. |
| Protected Preview | [Application `931b522`](https://i-love-people-b28h7198z-smooshy.vercel.app), deployment `dpl_3BsksFZhnceHFc1S2tBV1syF5QPy`. Alembic 0008, repeat upgrade, and restricted challenge-table and function privileges verified. Hosted HTTP, CSP, readiness, two-account recovery, conflict handling, password confirmation, revocation, and ownership checks passed. |
| Hosted Chrome | Actual sign-in, create/read meetup, JSON download, existing-library conflict, fresh-account upload/restore, restored note, confirmed deletion, and reload sign-in passed without page errors. Verified disposable account and row cleanup and revoked temporary Preview access. |
| Contrast follow-up | `91a315f` switches destructive button colors together during appearance changes. Four targeted Chrome checks passed locally, and [both exact-source Linux jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/45074208998) passed with all 40 browser tests. Readiness, CSP and live light/dark button colors passed on the [current protected Preview](https://i-love-people-p1ey31ju3-smooshy.vercel.app), deployment `dpl_A1nrt8LnbYRLz9MDoRd52xdquHKU`. Temporary access was revoked. The earlier hosted recovery drill covered the same backup and deletion code. |
| iPhone and VoiceOver | User-reported pass on iPhone 16 Pro, iOS 27. Backup download to Files, restore conflict and cancellation, empty-account restore, and password-confirmed deletion on a disposable account passed. The user also verified reading order, text, keyboard presentation, menu focus, and both appearances. [Device evidence](DEVICE_REVIEW.md#phase-5-device-result--november-22-2026) |

The hosted advisor still reports disabled leaked-password protection. It also notes RLS tables without policies. The private challenge and push tables deny direct access to the client roles. The quota review estimates $0 for the planned personal workload. Production usage totals and billing remain unverified.

Private-release acceptance still requires real owner-email recovery and the signed-in smoke on the stable Production origin. See the rollout evidence below. Local services were stopped after verification.

### Production rollout preflight — November 22, 2026

Vercel now reports **All Deployments** protection for `i-love-people`. An unauthenticated request to the stable Production URL returned a Vercel sign-in redirect. The project update also requested manual domain assignment and disabled Production Feedback. The existing rollback deployment is `dpl_J1CyonHCA4e9u2Yj5skHUvLjRMKk` from Phase 0. Vercel reports zero Production environment variables.

Supabase shows one active project in the Smooshy Free organization and quoted $0 per month for the separate Production project. GitHub reports that `main` is unprotected and the `production` environment is absent. Draft review branches contain the release source. Database provisioning, protected release workflow setup and promotion are pending.

### Production database provisioned — November 22, 2026

After user approval at the quoted $0/month, Supabase created `i-love-people-production` (`bygwwazskivywtqhpsce`) in Smooshy, Canada Central. The project is `ACTIVE_HEALTHY`. A read-only query confirmed connectivity, zero Auth users, zero public application tables and no Alembic history. The project database measured 11,122,355 bytes. Vercel has Production-only settings for the Supabase URL, publishable key and environment.

The new project's Auth settings endpoint reports email sign-in enabled, anonymous sign-ins disabled, and public signup enabled. Disable signup and configure the exact stable recovery URLs before promotion. Production database credentials, protected GitHub environment setup, Alembic, owner-email recovery, promotion and hosted smoke remain pending.

### Protected main and hosted readiness — November 22, 2026

The user reports saving Production settings. Supabase confirms disabled signup, disabled anonymous authentication, enabled email authentication, and one confirmed account. Vercel reports the sensitive Production database variable, and the staged deployment delivers the isolated Production Auth origin and returns `200 {"status":"ready"}`. The exact reset redirect and owner inbox flow remain to be exercised.

The previously CI-passed review commit `d67997a` was fast-forwarded to protected `main`, and [exact-source main checks](https://github.com/TonyL-dev/I-Love-People/actions/runs/45089395834) passed. Vercel staged `dpl_C67YHXRFHWqfsCV9RMC2FwZBWN1f` while the stable alias still pointed to rollback deployment `dpl_J1CyonHCA4e9u2Yj5skHUvLjRMKk`. The automatic staged build uses the Preview CSP and serves as a connectivity check. Published staging commit `802f8cf` differs from `main` only by the CSP Auth origin.

GitHub confirms the required reviewer and exact `main` branch rule on the `production` environment. The signed-in dashboard showed the expected migration secret name and the matching project reference. [Migration run 45089722419](https://github.com/TonyL-dev/I-Love-People/actions/runs/45089722419) was dispatched on `d67997a` and is waiting for reviewer approval. Final staged smoke and promotion follow successful migration.

### Production migration and release candidate — November 22, 2026

The user approved the gated workflow, and [migration run 45089722419](https://github.com/TonyL-dev/I-Love-People/actions/runs/45089722419) passed. A separate read-only Production query verified Alembic revision `0008_portable_backups`, seven tables with forced RLS, and zero people and meetups. Supabase reports the existing types of advisories for private RLS tables without client policies and disabled leaked-password protection.

Vercel built [the protected Production release candidate](https://i-love-people-afxdyh07g-smooshy.vercel.app) from staging commit `802f8cf` as deployment `dpl_9eugLkh2HrsruVpCbsmMqcX7xqYM`. Verified the exact Production Auth origin and CSP, SPA and reset routes, built JavaScript and CSS, health, database readiness, no-store responses, an application-level unauthenticated 401, and an unknown API route returning 404. Temporary deployment access was revoked. The stable alias still points to rollback deployment `dpl_J1CyonHCA4e9u2Yj5skHUvLjRMKk`. Signed-in meetup CRUD with a disposable Production account and its cleanup precede promotion.

### Stable Production promoted — November 22, 2026

The user reports that a disposable Production account could sign in, add a sample person, log and reopen a meetup, edit it and delete it on the staged candidate. The user then removed the disposable account. Independent Production database checks confirmed one confirmed Auth account and zero people and meetups.

Vercel promoted the same `802f8cf` deployment `dpl_9eugLkh2HrsruVpCbsmMqcX7xqYM` to [the stable Production URL](https://i-love-people.vercel.app/). The alias resolved to that exact deployment. The stable URL passed SPA and reset routes, built JS/CSS, exact Production CSP and Auth origin, health, readiness, no-store and unknown API 404 checks. An anonymous request returned a 302 to Vercel sign-in. Rollback deployment `dpl_J1CyonHCA4e9u2Yj5skHUvLjRMKk` is recorded.

The Production database measured 11,908,787 bytes. Current Supabase Free and Vercel Hobby usage measurements are recorded in [OPERATIONS.md](OPERATIONS.md#monthly-cost-review). Owner-email delivery, exact recovery link destination, replacement-password sign-in and the signed-in stable-origin smoke remain pending.

## Phase 1 evidence (historical) — November 18, 2026

Login, logout, forgotten/reset-password, expired-session and recovery-error flows are implemented. Access tokens stay in tab memory; reload requires sign-in. Account preferences persist in an owner-scoped timezone profile. People and meetup persistence remain unimplemented.

| Verification | Observed result |
| --- | --- |
| Source checks | Ruff, strict mypy, 55 Python tests, Prettier, ESLint, strict TypeScript, 7 frontend tests, OpenAPI drift, contrast checks and production build passed |
| Browser checks | 31 Chromium tests passed in hosted CI; account forms at 320/390/768/1440 px in light/dark, scanned axe rules and overflow checks passed; representative phone screenshots visually reviewed |
| Real local managed Auth/browser | Login, saved preference, reload requiring login, global logout, captured-mail recovery, changed-password login and old-password rejection passed; disposable credentials were not recorded |
| Real local database/API | Alembic through `0003_profile_timezone`, repeat upgrades, API readiness, blocked signup, two-user API/Data API isolation, invalid timezone rejection, anonymous denial, post-logout token rejection, disabled-account rejection and cleanup passed |
| GitHub CI | Both Linux jobs passed for `e60a47f` in [run 44341998540](https://github.com/TonyL-dev/I-Love-People/actions/runs/44341998540), including source/browser and real local Auth/database/browser checks |
| Hosted Preview | [Phase 1 Preview](https://i-love-people-o73m6xnlh-smooshy.vercel.app), `dpl_GhNTVomxdbfCScYnpYyWhXPw4Be4`, READY for `e60a47f`; HTTP, deployed API/RLS and real browser checks passed |
| Real device | User reports all non-VoiceOver Phase 0 checklist steps passed on iPhone 16 Pro / iOS 27.2; VoiceOver was explicitly not tested. The user now also reports owner login, timezone save/reload, sign-out and real email reset/replacement-password login passed in iPhone Safari, with no screen/keyboard problems |

Browser UI tests use mocked provider responses and are distinct from the real local Auth/browser and two-user database exercises. Hosted-service checks first used local ASGI, then passed against the actual deployed API and browser as recorded below. Owner-email delivery is separately supported by the user report below. The database remains synthetic; no people/meetup records are exposed.

### Phase 1 acceptance and release boundary

The user confirmed the final Site URL/exact reset allowlist, successful owner login/preferences/reload/logout, arrival of the real reset email, password reset and replacement-password login, and no iPhone screen/keyboard problems. The provider-rate-limit values are recorded in AUTH_SETUP.md. An agent-run disposable hosted browser recovery independently verified the actual redirect, password update, old-password rejection and used-link rejection without sending email. Synthetic cleanup passed.

Phase 1 is accepted for application commit `e60a47f` on the verified protected Preview. Phase 2 remains planned and has not started. VoiceOver remains explicitly untested before private release. No merge or Production promotion is implied by this acceptance.

## Earlier implementation history

The following dated records describe earlier checkpoints. Statements such as “unimplemented,” “pending,” and old test counts below apply to their recorded checkpoint; the current summary above takes precedence.

## Implemented locally

- React/Vite with strict TypeScript, the approved semantic light/dark tokens, locally bundled Lucide icons and retained licenses, system typography, responsive navigation, and accessible shared controls.
- An explicitly synthetic `/design` reference with Catch up, searchable People, person details/history, a logging dialog, weekly-review layout, appearance settings, component states, and API connectivity. These views do not persist or process personal records. Fixture groupings/dates are not production reminder calculations.
- A root/login layout with password visibility and password-manager semantics. Sign-in is unavailable; no simulated login is presented as an authentication boundary.
- FastAPI liveness/readiness endpoints with router/service/repository separation, generic database failure handling, and `no-store` responses. Vite proxies same-origin `/api` requests to local Python.
- Generated OpenAPI JSON and TypeScript types with a drift check. The frontend's health client validates its actual response.
- An Alembic foundation revision containing no application tables, with version records isolated from exposed schemas and Supabase Auth ownership preserved.
- Supabase CLI 3.2.0 configuration for local PostgreSQL/Auth/Data API, Studio, and mail capture. Public signup, anonymous users, analytics, and CLI application migrations/seeds are disabled. Disposable two-user login and captured-email recovery checks now pass against the actual local services.
- Safe database task adapters detect installed Docker paths, suppress credential-bearing CLI output, and read credentials only into process memory. `db-check` runs local migration/readiness/Data API/Auth checks without writing a credential file. A database integration CI job is defined alongside the source/browser checks.
- Locked JavaScript/Python dependencies, portable Windows bootstrap, environment examples, secret exclusion, `scripts/tasks.py` tasks, a production build, and a credential-free GitHub Actions checks definition.
- Candidate Vercel SPA/API rewrites, Python entrypoint, and security headers. These are source configuration, not a verified deployment.

## Local evidence

| Check | Observed result |
| --- | --- |
| Toolchain | Node 24.22.3, pnpm 11.19.0, CPython 3.12.16, uv 0.13.9 used locally |
| Locked dependency sync | `uv sync --locked` and `pnpm install --frozen-lockfile` passed |
| Windows bootstrap | `scripts/bootstrap.ps1` completed successfully using the host's existing npm/Python and the isolated project tools |
| JavaScript peer compatibility | No peer dependency issues |
| Python checks | Ruff lint/format and strict mypy passed; 7 backend/tooling tests passed, including two CLI-output redaction checks |
| Frontend checks | Prettier, ESLint, strict TypeScript and 2 contract-client unit tests passed |
| Contract generation/drift | OpenAPI JSON and generated frontend types matched |
| Production build | Vite built local static assets successfully |
| Baseline token contrast | 26 light/dark foreground/control pairs passed normal-text 4.5:1 or control 3:1 thresholds; decorative separators were not treated as required control boundaries |
| Browser suite | 16 headless desktop Chrome tests passed with no automated axe violations in the scanned states |
| Viewport coverage | Catch up at 320/390/768/1440 CSS px in light/dark; no horizontal page overflow |
| Core screen coverage | Login, People, person detail, component reference and logging dialog at 320/1440 CSS px in light/dark; dialog content also checked for horizontal overflow |
| Interaction coverage | Unavailable sign-in, password visibility, sample navigation, deep-link reload, search, dirty draft/Escape/keep-editing, sample save, focus return, and empty/loading/error/offline recovery |
| Accessibility samples | Skip link and main focus, keyboard dialog dismissal/focus return, 200% text enlargement, a synthetic long-name reflow sample, reduced-motion styling, and baseline contrast/axe rules |
| Local HTTP smoke | `/design` returned 200 and `/api/health` returned the expected JSON through the Vite proxy |
| Production dependency audit | `pnpm audit --prod` reported no known vulnerabilities |
| Docker/Supabase startup | Docker Engine 29.9.3 started the seven configured local services; services with health checks reported healthy |
| Real migrations | `0001_foundation` applied successfully; two repeated upgrades left the expected revision intact |
| Metadata boundary | `anon` and `authenticated` have no usage of `ilp_migrations`; its version table was absent from the Data API |
| Real database readiness | `/api/ready` exercised through ASGI against actual local PostgreSQL returned 200/ready with no-store |
| Synthetic managed Auth | Two distinct disposable users signed in successfully; public signup was rejected with signup_disabled |
| Captured recovery journey | Both users received local mail; their actual recovery links authorized password changes; old passwords and reused links were rejected; logout requests succeeded |
| Synthetic cleanup | Temporary users were deleted and checked as absent; their captured mail was removed. A final admin query found zero local Auth users |

Representative screenshots are saved under ignored `artifacts/local/`, including `light-1440.png`, `dark-390.png`, and login/people/profile/dialog light/dark variants. Desktop and phone screenshots were visually inspected. Selector accessible names were corrected after the first browser pass. The review-only Components link was moved out of the main navigation after a phone screenshot showed an awkward wrapped navigation label. Long multi-screen scans now have a bounded longer test timeout and four local workers; the final suite passed.

The temporary API and Vite review servers were stopped at handoff. README.md provides the two commands to restart them. The Codex browser-panel open request was queued, so it is not recorded as an observed user-visible preview; the direct local HTTP and headless browser results above were actually observed.

The [GitHub Linux CI run](https://github.com/TonyL-dev/I-Love-People/actions/runs/44232670563) for commit `34305ba` has now been verified as successful. Windows local results remain separate from this CI evidence; neither establishes Vercel behavior or real-device acceptance.

## Docker follow-up — November 17, 2026

The earlier missing-runtime blocker is resolved. Startup, stop/restart, real migration/readiness checks, and the captured-mail recovery drill passed. Local credentials were read from captured CLI status in process memory; passwords and reset links were not written to files or printed. The default `check` command still excludes container integration; use `db-check` explicitly or the new CI database job. UI code did not change in this follow-up, so the earlier browser results were not needlessly rerun.

The per-project `ilp-local` Docker network requests `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`. Inspection confirmed that option and container network membership, but Docker Desktop's effective published-port metadata still showed 0.0.0.0 and IPv6 all-interface mappings. Effective loopback isolation is therefore not claimed. The stack was stopped after checks, retaining local database volumes. No global Docker settings were changed and no personal records were used.

## Outstanding acceptance gates

1. **Local networking — resolved November 18:** explicit loopback mappings are supplied before Docker container creation and enforced by startup/status inspection. Two startup cycles, Windows listeners, loopback/non-loopback probes, and database/Auth regressions passed; see the local isolation evidence below. Application RLS, owner isolation, and API session-revocation enforcement remain Phase 1 work.
2. **Hosted:** configure an isolated synthetic preview environment and trusted deployment credentials, retain the successful GitHub CI evidence and verify Python dependencies, asset delivery, SPA deep links, API routing, HTTPS, security headers, and database connectivity. No provider accounts/projects, hosted credentials, or deployment were created.
3. **Device/accessibility:** actual iPhone Safari, safe areas/software keyboard, VoiceOver or another screen reader, complete keyboard/focus-state coverage, real browser zoom, and hover/pressed/disabled contrast review remain pending. Automated axe and 200% text enlargement are partial evidence only.
4. **Later phases:** managed authentication, private persistence, RLS/authorization, production reminder calculations, real export/restore, and push scheduling/delivery remain unimplemented. Do not advance phases while Phase 0 gates are unmet.

## Planning history and provenance

The initial November 17 sessions established the web roadmap, managed Supabase authentication, ownership rules, hosting assumptions, acceptance gates, design standards, and documentation organization. Active documents were moved into `docs/`; imported source-project documents remain in `docs/reference/` as historical material. Their implementation claims and test counts do not apply here.

The conversation mockup and [INTERACTION_SPEC.md](INTERACTION_SPEC.md) preceded source implementation and remain the approved design direction. The mockup's simulated account, push, and backup interactions do not establish application functionality. The repository component reference and its tests are separate from that conversation artifact.

See [README.md](../README.md) for reproducible commands and [PROJECT.md](PROJECT.md) for ordered phase gates.

## Hosted-gate follow-up — November 17, 2026

The user explicitly chose to complete Phase 0 hosted gates before implementing Phase 1. Phase 1 remains planned. The existing local check suite passed again before changes. Added a read-only HTTPS preview smoke task, synthetic transport tests, and manual dispatch for the existing checks workflow. See the root README for usage. These changes have not been pushed or run on GitHub.

Access check: GitHub Actions API returned HTTP 401 using the available local Git credential. No local Vercel project linkage, deployment CLI, or hosted credential environment variables were available. GitHub, Vercel, and Supabase integrations were discovered but were not connected. Native browser inspection did not provide usable account state. No hosted project, deployment, database, credential, or security setting was created or changed. Hosted CI, preview smoke, effective local binding, and device gates remain pending.

Final local validation: `scripts/tasks.py check` passed with 18 Python tests (including 11 hosted-checker cases), 2 frontend tests, Ruff, strict mypy/TypeScript, ESLint, Prettier, 26 contrast pairs, contract drift, and production build. `git diff --check` passed. The checker rejects redirects, missing security headers, SPA fallback for assets/API, and failed readiness. No hosted request was run because no preview origin was available. Browser/database integration suites were not rerun because application UI and database behavior did not change.

## Verified GitHub CI — November 17, 2026

GitHub was subsequently connected and [Checks run 44232670563](https://github.com/TonyL-dev/I-Love-People/actions/runs/44232670563) was inspected through the connector. Both `local-checks` (job 134561232821) and `local-database` (job 134561233097) completed successfully for commit `34305ba27752de65f6e5223b391b1aa26b7da55a`, between 22:45 and 22:47 America/Toronto. Logs confirm 7 Python tests, 2 frontend tests, 16 browser tests, contract/build checks, repeated baseline migration, database-backed readiness, metadata isolation, two-user managed Auth/recovery, and stack shutdown. This is GitHub-hosted Linux evidence using disposable local Supabase containers, not a hosted Supabase or Vercel smoke.

The earlier Git credential HTTP 401 no longer blocks repository inspection through the connected integration. Vercel and Supabase integrations remain unconnected. No deployment status was reported for this commit through the combined-status endpoint; that does not establish whether any provider project exists. The new smoke tooling/manual dispatch changes remain local and are not covered by this run. Phase 0 preview, networking, and device gates remain pending; Phase 1 remains unstarted.

## Supabase preview provisioned — November 17, 2026

The user approved creation in Smooshy / Canada Central at $0 only. The quoted price was $0/month. Project `i-love-people-preview`, ref `efuixughigoyyyflyelm`, reports ACTIVE_HEALTHY with PostgreSQL 17.12. A connected-tool `SELECT 1` returned 1. Inspection found no tables in `public` or `ilp_migrations`; security advisors returned no lints. These are control-plane checks only. No Alembic migration, Auth setting change, signup verification, user provisioning, or Vercel-to-database connectivity check has run. No personal data was added.

Vercel is now connected, superseding the earlier unconnected state. Project listing returned HTTP 403 for scope `smooshy`, team `team_0oYpM6FO3VnXGC52TZRj2bo1`. The prescribed single-use team-access consent link was returned to the user. After the user reported approval, the explicit team-scoped project request still returned HTTP 403. Account lookup succeeded and reports Hobby with Smooshy as the default team. A fresh single-use consent link was provided; no reconnect was requested. Project discovery/linking, trusted environment credentials, and deployment remain pending a successful team grant. No source/UI behavior changed in this follow-up; no tests were rerun.

## Verified Vercel Preview — November 17, 2026

Smooshy team access now works, superseding the earlier 403. Discovered project `i-love-people` / `prj_PLYAyVgDYwhFYSTHAKrUuFVb4yOn` and an existing READY production-target import of commit `34305ba`. Its environment listing was empty. Changed only the project Node setting from 26.x to 24.x and created [Preview deployment](https://i-love-people-23opv72l1-smooshy.vercel.app) `dpl_2Tr3g1qkzQBuesna9UdEbSpZYBVs` from exact commit `34305ba27752de65f6e5223b391b1aa26b7da55a`. It reached READY. No production promotion or secret change occurred. The ignored local Vercel descriptor now contains the inspected project/team IDs.

Observed via authenticated Vercel HTTP fetch with Deployment Protection retained:

| Check | Result |
| --- | --- |
| `/`, `/login`, `/design`, `/design/people/maya` | 200 HTML SPA entrypoints |
| JavaScript and CSS under `/assets/` | 200 with correct content types |
| Security headers | CSP, nosniff, no-referrer, Permissions-Policy present |
| `/api/health` | 200, exact health JSON, no-store |
| Unknown `/api/phase-zero-missing` | 404 JSON, no-store |
| `/api/ready` | 503, generic unavailable JSON, no-store |

Build logs confirm the exact commit and frozen pnpm 11.19.0 installation. These are live hosted HTTP checks, not browser/device evidence. The standalone hosted-smoke command was not run against the protected origin; its equivalent HTTP assertions were inspected through the connector. No database URL is configured, and ignored `.env.preview` did not exist at handoff. The user was asked to supply the preview connection URL there for Alembic and a Vercel Preview Secret. Hosted database connectivity, migrations, effective local binding, and device gates remain pending.

## Hosted credential validation — November 18, 2026

The user supplied ignored `.env.preview`. Validation confirmed the expected direct project hostname, username, port/database, SQLAlchemy psycopg driver, password presence, and SSL requirement without printing the URL or password. The direct hostname failed local DNS resolution (Windows error 11001). The captured Alembic attempt failed before database access; no baseline application is claimed and no Vercel secret was written. Requested the full Session pooler URI as the documented IPv4 alternative. Hosted readiness remains pending. No source/UI behavior changed and no application test suite was rerun.

## Hosted database and full HTTP smoke passed — November 18, 2026

The corrected Session pooler URL passed format/project/SSL validation and a real SELECT 1. Captured Alembic upgrades ran twice successfully against the isolated hosted project; `ilp_migrations.alembic_version` is `0001_foundation`, and anon/authenticated have no schema USAGE. A separate connected-tool query confirmed the version and security advisors returned no lints. No application tables or Auth schema changes were introduced.

Configured `ILP_DATABASE_URL` as type `sensitive`, target `[preview]`, in the existing Vercel project. Values were withheld from output; metadata-only inspection confirmed the target/type. No Production or Development setting was added. The credential file is ignored and its URL/password were absent from local built assets.

[Preview deployment](https://i-love-people-9xnbgkdx9-smooshy.vercel.app) `dpl_8E33qgjzEaizmJforFHnrs1HhtUL` reached READY for exact CI-passed commit `34305ba27752de65f6e5223b391b1aa26b7da55a` with Node 24. Live authenticated Vercel HTTP checks passed for `/`, `/login`, `/design`, `/design/people/maya`, both built JS/CSS assets and their content types, CSP/nosniff/no-referrer/Permissions-Policy, exact health JSON, and exact `200 {"status":"ready"}`. Unknown API route returned 404 JSON. All tested API responses had no-store. Deployment Protection remained enabled; no production promotion occurred.

This supersedes the earlier missing-credential/503 blocker. The standalone smoke script was not run against the protected URL; equivalent assertions were evaluated on live connector responses. Browser/device, effective local Docker binding, and a repeatable trusted deployment pipeline remain separate outstanding work. The new local tooling/docs are not in the deployed commit. No source/UI behavior changed in this follow-up; local check results remain the previously recorded 18 Python tests and 2 frontend tests. `git diff --check` passed.

## Local port isolation resolved — November 18, 2026

Docker Engine 29.9.3 on this host ignored the existing network binding default. The pinned Supabase CLI delegates container creation to Docker CLI, so a project-scoped launcher now supplies explicit `127.0.0.1` publication before creation. `db-start` inspects effective published ports and stops the stack on failed verification; status/credential reads require the same check. Unsupported creation options, publish-all, non-loopback mappings, and foreign publication targets are rejected. distlib 0.4.4 is pinned as a dev-only native-launcher dependency, with generated files under ignored `.tools/docker-loopback`. Global Docker, PATH, and firewall settings were not changed.

Observed local evidence:

| Check | Observed result |
| --- | --- |
| Startup/stop/restart | Two clean startup cycles passed explicit binding inspection |
| Docker publication | API 54321, PostgreSQL 54322, Studio 54323, mail 54324 on `127.0.0.1`; no wildcard/IPv6 publication |
| Windows listening sockets | The same four ports listened only on `127.0.0.1` |
| TCP reachability | Four loopback connections succeeded; all 12 probes through three non-loopback host addresses were rejected |
| Database/Auth regression | `db-check` passed after each startup: repeated migration, metadata isolation, actual readiness, Data API, two-user login/recovery/reset, blocked signup, and cleanup |
| Source checks | `scripts/tasks.py check` passed: Ruff, strict mypy, 35 Python tests, contracts, baseline contrast, Prettier, ESLint, strict TypeScript, 2 frontend tests, production build |
| Browser review | All 19 headless Chrome tests passed with two workers, including original reflow/axe journeys and three new interaction/modal tests |
| Interaction states | 24 default/hover/pressed text-contrast measurements met 4.5:1; keyboard focus indicators met 3:1; disabled/busy semantics and modal focus containment/return passed |
| Visual samples | Light/dark control-focus screenshots saved under ignored `artifacts/local/` and visually inspected |
| Cleanup | Stack stopped with database volumes retained |

The first four browser navigations timed out during concurrent Docker startup. A clean two-worker run passed all 19 without increasing timeouts; two workers is now the default. One attempted direct runner invocation used system Node 18 and failed before tests; the repository runner supplied Node 24 for the passing run. The browser component-reference screen correctly showed API-unavailable feedback because no standalone API server was started for that suite; real API/database readiness was exercised separately by `db-check`.

Same-host network probes are not a second-device LAN test. Desktop tests do not establish real iPhone Safari, software keyboard, safe-area, VoiceOver, or actual browser Page Zoom evidence. The user was given [DEVICE_REVIEW.md](DEVICE_REVIEW.md); results remain pending. No app UI or hosted deployment changed in this follow-up. New source/tooling changes are locally verified but not yet covered by the earlier GitHub CI run.

Device evidence and sequencing, November 18, 2026. November 18, 2026: user-reported pass on iPhone 16 Pro, iOS 27.2, for all non-VoiceOver steps in DEVICE_REVIEW.md. VoiceOver was explicitly not tested. This is user-reported device evidence, not an agent-observed session. The written Phase 0 acceptance (reproducible local foundation, passing checks, recorded hosted smoke) is satisfied; device Safari review is additionally reported passed. VoiceOver is carried as an unverified pre-release accessibility check under DESIGN_STANDARDS.md, not silently marked passed. Earlier statements treating VoiceOver as a prerequisite for Phase 1 were too strict. Phase 1 implementation now begins under the original user request.

Review branch: local `codex/phase-1-login-privacy`. GitHub tree publication was rejected with provider HTTP 403; no remote Phase 1 commit, hosted CI or deployment is claimed. Temporary local services were stopped after verification.

## Hosted Auth/database verification — November 18, 2026

The user reported provider steps 1–4 configured. Public settings confirm disabled signup/anonymous Auth and enabled email/password. Server-only admin access works and one pre-existing account was present; no owner password was read or changed.

Alembic advanced the isolated Preview from `0001_foundation` through `0003_profile_timezone`; repeated upgrade succeeded. `scripts/hosted_auth_smoke.py` validates this exact project and SSL Session pooler, keeps credentials in memory, creates only disposable `example.test` accounts, and sends no test mail. Actual hosted managed logins and Data API reads/writes, combined with current Python code via local ASGI, passed two-user ownership, anonymous/forged-token denial, direct timezone constraints, logout revocation and disabled-account rejection. Provider password rules reject short passwords and missing lowercase/uppercase/numbers. Disposable users were deleted and absence verified. These are hosted-service checks, not a deployed API/browser acceptance result.

Hosted tokens initially failed local verification because the provider clock was two seconds ahead. JWT verification now allows five seconds of clock skew; new regression cases accept the small difference and reject larger future issuance, while expired/signature/issuer/audience checks remain enforced. The full source check passes with 55 Python and 7 frontend tests. Browser source was unchanged after its 30-test pass.

Vercel Preview-only `ILP_SUPABASE_URL`, public `ILP_SUPABASE_PUBLISHABLE_KEY` and `ILP_ENVIRONMENT=production` are stored. The existing sensitive database setting is retained; the admin test key was not deployed. No new Vercel deployment or Production promotion occurred. GitHub tree publication was rechecked and still returned HTTP 403, including without workflow-file changes. Owner-email recovery, actual provider limit values, deployed-source CI/smoke and account-screen device evidence remain pending.

The Supabase security advisor reports leaked-password protection disabled. No paid protection or SMTP feature was enabled; this notice does not establish an RLS failure. See [provider password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

GitHub access restored, November 18: after user reconnection, the connected GitHub tree-write probe succeeds. Local Git still lacks interactive credentials; source publication uses the authorized connector. Earlier provider 403 records are historical. CI and exact-source Preview are being verified.

Protected Preview integration, November 18: commit c031afa passed GitHub CI run 44340365242, including both Linux jobs. Live smoke found an injected Vercel feedback script; Preview Feedback was disabled and the same source rebuilt. HTTP/deployed two-user API/RLS checks then passed, but browser login exposed that credentials=omit blocked the hosting protection cookie. Same-origin API/config/health requests now retain only same-origin cookies; cross-origin Supabase requests continue to omit cookies. Application authentication still requires the verified bearer token. A protected-cookie browser regression passes locally. The fix is being published and reverified; earlier Preview URLs are not the final recovery target. Owner-email recovery and device evidence remain pending.

## Final protected Preview verification — November 18, 2026

Application commit `e60a47fe289ed968a68eba9cf4f089a0d868c529` is published in [draft PR #1](https://github.com/TonyL-dev/I-Love-People/pull/1). [GitHub CI run 44341998540](https://github.com/TonyL-dev/I-Love-People/actions/runs/44341998540) passed both Linux jobs, including all 31 browser tests and the real local database/Auth/browser journey. A duplicate push run is separate; the successful PR run establishes the gate.

The final [Preview](https://i-love-people-o73m6xnlh-smooshy.vercel.app) (`dpl_GhNTVomxdbfCScYnpYyWhXPw4Be4`) is READY for that exact commit. HTTP smoke verified headers/CSP, bundled JavaScript/CSS, SPA deep links, Python health/database readiness, no-store and API 404. Actual deployed API plus hosted Auth/Data API passed two-user ownership, anonymous/forged-token denial, invalid timezone rejection, logout-token revocation and disabled-account rejection. The live Chrome browser passed managed login, timezone persistence, fresh sign-in on reload, logout, no credential persistence and simulated browser-clock session expiry; no page errors were observed. Expired-token cryptographic checks remain covered by Python tests.

All three deployment-review synthetic users were removed and absence verified; a final database query found zero `ilp-%@example.test` users. Temporary protection-token storage was removed. Review scripts under ignored `.tools/` adapted the existing smoke/ownership exercises to protected HTTPS and drove Chrome without traces, videos or credential screenshots. Deployment Protection stayed enabled. Preview Feedback was disabled to prevent Vercel's injected external feedback script. The same-origin cookie fix retains only hosting protection access; application identity still requires the bearer token, and cross-origin Auth requests omit cookies.

No merge or Production promotion occurred. The user has been asked to replace the earlier Preview redirect targets with the final URL above, test real owner-email recovery/new-password login and review account screens in iPhone Safari. Those results, actual provider-rate-limit values and VoiceOver remain unverified; Phase 1 is not accepted and Phase 2 has not started.

## Phase 1 acceptance — November 18, 2026

User-reported evidence: final Preview redirects saved; owner login, timezone save/reload, sign-out, actual reset email arrival, password reset and replacement-password login all worked in the requested iPhone Safari journey, with no screen/keyboard problems. Earlier device identification in this chat was iPhone 16 Pro / iOS 27.2. This is user evidence, not agent observation of the owner inbox or device. The reported provider limits are recorded verbatim by category in AUTH_SETUP.md.

Agent-observed supplementary evidence: a disposable `example.test` account used an administratively generated recovery link (no email sent). Real Chrome followed the hosted verification link to the exact final `/reset-password` path, cleared URL credentials, changed the password through managed Auth, rejected the old password, accepted the replacement and rejected reuse of the link. Browser login/profile requests returned 200 and no page errors were observed. The account was deleted and absence verified; temporary protection-token storage was removed.

Together with source checks, both successful Linux CI runs for e60a47f, deployed API/RLS/revocation and browser expiry checks, this satisfies the written Phase 1 gates. Phase 2 is not started. VoiceOver remains unverified before private release; Production remains unchanged.


## Phase 2 local implementation — November 18, 2026

Implemented people add/edit/search/archive/restore/delete, four optional private priorities, explicit cadence suggestions and independently clearable cadence. Person profiles show latest surviving meetup or an unknown-date state. Meetup creation/edit/delete supports exact dates and optional bounded notes, saved-timezone future-date rejection, UTC audits, optimistic revisions and durable account-scoped request receipts. Destructive actions name the affected person and use confirmation dialogs.

Local evidence: source checks cover 61 Python tests and the existing 7 frontend tests; generated OpenAPI contracts include all new routes. The real local two-user API/Data API smoke exercises persistence, backdates, latest-entry edit/delete, retry payload conflicts, parallel duplicate creation, stale revisions, archive retention, owner/foreign-parent checks, direct future-date/revision rejection and cascading cleanup. The real Chrome/Auth/Python/Postgres journey creates a person/meetup and verifies persistence after reload and fresh login, alongside existing captured-email recovery. Its light/dark 320/390/768/1440 reflow and axe checks pass; synthetic screenshots are under artifacts/local/phase2-*.png. Representative phone and dialog screenshots were visually inspected; checkbox alignment was corrected afterward.

Hosted Phase 2 CI, migration and Preview verification have not run. The accepted protected Preview still runs Phase 1 e60a47f. New people/history iPhone Safari evidence and VoiceOver remain unverified. No Phase 3 implementation, merge or Production promotion. Final verification: `scripts/tasks.py check` passes (61 Python tests, 7 frontend tests, lint/types/format/contracts/design checks and production build); all 33 Playwright browser tests pass in installed Chrome. The final live browser/Auth/API/database journey passes including account/data/mail cleanup. Long names, 200% text, keyboard focus and axe pass on the new editor; representative screenshots were inspected. Local Supabase is stopped. Hosted CI/deployment and real-device Phase 2 acceptance remain pending.


Phase 2 hosted rollout in progress: draft PR #2 is published; 7c6e268 passed both Linux CI jobs in run 44396348593. Hosted 0004 upgrade is applied and protected Preview dpl_2hUkBHsABfn5zHEidSZfBsvsswfX passes readiness/HTTP smoke. Full hosted checks found deliberate serialization-code conflicts could time out; the forward migration 0005 and PT409 adapter fix are being verified. This initial deployment is not the final device target. Temporary regression users were cleaned up after failed runs.


Phase 2 hosted verification, November 18, 2026. Application commit d377735 passes both Linux CI jobs (https://github.com/TonyL-dev/I-Love-People/actions/runs/44398237798), with 62 Python tests, 7 frontend tests, 33 browser tests and real Linux database/Auth/browser checks. Protected Preview https://i-love-people-c2mef0l08-smooshy.vercel.app (dpl_DjMRfY6j4JoqJu1P4emgDJnCdKLU) is READY for that commit. Alembic 0005_explicit_conflicts applied twice. HTTPS/assets/SPA/security headers/health/readiness/no-store/API 404, actual deployed two-user API/Data API ownership and revocation, concurrent duplicate creation, stale-edit/request conflicts, backdates/latest-entry changes/archive/cascade, and live Chrome people/meetup persistence/reload/logout/expiry all pass. No browser page errors; temporary users were deleted and final synthetic-account count is zero. Owner/session forced RLS is verified for every new table. Local services are stopped; temporary share-token files were removed at handoff. Existing leaked-password-protection advisor warning is unchanged; no paid feature was enabled.

The new Preview is ready for owner iPhone Safari review. A no-email recovery-link probe confirms its exact reset destination is not yet allowlisted: Supabase currently falls back to the accepted Phase 1 origin. The connected Supabase tools cannot update Auth URL settings. The user must set the Site URL to https://i-love-people-c2mef0l08-smooshy.vercel.app and add https://i-love-people-c2mef0l08-smooshy.vercel.app/reset-password in Auth URL configuration before reviewing recovery on the new origin. Keep the old exact redirect until the new one is verified; avoid wildcards. Phase 2 acceptance remains pending that configuration and the new people/history iPhone evidence. VoiceOver remains unverified before private release. Draft PR #2 stays open; no merge, Phase 3 or Production promotion.


## Phase 2 accepted — November 18, 2026

The user confirmed the new Supabase Auth URL settings and reported every requested people/history test passed in iPhone Safari and desktop, including persistence across fresh sign-in and devices, with no screen, keyboard or functional problems. This is user-reported evidence, not an agent-observed device session. The earlier device identification was iPhone 16 Pro / iOS 27.2; no new device/version was supplied in this report.

An independent disposable Chrome recovery on [https://i-love-people-c2mef0l08-smooshy.vercel.app](https://i-love-people-c2mef0l08-smooshy.vercel.app) passed the actual hosted reset redirect, password replacement, rejection of the old password and rejection of the used link. Login/profile returned 200, no page errors were observed, and the synthetic account was deleted with absence verified. No test email was sent. Temporary protection-token storage was removed.

Combined with both successful Linux CI jobs in [run 44398237798](https://github.com/TonyL-dev/I-Love-People/actions/runs/44398237798), 62 Python/7 frontend/33 browser tests, deployed API/Data API isolation/concurrency/privacy checks and live browser persistence for application d377735, this satisfies Phase 2 acceptance. Alembic remains at 0005_explicit_conflicts. Phase 3 remains planned; VoiceOver remains unverified before private release. No merge or Production promotion.


## Phase 3 local implementation - November 18, 2026

Implemented calendar days/weeks/months with month-end clamping, due-now/inclusive-seven-day/later/unknown states, deterministic priority/date/name/ID ordering, durable snooze/dismiss/pause/unpause and weekly due reasons. Cadence remains independently editable. Profiles retain the original catch-up date. Archive/pause and missing history suppress recurring nudges. Advancing latest dates and final-meetup removal atomically clear snooze/dismiss; older entries and note-only edits preserve them. Reads recalculate eligibility across fresh service instances.

Local source checks pass (83 Python and 7 frontend tests, Ruff/mypy/ESLint/TypeScript, generated-contract drift, token contrast and production build); 33 browser regressions pass in installed Chrome. Real local Alembic 0006 repeat-upgrade/readiness/Auth/two-user API/Data API checks cover preferences, conflicts and cycle resets. The actual Maya browser journey passes due, snooze with unchanged due date, weekly review, pause/unpause, dismissal and a newer meetup clearing snooze/dismiss. Reload/login, history persistence, logout and captured-email recovery remain covered. Disposable users/mail and owned review servers are cleaned up.

Visual evidence includes synthetic 320/390/768/1440 px light/dark screenshots, reduced motion, axe checks and 200% text reflow. Representative phone and enlarged review images were inspected. Review found a fixed-offset skip link peeking over the header with enlarged text; it now hides by its own height. A real sequential-action race was corrected by applying the confirmed API state before enabling controls.

Hosted exact-source CI, migration/deployment/API/browser verification and new iPhone Safari review remain pending. VoiceOver remains untested before private release. No Phase 3 acceptance, Phase 4, merge or Production promotion is claimed.


## Phase 3 hosted handoff - November 18, 2026

| Verification | Observed result |
| --- | --- |
| Application | `a559aa5c7500e3c8325c709572352de3c1280e4e`; [draft PR #3](https://github.com/TonyL-dev/I-Love-People/pull/3) based on accepted Phase 2 |
| Linux CI | [Run 44416468153](https://github.com/TonyL-dev/I-Love-People/actions/runs/44416468153) passed both jobs: 83 Python, 7 frontend and 33 browser tests plus real local database/Auth/browser checks |
| Hosted migration | Alembic `0006_in_app_nudges` applied and repeated successfully on the isolated synthetic project |
| Preview | [https://i-love-people-k5cwd4tp3-smooshy.vercel.app](https://i-love-people-k5cwd4tp3-smooshy.vercel.app), `dpl_HhGygzx9uQmEpPFsAw4J4V523Hm7`, READY; Node 24, protection enabled, feedback disabled |
| HTTP smoke | HTTPS, SPA routes/assets, security headers, no-store health/readiness and API 404 passed |
| Deployed API/Data API | Two-user ownership, anonymous/forged-token denial, logout/disable rejection, retries/conflicts, cadence due dates, durable nudge controls and meetup-cycle resets passed; direct Data API newer-meetup edits also clear the cycle |
| Actual deployed browser | Maya add/cadence/backdated meetup, due, snooze preserving original due date, weekly reasons, pause/unpause, dismissal, new latest meetup clearing state, reload/login persistence, logout and expiry passed |
| Visual review | Actual hosted synthetic light/dark 320/390/768/1440 px screenshots, reduced motion, axe and 200% text reflow passed; representative phone/desktop/enlarged screenshots inspected |
| Cleanup | Zero synthetic verification accounts remain. An interrupted harness's two fixtures were explicitly removed. Temporary protected-access token revoked and local token file removed. Local services stopped |
| Recovery/device | No-email probe confirms the new exact reset target is absent and falls back to the accepted Phase 2 origin. New Auth URL configuration and independent new-origin recovery check await the dashboard save. New-screen iPhone and VoiceOver evidence remain unverified |

The security advisor still reports the pre-existing [leaked-password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no new schema advisories were returned. No paid feature was enabled. The remaining checks are in AUTH_SETUP.md and DEVICE_REVIEW.md. Phase 3 is implemented and hosted-verified, with acceptance pending those configuration/device steps. No Phase 4, merge or Production promotion.


## Phase 3 usability feedback - November 19, 2026

The user reports that date controls, software keyboard, long names, light/dark, enlarged text and readable errors work correctly on the existing Phase 3 UI. They request a more obvious current section, success feedback for actions such as snooze/pause, and an unmistakable result when opening a person on mobile. No new device/OS version, Auth URL save or VoiceOver result was supplied. This is user-reported evidence for the previous Preview, not an agent-observed device run or acceptance of the revised interactions.

Implemented selected primary navigation with a check mark, `aria-current` and matching page titles; a single focused person-detail view with Back restoring filtered-list context; and dismissible confirmed-success toasts for people, meetup and nudge mutations. Toasts pause expiration on hover/focus, replace previous feedback and clear on account unmount. Errors remain inline. Local source/build checks pass (83 Python and 7 frontend tests). The 35 browser regressions pass across the full run and isolated rerun of a login test that hit its overall time limit; new navigation/toast checks pass. The real local account/nudge/recovery journey passes with synthetic cleanup. Hosted verification of this revision remains pending. No backend/schema/contract changes, Phase 4, merge or Production promotion.


## November 19 usability verification and handoff

| Check | Observed result |
| --- | --- |
| Current application | `cedb269aa5d9f60cd1aecbbcd7095461f0384d19` in draft PR #3 |
| Linux CI | [Run 44547451534](https://github.com/TonyL-dev/I-Love-People/actions/runs/44547451534) passed both jobs: source/contracts/build, 83 Python/7 frontend/35 browser checks and real local database/Auth/browser journey |
| Preview | [https://i-love-people-kipv1n31u-smooshy.vercel.app](https://i-love-people-kipv1n31u-smooshy.vercel.app); Git-built `dpl_H5GW5rw39kH7ME8AbK5Ut6jgK4uw`, READY with exact commit verified |
| Hosted HTTP/browser | Routing/assets/headers/no-store/health/readiness/404 pass. Actual login, new focused detail/Back, snooze/pause success messages, dismiss/new-meetup cycle, review, persistence, logout and expiry pass; no page errors |
| New interaction checks | Selected current state and distinct styling, filtered-search Back focus, visible heading/Back below sticky navigation, pending request without success, conflict inline without toast, repeated messages, hover/focus timeout, dismiss and logout cleanup pass |
| Visual evidence | Light/dark 320/390/768/1440 px, axe and enlarged-text checks pass; phone detail and enlarged-toast viewport screenshots inspected. Mobile toast text uses the full second row to avoid excessive wrapping at 200% |
| Cleanup | Real local and hosted fixtures removed; final hosted account inspection found zero synthetic verification accounts. Temporary share link revoked and file removed. Local services stopped |
| Remaining evidence | The user reports prior date/keyboard/long-name/appearance/enlarged-text/error checks pass. Revised interactions need a quick device recheck. No Auth URL save or VoiceOver result was supplied; no new-origin recovery claim is made |

No backend, schema, dependency or API contract changes. No Phase 3 acceptance, Phase 4, merge or Production promotion. Source verification remains attached to the application commit above; the subsequent handoff commit changes documentation only.


## Settings menu and toast feedback follow-up - November 19, 2026

Implemented the user-requested side menu for Your preferences and Account, including saved identity/recovery/sign-out controls. A labeled Menu button opens a right-side native modal with deliberate Close focus, Escape/backdrop dismissal and focus return. The underlying library selection/search stay mounted. Closing cancels a pending logout confirmation; timezone edits remain in memory until explicitly saved. Loading/error and saved-timezone feedback remain accessible in the active context.

The success checkmark now sits beside the first toast line, with naturally wrapping text and unchanged lifetime/dismissal. Normal and 200% text alignment is measured in browser checks. Initial visual review found an overly narrow enlarged drawer heading; wrapping and narrow-toast spacing were corrected. Source checks pass (83 Python/7 frontend, lint/types/contracts/design/build); all 36 browser checks and the actual local account/nudge/recovery journey pass with verified synthetic cleanup. Hosted evidence follows after verification. No API, schema, dependency, Production or Phase 4 changes.


## Settings-menu verification and handoff - November 19, 2026

| Check | Observed result |
| --- | --- |
| Application | `97e40eafd3a695b422cd248b291d0505a18f7777` in draft PR #3 |
| Linux CI | [Run 44554413689](https://github.com/TonyL-dev/I-Love-People/actions/runs/44554413689) passed both jobs: 83 Python, 7 frontend, 36 browser checks and real local database/Auth/browser |
| Preview | [https://i-love-people-pfoktasn6-smooshy.vercel.app](https://i-love-people-pfoktasn6-smooshy.vercel.app), `dpl_FpMv9MC2UzDTZzuUqXBfCo9ySJDg`, READY; exact Git commit and protected Preview target verified |
| Drawer behavior | Hidden by default; right-side layout, deliberate Close focus, native background-focus exclusion, Escape/backdrop close, restored opener/library/search, timezone/appearance and logout confirmation pass |
| Toast behavior | Icon is beside the first text line at normal and 200% text; measured local and actual hosted alignment passes. Success/failure, timeout/hover/focus, dismiss and logout cleanup remain covered |
| Visual review | Light/dark at 320/390/768/1440 px, axe and enlarged text pass. Header wrapping and sticky coverage were corrected after visual inspection; representative actual hosted drawer/toast images inspected |
| Hosted flow | HTTP routing/assets/headers/no-store/readiness/404 plus actual login, drawer preference/appearance, snooze/pause/dismiss, meetup/review/persistence, logout and expiry pass; no page errors |
| Cleanup | Zero hosted synthetic verification accounts remain. Temporary share access revoked and local file removed. Local services stopped |

This is presentation-only: no backend, API, schema, dependency or credential change. Revised iPhone/VoiceOver and exact Auth URL confirmation remain unverified. No Phase 3 acceptance, Phase 4, merge or Production promotion. The following handoff commit changes documentation only; source verification is attached to the application commit above.


## Phase 3 readiness review - November 19, 2026

The user reports the latest settings-menu/toast UI looks good after the requested review. This closes the revised UI review by user report; no new device/OS version or VoiceOver result was supplied. Existing implementation, local/CI and hosted checks for 97e40ea remain the source evidence; no code changed and no unrelated test suite was repeated.

A fresh disposable no-email recovery-link probe requested `https://i-love-people-pfoktasn6-smooshy.vercel.app/reset-password`. The provider did not allowlist it and instead selected `https://i-love-people-kipv1n31u-smooshy.vercel.app`. Temporary account deletion and absence passed. The remaining Phase 3 acceptance item is the exact final Site URL/reset allowlist save followed by independent new-origin recovery verification. VoiceOver remains a later pre-release check. No Phase 3 acceptance, Phase 4, merge or Production promotion yet.


## Phase 3 accepted - November 19, 2026

Phase 3 is accepted for application `97e40ea` at [the protected Preview](https://i-love-people-pfoktasn6-smooshy.vercel.app). The user approves the latest UI and confirms saving the final Auth URLs. An independent disposable hosted Chrome journey verified the exact `/reset-password` redirect, password replacement, old-password rejection and used-link rejection, with login/profile responses 200 and no page errors. No test email was sent. Account deletion and absence passed; zero synthetic verification accounts remain. Temporary protected access was revoked and its local file removed.

Together with [both passing Linux CI jobs](https://github.com/TonyL-dev/I-Love-People/actions/runs/44554413689), hosted API/RLS/browser evidence and the recorded user device/UI review, this closes Phase 3 acceptance. VoiceOver remains untested before private release. Phase 4 has not started; no merge or Production promotion occurred. The application, Alembic 0006 and API contracts are unchanged by this documentation-only closure.

## Phase 4 local implementation - November 19, 2026

The Phase 4 review branch adds Home Screen installation, per-device notifications and quiet hours, sign-out opt-out, offline handling, and a bounded sender with private Alembic 0007 records. The sender evaluates the same calendar recurrence as Catch up and emits generic text. The candidate Cloudflare cron invokes the FastAPI job with a separate server secret.

Local Alembic upgrade repeatability, API readiness, two-user application RLS and managed Auth pass. The Phase 4 database smoke verifies owned enrollment, rejection of foreign enrollment, absence through the Data API, pause suppression, concurrent job deduplication, unsubscribing and provider revocation using a controlled transport. Unit tests exercise actual VAPID signing and aes128gcm encryption with a synthetic recipient. Local Chrome's production worker received a DevTools-injected push, showed generic text, cached only hashed JS/CSS, retained an open-page draft offline and showed the generic fallback after reload. This evidence covers the worker and local job, with live-provider delivery and closed-app device acceptance still pending.

Phase 4 acceptance is open. Hosted cron execution, real desktop/browser-provider delivery, permission revocation, closed Home Screen iPhone delivery and VoiceOver remain to be verified. Follow [PUSH_SETUP.md](PUSH_SETUP.md).

Source verification passed with 93 Python tests, seven frontend tests, OpenAPI drift and the production build. The 38-test Chrome suite passed, with focused reruns for the drawer, notification controls and production worker after visual adjustments. The local managed Auth/browser journey also passed. A light 390 px and dark 1440 px screenshot review exposed a clipped mobile heading when jumping to the section. The drawer now scrolls its content below the header.

The local scheduler handler made the expected protected POST with a stub HTTP response. A live Chrome subscription probe received a permission denial in an isolated context and timed out in a fresh persistent profile, so there is no live desktop delivery evidence. A deployed scheduler and real iPhone are still needed for acceptance. Local Supabase was stopped after testing.

## Phase 4 protected Preview rollout — November 21, 2026

Both Linux jobs passed in [run 44940028494](https://github.com/TonyL-dev/I-Love-People/actions/runs/44940028494) for `64bd569`. Deployment `dpl_8ABHxMJCrffbrkJz7Pc8QHxpBFci` is READY at the [protected Phase 4 Preview](https://i-love-people-8fi33jomc-smooshy.vercel.app). Alembic 0007 applied twice and forced RLS and explicit client-role revocation are verified. Protected HTTP/SPA/API smoke, manifest/icon/worker headers, job bearer denial, two-user push API isolation and Data API denial passed. Actual Chrome sign-in, public-only Cache Storage and hosted device enrollment passed. Three Web Push settings are sensitive and scoped to the Phase 4 Preview branch.

Cloudflare initialized the required account subdomain. The trial worker has no public route and holds both credentials in secret bindings. The initial scheduled version threw before it could fetch because Cloudflare Workers rejects `redirect: 'error'`. Scheduler commit `78fd411` uses manual redirects with explicit failed-status handling. See [PUSH_SETUP.md](PUSH_SETUP.md) for phone verification and cleanup.

The corrected scheduler passed [run 44948160392](https://github.com/TonyL-dev/I-Love-People/actions/runs/44948160392) at `78fd411`. At the 20:50 UTC tick, Cloudflare Analytics recorded one successful invocation and one outbound subrequest. Vercel Python dispatched two encrypted pushes. The intentionally invalid endpoint produced a single revoked receipt and cleared its credentials. Chrome's real push provider accepted one delivery, and the browser displayed the generic reminder with the app page closed. The invalid-endpoint test account was removed and absence verified. The phone fixture is already due. Its disposable credentials are in the ignored local trial file. Real iPhone delivery and iOS permission revocation remain open.

The 21:00 UTC schedule reevaluated the desktop device and preserved one receipt with one attempt. Hosted Chrome's in-app opt-out removed its actual browser subscription. The temporary desktop fixture and credential file were removed. The private five-minute schedule remains active for the disposable iPhone test, after which the trial bypass and account can be cleaned up.

## Phase 4 iPhone acceptance and trial closure — November 22, 2026

The user reports the scheduled reminder arrived with the Home Screen app closed and tapping it opened the app at sign-in. The user then turned off notification permission. Those are user-observed device results. The real hosted receipt records one send at 21:05 UTC, and an independent post-opt-out check found the endpoint and encryption keys cleared. A fresh authenticated job returned zero checked devices and zero sends. The single sent receipt remained the only receipt before cleanup. Chrome and scheduled-run acceptance are recorded above.

The Cloudflare trial has zero schedules and zero secret bindings. The Worker retains disabled public and preview URLs. The Vercel automation credential was revoked and an HTTP check confirmed that both stale-credential and anonymous requests hit Deployment Protection. The disposable phone account and local credentials were removed. A hosted check found zero trial accounts, device rows and delivery rows. Phase 4 is accepted on the protected Preview. VoiceOver remains open for private release.
