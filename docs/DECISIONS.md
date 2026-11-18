# Decisions

Updated November 17, 2026. The architecture entries define the selected direction. The foundation decisions below are implemented locally; hosted/provider behavior is still subject to phase acceptance.

| Decision | Rationale and consequence |
| --- | --- |
| Website first | Responsive iPhone Safari and desktop usage, free hosting target, provider subdomains |
| Apple-inspired visual and craft standard | DESIGN_STANDARDS.md defines system typography, semantic light/dark colors, spacing, components, readable code, documentation quality, and review gates from Phase 0 |
| Local Supabase development | Exercise real Auth/PostgreSQL/RLS with synthetic data before hosted setup; retain distinct hosted and device acceptance |
| Retain React/TypeScript and Python | Preserve the user's earlier stack preference with Vite and FastAPI |
| Vercel Hobby plus Supabase Free | Personal non-commercial hosting, managed database and identity, expected $0 monthly within quotas |
| Managed passwords | Supabase Auth stores password hashes and provides login/reset; application tables hold only identity references |
| Owner-only initial release | Provision one account and disable public signup; still validate isolation with two synthetic users |
| In-memory browser sessions | Avoid persistent browser credential storage for the initial release; page reload requires another sign-in |
| Bearer authentication | Browser sends access tokens to the same-origin API, which verifies and checks account/session state |
| RLS plus owner-scoped repositories | Database permissions and API authorization both enforce private records |
| In-app nudges before push | Deliver core value before proving hosted scheduling and real iPhone push |
| Preserve imported documents | Keep originals in reference and adapt active root guidance to this project |

Remaining decisions include the Phase 4 scheduler/runtime, custom SMTP if the audience expands, persistence UX after initial testing, and final free-plan capacity checks. Changing a selected stack or introducing a paid service requires an updated cost rationale and user agreement to any charge.


Documentation organization, November 17, 2026. Keep one active copy of each supporting document in docs/, with root AGENTS.md linking into it. Retain imported source-project originals in reference/ for provenance.

Interface preview, November 17, 2026. Use the existing visual tokens and a responsive navigation rail/single-column layout to explore the Phase 0–5 journeys before implementation. Keep the synthetic mockup outside application source. [INTERACTION_SPEC.md](INTERACTION_SPEC.md) outlines destructive/recovery states and every backlog area while retaining Phase 6 as optional future scope. No runtime, deployment, or security acceptance is inferred from simulated controls.

## Foundation implementation — November 17, 2026

| Decision | Rationale and consequence |
| --- | --- |
| Separate synthetic reference at `/design` | Carry the approved design into real components without exposing personal data or pretending authentication exists; first-release business rules remain in their ordered phases |
| Keep root sign-in unavailable until Phase 1 | Avoid a fake successful login or a browser-only privacy boundary |
| Portable Node 24/pnpm and isolated Python 3.12 | The host had Node 18/Python 3.11; `.tools` and `.venv` supply compatible versions without replacing system installations |
| Pin TypeScript 5.9.3 | Compatible with the installed OpenAPI generator and TypeScript ESLint peers; the newly available TypeScript 7 was outside their declared support |
| Supabase CLI 3.2.0 | Use its generated configuration conventions, including `[local_smtp]`; public signup stays disabled and application migrations belong to Alembic |
| Separate liveness and database readiness | A healthy process must not be presented as proof of a working database or authentication boundary |
| Empty Alembic baseline and isolated version schema | Establish migration mechanics without creating unprotected personal-data tables or managing Auth schema |
| No deploy credentials in checks | Push/PR checks can run without secrets; trusted deployment configuration waits for the actual preview environment |
| Retain Phase 0 as in progress | Local database/Auth and baseline migrations are verified; effective local binding, hosted CI, deployment smoke, and device evidence remain separate gates |

Deployment configuration follows the candidate [Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite) and [Python/FastAPI support](https://vercel.com/docs/frameworks/backend/fastapi). Supabase local configuration was checked against its [CLI configuration](https://supabase.com/docs/guides/local-development/cli/config) and [v3 migration guidance](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3). These references informed configuration; a real hosted smoke test is still required.

## Docker verification — November 17, 2026

Use the pinned CLI through a local-services adapter that detects standard Windows Docker paths and captures credential-bearing CLI output. `db-check` reads local status in memory and exercises the real foundation without a credential file. The two-user recovery drill uses only local Auth/mail APIs and removes its temporary users/messages. An additional credential-free CI database job runs the same sequence; [GitHub execution](https://github.com/TonyL-dev/I-Love-People/actions/runs/44232670563) is now verified for commit `34305ba`; preview deployment remains pending.

Request loopback binding through a per-project Docker network following [Supabase local-development guidance](https://supabase.com/docs/guides/local-development). Do not change global Docker settings for a project concern. The installed Docker Desktop still reported all-interface published ports with that option set. Stop services at handoff, use only synthetic data, and retain effective binding as an outstanding check before personal-data use. Requested configuration is not measured network isolation.

## Hosted gates before Phase 1 — November 17, 2026

The user confirmed that Phase 0 hosted gates should be finished first. Keep Phase 1 unstarted. Add a read-only, credential-free HTTPS preview checker rather than infer deployment success from a local build. Use provider-managed connections and trusted secret settings for deployment access; do not copy credentials into chat or source. Manual checks workflow dispatch supports reruns after the updated workflow reaches GitHub. Hosted execution is still pending access.

## Synthetic hosted preview resource — November 17, 2026

The user selected Smooshy and Canada Central with a strict $0 cost limit. Supabase quoted $0/month before `i-love-people-preview` was created. Keep this resource synthetic and separate from any eventual personal-data release. Do not infer hosted Auth configuration from the local config file or infer Vercel connectivity from a control-plane SQL probe. Preserve Alembic as application migration owner. A reported Vercel approval does not establish team access: retain the gate until a scoped API request succeeds.

## Existing Vercel project and protected preview — November 17, 2026

Reuse the discovered `i-love-people` project in Smooshy and align its Node setting to 24.x. Deploy the exact CI-passed commit as a Preview; do not promote or alter the existing production deployment. Keep Deployment Protection enabled and verify through authenticated Vercel fetch. Only the Preview environment will receive the synthetic database URL once supplied securely. A READY build and healthy Python liveness do not satisfy database readiness.

Hosted connection follow-up, November 18, 2026. The supplied direct preview URL passed format/project/SSL validation but its hostname failed local DNS resolution (11001). Alembic did not reach the database and no Vercel secret was configured. Requested the full Session pooler URI in ignored `.env.preview`; credentials were not printed. Existing architecture and phase sequencing are unchanged; hosted readiness remains pending.

## Session pooler and Preview-only secret — November 18, 2026

Use the user-supplied Session pooler URI with SSL for the synthetic foundation checks after the direct endpoint failed local DNS resolution. Alembic applied the hosted baseline, rather than SQL-tool migration history. Store the connection setting as a sensitive Preview-only Vercel variable and rebuild the exact CI-passed commit. Keep the existing Production deployment and environment untouched. Hosted HTTP acceptance is now evidenced; local network isolation and device review are still tracked independently.

## Explicit local Docker binding — November 18, 2026

Docker Desktop 29.9.3 ignored `host_binding_ipv4` even on the intended project network. The pinned [Supabase 3.2.0 create-argument builder](https://github.com/supabase/cli/blob/v3.2.0/apps/cli/src/command-internal/db-bootstrap/docker-create-args.ts) delegates to Docker’s CLI with host-port mappings but no host address. Use a narrow project-only launcher to supply explicit IPv4 loopback bindings before creation, following [Docker’s explicit address syntax](https://docs.docker.com/engine/network/port-publishing/). This preserves managed local Auth and the pinned stack without replacing the runtime, patching vendor binaries, or changing global engine settings.

Pin distlib 0.4.4 as a development-only dependency for its [native script launcher](https://distlib.readthedocs.io/en/stable/tutorial.html#using-the-scripts-api), which safely forwards Windows argument arrays without a batch-shell layer. Keep the launcher generated/ignored. Reject unsupported creation options and foreign published-container targets. Verify effective port mappings after startup and before credential reads; stop the stack if startup verification fails. Tests and actual Docker/Windows listener observations support local isolation; physical-device review remains separate.

Device evidence and sequencing, November 18, 2026. November 18, 2026: user-reported pass on iPhone 16 Pro, iOS 27.2, for all non-VoiceOver steps in DEVICE_REVIEW.md. VoiceOver was explicitly not tested. This is user-reported device evidence, not an agent-observed session. The written Phase 0 acceptance (reproducible local foundation, passing checks, recorded hosted smoke) is satisfied; device Safari review is additionally reported passed. VoiceOver is carried as an unverified pre-release accessibility check under DESIGN_STANDARDS.md, not silently marked passed. Earlier statements treating VoiceOver as a prerequisite for Phase 1 were too strict. Phase 1 implementation now begins under the original user request.

## Phase 1 decisions — November 18, 2026

Use a small typed managed-Auth REST client without a new JavaScript SDK dependency. Retain access tokens only in memory, discard refresh tokens and strip implicit recovery fragments before rendering. Require fresh sign-in on reload. Provider errors remain generic and requests bounded. Supabase alone verifies/stores passwords.

JWT signatures cannot reflect immediate logout. Protected APIs check managed identity and live session/account state. A private, narrowly granted no-argument SQL function enforces the same rule in RLS using caller context and empty search path. Auth schemas remain provider-owned and read-only to application code. Profile data uses caller-scoped Data API access; timezone validity is enforced in Python and a database constraint.

Written Phase 0 foundation acceptance is met. The user declined VoiceOver testing, so that evidence remains open before private release. Hosted Phase 1 acceptance requires actual provider configuration, isolation/revocation tests and owner-email recovery; local or mocked browser passes cannot substitute.

Phase 1 handoff, November 18: local review branch `codex/phase-1-login-privacy` is not published. The connected GitHub integration rejected tree publication with HTTP 403 (Resource not accessible by integration), so current-source hosted CI is pending. Supabase setup and owner-email recovery in AUTH_SETUP.md remain required. Local verification passed; hosted Phase 1 acceptance is not claimed.

Hosted JWT clock tolerance, November 18: provider tokens were observed two seconds ahead of this machine. Permit five seconds of registered-claim clock skew, with tests accepting that small difference and rejecting larger future issuance/expired tokens. Signature, issuer, audience and live-session validation remain required. Hosted Auth/Data API tests use disposable accounts only, with no external email. Preview migrations/public settings may be verified independently while CI/deployed API and real inbox evidence remain explicit acceptance gates.

GitHub follow-up, November 18: user reconnection restored connector writes; a tree-write probe passed. Publishing the review branch and verifying CI/Preview are in progress. No Phase 1 acceptance is inferred before those and owner-email recovery pass.

Protected Preview integration, November 18: commit c031afa passed GitHub CI run 44340365242, including both Linux jobs. Live smoke found an injected Vercel feedback script; Preview Feedback was disabled and the same source rebuilt. HTTP/deployed two-user API/RLS checks then passed, but browser login exposed that credentials=omit blocked the hosting protection cookie. Same-origin API/config/health requests now retain only same-origin cookies; cross-origin Supabase requests continue to omit cookies. Application authentication still requires the verified bearer token. A protected-cookie browser regression passes locally. The fix is being published and reverified; earlier Preview URLs are not the final recovery target. Owner-email recovery and device evidence remain pending.

Protected Preview browser requests, November 18: retain same-origin hosting protection cookies for API/config/health fetches while omitting cookies on cross-origin Auth calls. Cookies do not authenticate application data; verified bearer identity remains mandatory. A browser regression reproduces protected-cookie access without provider-cookie forwarding, and the real protected deployment passes. Disable Vercel Preview Feedback to keep external feedback scripts out of the app. Keep the PR draft and Production unchanged until owner-email recovery and outstanding release evidence are resolved.

Phase 1 acceptance, November 18: combine independently observed hosted security/recovery checks with explicitly user-reported owner inbox and iPhone evidence. Record actual configured rate limits without enabling SMS, anonymous or Web3 sign-in. Phase 1 acceptance does not imply Production release, merge, completion of VoiceOver review or authorization to start Phase 2.
