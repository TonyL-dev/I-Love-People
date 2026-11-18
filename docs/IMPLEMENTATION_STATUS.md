# Implementation status

Updated November 17, 2026. Phase 0 is in progress. The user approved beginning development from the reviewed interactive mockup.

| Phase | State |
| --- | --- |
| 0 Foundation | Local foundation and database/Auth checks passed; networking and hosted gates pending |
| 1 Login and privacy | Planned |
| 2 People and meetups | Planned |
| 3 Due list | Planned |
| 4 PWA and Web Push | Planned, scheduler feasibility pending |
| 5 Personal release | Planned |
| 6 Enhancements | Backlog |

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

The checked-in CI workflow has not run on GitHub. Windows local results do not establish Linux CI, Vercel behavior, or real-device acceptance.

## Docker follow-up — November 17, 2026

The earlier missing-runtime blocker is resolved. Startup, stop/restart, real migration/readiness checks, and the captured-mail recovery drill passed. Local credentials were read from captured CLI status in process memory; passwords and reset links were not written to files or printed. The default `check` command still excludes container integration; use `db-check` explicitly or the new CI database job. UI code did not change in this follow-up, so the earlier browser results were not needlessly rerun.

The per-project `ilp-local` Docker network requests `com.docker.network.bridge.host_binding_ipv4=127.0.0.1`. Inspection confirmed that option and container network membership, but Docker Desktop's effective published-port metadata still showed 0.0.0.0 and IPv6 all-interface mappings. Effective loopback isolation is therefore not claimed. The stack was stopped after checks, retaining local database volumes. No global Docker settings were changed and no personal records were used.

## Outstanding acceptance gates

1. **Local networking:** resolve the measured all-interface published-port mappings before using personal data; requested loopback network options alone were insufficient evidence. The original missing-Docker blocker, baseline migration, database-backed readiness, two-user Auth smoke, captured recovery-link journey, and cleanup are now verified. Application RLS, owner isolation, and API session-revocation enforcement still belong to Phase 1 once its private tables/endpoints exist.
2. **Hosted:** configure an isolated synthetic preview environment and trusted deployment credentials, run hosted CI, then verify Python dependencies, asset delivery, SPA deep links, API routing, HTTPS, security headers, and database connectivity. No provider accounts/projects, hosted credentials, or deployment were created.
3. **Device/accessibility:** actual iPhone Safari, safe areas/software keyboard, VoiceOver or another screen reader, complete keyboard/focus-state coverage, real browser zoom, and hover/pressed/disabled contrast review remain pending. Automated axe and 200% text enlargement are partial evidence only.
4. **Later phases:** managed authentication, private persistence, RLS/authorization, production reminder calculations, real export/restore, and push scheduling/delivery remain unimplemented. Do not advance phases while Phase 0 gates are unmet.

## Planning history and provenance

The initial November 17 sessions established the web roadmap, managed Supabase authentication, ownership rules, hosting assumptions, acceptance gates, design standards, and documentation organization. Active documents were moved into `docs/`; imported source-project documents remain in `docs/reference/` as historical material. Their implementation claims and test counts do not apply here.

The conversation mockup and [INTERACTION_SPEC.md](INTERACTION_SPEC.md) preceded source implementation and remain the approved design direction. The mockup's simulated account, push, and backup interactions do not establish application functionality. The repository component reference and its tests are separate from that conversation artifact.

See [README.md](../README.md) for reproducible commands and [PROJECT.md](PROJECT.md) for ordered phase gates.
