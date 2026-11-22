# Workflow and skills notes

Updated November 22, 2026. Imported notes are retained in reference/SKILLS.md.

Initial planning adapted documentation and reviewed official provider sources. Subsequent interface planning and Phase 0 work are recorded below; current evidence is in IMPLEMENTATION_STATUS.md.

## Planned implementation workflow

Follow [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) for interface, code, and documentation quality. The November 17 design session consulted Apple's typography, color, layout, and accessibility guidance. The chosen web tokens are project proposals. Use automated contrast checks and real browser visual review once components exist. No specialist skill was needed for this specification-only work.

1. Read the active project, architecture, decisions, implementation status, and product guidelines.
2. Follow the ordered phase acceptance gates in PROJECT.md.
3. Use the locked Python/Node environments and established `scripts/tasks.py` runner. `check`, `api`, `web`, `contracts`, `browser`, and local database tasks are implemented; README.md identifies the working directory and tool requirements. Database tasks still require Docker.
4. Generate OpenAPI schema and TypeScript types when API contracts change. Keep database migrations explicit and test RLS with distinct synthetic owners.
5. Run meaningful checks for changed behavior. Exercise actual login recovery, hosted routing, and real iPhone push in their respective phases.
6. Record local, hosted CI, hosted smoke, and physical-device evidence separately. Keep the session documents aligned and preserve the original references.

Documentation links and preserved-reference hashes were checked in this planning session. Free-hosting terms and quotas need another review before deployment. The imported source project's test counts, local executable paths, service state, and completed phases carry no validation for I Love People.


Documentation organization, November 17, 2026. Use README.md in this folder as the index and ../AGENTS.md for repository instructions. Check relative links against each document directory after moves. No specialized skill was required.

Interface planning, November 17, 2026. Used the visualize skill to create the conversation's synthetic interactive product mockup, following its product-specific styling guidance and the repository's DESIGN_STANDARDS.md. Detailed flows are in [INTERACTION_SPEC.md](INTERACTION_SPEC.md). Browser-preview tooling is isolated to the chat visualization directory; it is not the project's Phase 0 toolchain or check runner. Hosted services and application checks remain pending.

Foundation implementation, November 17, 2026. Used the Sites skill's existing-checkout/local-preview workflow, retaining the repository's React/TypeScript, Python, Vercel, and Supabase choices. No Sites registration or publication was performed. The repository now has its own locked toolchain and Playwright/axe browser suite, separate from the earlier conversation mockup. Local synthetic tests and visual evidence are recorded in IMPLEMENTATION_STATUS.md. No subagents were used. Phase 0's database and hosted gates remain outstanding.

Docker verification, November 17, 2026. Used the installed Docker CLI and pinned project Supabase CLI directly; no specialized skill or subagent was needed. Real local migration/readiness/Auth/recovery checks passed. Credentials, passwords and reset links stayed in process memory and out of tool output. Added `db-check`, CLI-output redaction tests, and a credential-free database CI job. Hosted execution and effective host-port binding remain separate checks. See IMPLEMENTATION_STATUS.md for observed results.

## Hosted-gate follow-up — November 17, 2026

Used Plugin Management to discover GitHub, Vercel, and Supabase integrations; none was connected during this check. Consulted Computer Use for existing browser access, but the native Chrome window exposed no accessibility state. Local source checks were rerun and a mock-tested read-only hosted smoke command was added. No subagents or hosted deployment were used. The user chose to finish Phase 0 hosted gates before starting Phase 1; provider access remains required.

GitHub connection follow-up, November 17, 2026. Used the newly connected GitHub integration to inspect the workflow run, job steps, and logs. Verified successful Linux source/browser and container database/Auth CI for `34305ba`. Existing provider connection requests remain pending for Vercel/Supabase; no duplicate plugin suggestions were made. No source/UI behavior changed in this follow-up.

Supabase provisioning follow-up, November 17, 2026. Applied the Supabase skill, checked its current changelog and relevant documentation, and used connected tools to provision the user-approved $0 synthetic preview. Verified ACTIVE_HEALTHY, SELECT 1, empty application schemas, and no security advisor lints. Consulted Vercel bootstrap/deployment guidance; Smooshy scope access returned 403 and its prescribed team-consent link was provided. No secrets were retrieved and no schema changes or deployments ran. After reported Vercel approval, retried the explicitly scoped project request: it still returned 403. Verified the account is authenticated on Hobby and issued the tool-prescribed fresh consent link rather than reconnecting or changing scopes.

Vercel preview follow-up, November 17, 2026. After successful scope consent, used the deployment and protected-access skills with authenticated Vercel tools. Discovered the existing project/deployment, inspected environment-variable names only (none configured), aligned Node 24, and deployed the CI-passed commit to Preview. Protected HTTP checks passed except expected database readiness 503. Consulted the environment-variable skill; requested the missing database URL through an ignored local file rather than chat. No secrets were retrieved and no application schema changes ran.

Hosted connection follow-up, November 18, 2026. The supplied direct preview URL passed format/project/SSL validation but its hostname failed local DNS resolution (11001). Alembic did not reach the database and no Vercel secret was configured. Requested the full Session pooler URI in ignored `.env.preview`; credentials were not printed. Existing architecture and phase sequencing are unchanged; hosted readiness remains pending.

Hosted database verification, November 18, 2026. Used the Supabase, Vercel deployment, environment-variable, and protected-access workflows already consulted in this session. Validated the Session pooler setting without logging it, ran captured Alembic upgrades twice, checked version/metadata isolation, and checked security advisors (no lints). Passed the credential directly to the sensitive Preview variable without displaying tool response values. Verified the rebuilt deployment through authenticated HTTP fetch, including 200 database readiness. Confirmed the ignored credential file and absence of its URL/password from local built assets. No subagents or UI changes were involved.

## Local isolation and review workflow — November 18, 2026

Applied the Supabase workflow already read in this session and consulted Docker’s binding documentation, the exact pinned Supabase CLI source, and distlib’s script-launcher API. Added a dev-only native Docker adapter, strict port verification, security/regression tests, and repeatable local startup checks. All provider/credential output remains captured or withheld. Added desktop interaction-state contrast/modal-keyboard checks and the human DEVICE_REVIEW.md checklist. No subagents or computer-use automation were needed for these changes; real iPhone/VoiceOver evidence must come from the user.

Device evidence and sequencing, November 18, 2026. November 18, 2026: user-reported pass on iPhone 16 Pro, iOS 27.2, for all non-VoiceOver steps in DEVICE_REVIEW.md. VoiceOver was explicitly not tested. This is user-reported device evidence, not an agent-observed session. The written Phase 0 acceptance (reproducible local foundation, passing checks, recorded hosted smoke) is satisfied; device Safari review is additionally reported passed. VoiceOver is carried as an unverified pre-release accessibility check under DESIGN_STANDARDS.md, not silently marked passed. Earlier statements treating VoiceOver as a prerequisite for Phase 1 were too strict. Phase 1 implementation now begins under the original user request.

## Phase 1 workflow — November 18, 2026

Applied Supabase managed Auth and Postgres guidance, including caller-scoped RLS and private session functions; applied Vercel React review guidance to account components. Sites guidance was used for the existing local source workflow while retaining the chosen Vercel stack. No agent delegation was used.

Separate evidence: source checks (53 Python/7 frontend tests), 30 synthetic/mocked browser checks, real local managed-Auth browser recovery and real two-user API/Data API isolation/revocation passed. Credentials and recovery links stayed out of logs/artifacts. Provider setup and owner-email testing require user participation through docs/AUTH_SETUP.md; hosted Phase 1 has not been accepted.

Phase 1 handoff, November 18: local review branch `codex/phase-1-login-privacy` is not published. The connected GitHub integration rejected tree publication with HTTP 403 (Resource not accessible by integration), so current-source hosted CI is pending. Supabase setup and owner-email recovery in AUTH_SETUP.md remain required. Local verification passed; hosted Phase 1 acceptance is not claimed.

Hosted follow-up, November 18: Supabase docs/changelog and security advisors checked. Modern secret keys are sent only in the server-side apikey header. The bounded hosted smoke passed on actual Auth/Data API plus local ASGI, cleaned up disposable users and verified password rules. Full source checks pass with 55 Python/7 frontend tests. Plugin-management discovery confirms GitHub is installed, but its write endpoint still returns provider 403; no app permissions were changed. Hosted deployment and owner-email verification remain pending.

GitHub follow-up, November 18: user reconnection restored connector writes; a tree-write probe passed. Publishing the review branch and verifying CI/Preview are in progress. No Phase 1 acceptance is inferred before those and owner-email recovery pass.

Protected Preview integration, November 18: commit c031afa passed GitHub CI run 44340365242, including both Linux jobs. Live smoke found an injected Vercel feedback script; Preview Feedback was disabled and the same source rebuilt. HTTP/deployed two-user API/RLS checks then passed, but browser login exposed that credentials=omit blocked the hosting protection cookie. Same-origin API/config/health requests now retain only same-origin cookies; cross-origin Supabase requests continue to omit cookies. Application authentication still requires the verified bearer token. A protected-cookie browser regression passes locally. The fix is being published and reverified; earlier Preview URLs are not the final recovery target. Owner-email recovery and device evidence remain pending.

Final hosted verification, November 18: used authenticated Vercel tools and a temporary expiring share link without weakening Deployment Protection. Scoped protection access only to the verified Preview origin; Supabase admin requests stayed on the known provider. The ignored HTTPS review harness reused source smoke/ownership checks and drove real Chrome with credentials passed through stdin. HTTP/deployed API/RLS/browser checks pass; temporary users and access-token file were removed. CI 44341998540 passes for e60a47f with 31 browser tests. Real owner-email recovery and iPhone account-screen review await user evidence.

Phase 1 closure, November 18: used the existing managed-Auth/Playwright workflow for a disposable hosted recovery link generated administratively without sending email. Actual redirect, password replacement, old-password and used-link rejection passed; temporary user and protection-token storage were removed. Owner inbox delivery and iPhone screen/keyboard results are separately user-reported. Only documentation changes follow this verification; no implementation tests were added or needlessly repeated. VoiceOver stays unverified for release.


## Phase 2 workflow — November 18, 2026

Read Supabase skill, current changelog and RLS documentation. Retained Alembic migrations as explicitly required by repository instructions. Applied React review guidance and the full-flow verification workflow to browser → Python API → local Data API/Postgres → UI persistence. No delegated agents, new dependencies, telemetry or provider changes. Playwright uses installed Chrome via ILP_BROWSER_EXECUTABLE on this host. Local and hosted evidence remain separate.

Final Phase 2 local verification: source/build checks, 33 browser regressions, real local two-user API/RLS/concurrent-retry checks and live browser persistence/recovery/cleanup pass. Used local image inspection for representative phone, desktop dialog and 200% text screenshots. Hosted and real-device evidence is not inferred.


Phase 2 rollout: used Vercel deployment/protected-access and Supabase workflows, connector Git tree/commit/branch/PR tools and GitHub Linux CI. Current-source publication is review-only. Consulted official PostgREST custom-error documentation after isolating hosted conflict timeouts. Browser inventory was inspected; no native security setting was changed. Auth URL configuration is not exposed by the connected Supabase tools.


Phase 2 hosted completion: authenticated Vercel fetch plus a temporary expiring share link supported the HTTP/API/browser review for CI-passed d377735. The new migration, explicit conflicts, concurrent retries, forced RLS, browser persistence/logout/expiry and cleanup pass. Final SQL confirms zero synthetic users. Temporary token storage was removed and local services stopped. The existing leaked-password warning is unchanged. Auth URL configuration and iPhone/VoiceOver evidence remain user-owned outstanding checks.


Phase 2 closure, November 18: reused the previously reviewed Vercel protected-access and managed Supabase/Playwright workflows. The disposable hosted browser recovery passed the new exact origin, replacement-password login and old-password/used-link rejection; account cleanup and temporary token-file removal are verified. Device results and Auth-settings changes are user-reported. This is documentation-only closure; no implementation tests were added or repeated.


## Phase 3 workflow - November 18, 2026

Read the Supabase skill, current changelog and official RLS guidance; retained repository-mandated Alembic ownership. Applied React review and full-flow verification to browser, Python API, caller-scoped Data API/PostgreSQL and confirmed UI state. No subagents or new dependencies. Used pinned tasks and installed Chrome (`ILP_BROWSER_EXECUTABLE`), synthetic users, no credential traces and verified cleanup. Local/hosted/device evidence remains separate in IMPLEMENTATION_STATUS.md.


Phase 3 hosted verification, November 18: used GitHub tree/commit/branch/draft-PR tools and Linux CI, Vercel deployment/protected-access skills and tools, and Supabase Alembic/advisory checks. Deployed HTTP/API/RLS and actual Chrome due/snooze/new-meetup/review/persistence/logout/expiry checks pass for a559aa5. Credentials stayed in the ignored harness/process memory; no test email was sent. Interrupted-harness fixtures were removed, final admin inspection found zero synthetic verification accounts, and the expiring share token was revoked and its local file removed.

Computer Use inventory found only native user browser windows, with no connected dashboard tab. Its Windows guidance explicitly says, "Do not change Windows security settings, Windows privacy settings, or any in-app security or privacy settings." No security UI was changed. The connected Supabase tools do not expose Auth URL configuration, so the final exact Site URL/reset redirect save remains a user step. The existing leaked-password-protection advisory is unchanged; no paid feature was enabled.


## Phase 3 usability follow-up - November 19, 2026

Applied React review guidance to navigation/focus, cancellable reads, notification lifecycle and keyboard/screen-reader semantics. Existing semantic tokens and bundled Lucide icons are reused. Behavioral Playwright checks cover selected state, profile focus/scroll/back with filtered search, delayed success, inline conflicts, repeated toasts, hover/focus timeout and logout cleanup. No subagents, new dependencies or API/schema changes. Real-device feedback and agent browser evidence remain separately attributed.


November 19 final verification: existing task runner, installed Chrome and React/full-flow review covered the new UI locally; GitHub Linux CI passed both jobs. Reused the exact Git-built Vercel Preview and existing protected-access harness for HTTP plus actual synthetic browser navigation/toast/meetup/persistence/logout/expiry checks. No backend reimplementation or migration. Verified synthetic cleanup, revoked temporary share access, removed its local token file, and stopped local services. Inspected phone/detail/toast screenshots, including readable 200% text feedback after widening its narrow-screen layout. No Computer Use or subagents were used in this follow-up.


## Menu and toast follow-up - November 19, 2026

Applied the already-read React review guidance to native-dialog reuse, focus/keyboard behavior, preservation of private component state and inline notification alignment. Updated existing browser/account journeys to reach preferences and logout through Menu. Added behavior and visual checks for hidden-by-default settings, drawer side placement, Escape/backdrop close, background focus exclusion, context restoration, large-text reflow and the icon beside the first text line. No Computer Use, subagents, provider configuration or new dependency was needed. Local/CI/hosted/device evidence remains separate.


Final settings-menu verification: source checks/build, all 36 browser regressions and the real local account/nudge/recovery journey pass. Linux CI passes both jobs for 97e40ea. Reused the protected Git-built Preview and private harness for hosted HTTP, real drawer timezone/appearance/logout, nudge/meetup/persistence/expiry and measured first-line icon alignment. Inspected actual hosted drawer/toast and local light/dark phone/desktop/enlarged screenshots. Verified account cleanup, revoked temporary access and removed its file; local services are stopped. No Computer Use, subagents, provider settings, migrations or new dependencies.


Readiness review, November 19: reused the existing disposable managed-Auth redirect probe for the final pfoktasn6 Preview. The provider falls back to the older kipv1n31u origin, confirming one remaining configuration/recovery gate. No email was sent; temporary account deletion and absence were verified. Recorded the user's UI approval separately from agent-observed evidence. No application code, schema, provider configuration, Computer Use or subagent activity; source/browser suites were not needlessly repeated.


Phase 3 acceptance verification, November 19: reused the disposable managed-Auth recovery workflow and installed Chrome, adapting the private harness to reach preferences/sign-out through Menu. Verified actual final-origin recovery, password replacement, old-password/used-link rejection and account cleanup without email or credential output. Revoked temporary protected access, removed its file and confirmed zero synthetic accounts. Documentation-only closure; full source suites were not repeated. No Computer Use, subagents, schema or provider-setting changes.

## Phase 4 implementation tools - November 19, 2026

Applied Supabase and Postgres guidance to the private schema, limited queries, explicit role revocation and transaction locking. Applied React and verification guidance to the settings drawer, in-memory state, browser permission workflow and production service worker. Used local managed Auth/Postgres with two synthetic accounts and installed desktop Chrome for repeatable verification. PyWebPush 2.5.0 and its transitive dependencies are locked. The notification adapter uses its encryption routine and py-vapid signing.

## Phase 4 hosted trial tools — November 21, 2026

Used GitHub Linux check logs, Vercel protected Preview and branch-scoped sensitive settings, the existing Supabase Preview Session pooler and role checks, and authenticated Wrangler 4.166.0 on the bundled Node 24 runtime. Replaced the Linux CI dependency on native notification display with an assertion at the installed service worker boundary. Reproduced the Cloudflare redirect failure using Workerd's loopback scheduled endpoint and verified that the corrected Worker reaches Vercel and rejects a returned authentication redirect. Used a separate desktop Chrome test against the hosted Preview to exercise the real provider path.

November 22 closure used the existing Wrangler OAuth session, Cloudflare schedules and secret APIs, Vercel protected status checks and metadata-only Supabase queries. Recorded the user's iPhone account separately from independently verified delivery, inactive state, zero-send job invocation and trial cleanup. Documentation-only acceptance update.

## Phase 5 implementation tools — November 22, 2026

Supabase and Postgres guidance informed caller-scoped recovery, role grants, portable identifiers and transactional locking. React and full-flow verification guidance informed the existing drawer's file, conflict, password, error and status controls. Vercel deployment guidance informed the protected migration and staged release sequence. Browser, database, GitHub CI, hosted smoke and device evidence are tracked separately.

Verified the exact CI-passed Preview with short-lived Vercel access, a real Chrome download/upload, and disposable Supabase accounts. Both production dependency audits passed. Verified removal of disposable rows and revoked temporary access. Used no new runtime dependencies.
