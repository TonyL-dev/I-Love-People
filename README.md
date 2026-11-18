# I Love People

A private, responsive place to remember when you last met someone and make time for next time.

Phase 0 is accepted. Phase 1 login, recovery, memory-only sessions, and an owned timezone preference are implemented and verified locally with managed Supabase Auth. Phase 1 is accepted: hosted CI, protected Preview API/browser/recovery checks and user-reported owner email/iPhone journeys pass; see [setup steps](docs/AUTH_SETUP.md). Phase 2 people and meetup history are accepted on the protected Preview; Phase 3 remains planned. The `/design` reference remains explicitly synthetic.

## Start locally on Windows

Run these commands from the repository root in PowerShell. The bootstrap needs an existing Python/pip and npm installation; it installs project-local Node 24/pnpm 11.19.0 and an isolated Python 3.12 environment without replacing system installations.

```powershell
.\scripts\bootstrap.ps1
.venv\Scripts\python.exe scripts/tasks.py check
```

Use two terminals, both at the repository root:

```powershell
# Terminal 1: Python API
.venv\Scripts\python.exe scripts/tasks.py api
```

```powershell
# Terminal 2: React development server
.venv\Scripts\python.exe scripts/tasks.py web
```

Open [the sample application](http://127.0.0.1:5173/design), [sign-in layout](http://127.0.0.1:5173/), or [component reference](http://127.0.0.1:5173/design/components). The sample uses November 17, 2026 and synthetic people. A sample save stores no record. The plain `api` command leaves sign-in unavailable unless Auth settings are supplied. For real local authentication, start Supabase and run `db-check`, then replace Terminal 1's command with `scripts/tasks.py api-local`. Appearance is the only preference saved in browser storage; auth tokens and account drafts stay in tab memory.

The website proxies `/api` to Python on port 8000. [Liveness](http://127.0.0.1:5173/api/health) proves the API is responding. `/api/ready` additionally requires a working PostgreSQL connection and returns a generic 503 otherwise.

## Other environments

With Node 24, pnpm 11.19.0, uv 0.13.9, and Python 3.12+ available, run from the repository root:

```sh
uv sync --locked
pnpm install --frozen-lockfile
uv run --locked python scripts/tasks.py check
uv run --locked python scripts/tasks.py api
# In a separate terminal:
uv run --locked python scripts/tasks.py web
```

The Linux [Checks workflow](https://github.com/TonyL-dev/I-Love-People/actions/runs/44232670563) passed for commit `34305ba`, including source/browser checks and Docker-backed database/Auth checks. The new hosted-smoke tooling is locally verified but not yet pushed. The Python task runner checks Node/pnpm versions and resolves the portable Windows tools automatically when present.

## Browser checks

From the repository root, with the toolchain on PATH:

```sh
pnpm exec playwright install chromium
pnpm test:browser
```

On this Windows setup, an installed Chrome can be used without downloading another browser:

```powershell
$env:ILP_BROWSER_EXECUTABLE = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
.venv\Scripts\python.exe scripts/tasks.py browser
```

The suite starts Vite if it is not already running. It checks four viewport widths in both appearances, accessibility rules, navigation/deep links, draft handling, and state recovery. Screenshots go to the ignored `artifacts/local/` directory. These results do not replace VoiceOver or a real iPhone review.

## Local Supabase

Docker Desktop is installed and the local database/Auth checks have passed on this machine. Start its engine before running these commands from the repository root:

```powershell
.venv\Scripts\python.exe scripts/tasks.py db-start
.venv\Scripts\python.exe scripts/tasks.py db-check
# Stop services when finished; local database volumes are retained:
.venv\Scripts\python.exe scripts/tasks.py db-stop
```

The configuration uses PostgreSQL 17, Auth, the Data API, local Studio on port 54323, and captured mail on port 54324. Public signup and analytics are disabled. Supabase schema migration/seed execution is disabled because Alembic owns application migrations. Application migrations add an owner-scoped timezone profile with RLS; Alembic never modifies managed Auth tables.

The tasks detect standard Windows Docker installation paths and capture CLI credentials without printing them. `db-check` obtains local credentials in process memory, applies the baseline twice, verifies database-backed API readiness and migration-metadata isolation, and runs the two-user Auth/recovery check. No credential file or copied keys are needed. To run only the Auth check:

```powershell
.venv\Scripts\python.exe scripts/local_auth_smoke.py
```

The Auth script generates passwords in memory, verifies two distinct logins, opens the locally captured recovery emails, changes passwords, checks rejection of old passwords and used links, submits logout, verifies blocked signup, and removes its temporary accounts/messages. `db-check` additionally verifies API JWT validation, two-user API/Data API ownership, direct-write timezone constraints, logout revocation, and disabled-account rejection.

For the standalone API's database readiness outside `db-check`, create a server-only local environment file from `.env.example` if one does not already exist. Then `scripts/tasks.py migrate` applies the baseline using that environment. Preserve any existing local configuration.

`db-start` publishes the API (54321), PostgreSQL (54322), Studio (54323), and captured mail (54324) explicitly on `127.0.0.1`. A project-scoped Docker launcher supplies these addresses before container creation because Docker Desktop ignored the network default. Startup and local credential reads verify the effective bindings; startup stops the stack if verification fails. The launcher is generated under ignored `.tools/docker-loopback` using the locked development dependency `distlib`. It affects only the Supabase subprocess environment and does not change global Docker, PATH, or firewall settings. Keep development data synthetic and stop services after checks.

## Contracts and checks

Run from the repository root using the project's Python interpreter:

```powershell
.venv\Scripts\python.exe scripts/tasks.py contracts
.venv\Scripts\python.exe scripts/tasks.py check
```

Regenerate contracts whenever the API changes. The check task verifies Python formatting/lint/types/tests, contract drift, frontend formatting/lint/types/tests, and a production build. Browser, database integration, hosted CI, deployment smoke, and physical-device evidence are tracked separately.

## Deployment status

[Phase 1 Preview](https://i-love-people-o73m6xnlh-smooshy.vercel.app) is READY for `e60a47f`, with [both Linux CI jobs passing](https://github.com/TonyL-dev/I-Love-People/actions/runs/44341998540). Protected HTTPS/assets/SPA/API routing, database readiness, headers/no-store, deployed two-user API/RLS/revocation and live browser account checks pass. Alembic is at `0003_profile_timezone`; credentials and public Auth settings are Preview-only. Deployment Protection remains enabled and Preview Feedback is disabled. Owner-email recovery and account-screen device review passed by user report; provider limits are recorded. VoiceOver remains unverified before release. [Draft PR #1](https://github.com/TonyL-dev/I-Love-People/pull/1) is open; Production was not promoted.

## Project documents

See the [documentation index](docs/README.md), [roadmap](docs/PROJECT.md), [design standards](docs/DESIGN_STANDARDS.md), [interaction specification](docs/INTERACTION_SPEC.md), and [verified implementation status](docs/IMPLEMENTATION_STATUS.md). Imported historical documents remain unchanged in `docs/reference/`.

## Hosted Phase 0 smoke

After the checks workflow succeeds on GitHub, configure an isolated synthetic Vercel preview and Supabase database. Keep `ILP_DATABASE_URL` in the preview project’s server-only secret settings. Apply the foundation migration with a trusted server-side environment before checking readiness. Never use a production database for this preview.

Run from the repository root with the locked development dependencies installed:

```powershell
$env:ILP_PREVIEW_URL = 'https://your-preview.vercel.app'
.venv/Scripts/python.exe scripts/tasks.py hosted-smoke
```

The command verifies HTTPS, baseline headers, built assets, SPA deep links, Python health/readiness, no-store, and unknown API routing. Redirects and deployment login pages fail the check. Use an accessible synthetic preview; do not put bypass secrets in the URL. Record the tested commit, deployment URL, GitHub run URL, time, and output in `docs/IMPLEMENTATION_STATUS.md`. The script’s mock tests are tooling evidence only. Browser/device review and local network binding remain separate evidence. The Checks workflow also supports manual dispatch after this revision is pushed.

## Real iPhone review

Follow [the Phase 0 device checklist](docs/DEVICE_REVIEW.md) in iPhone Safari. It covers light/dark appearance, rotation, Page Zoom, software keyboard, safe areas, and VoiceOver. Send back the iPhone model, iOS version, and the exact steps that passed or failed. The Phase 0 hosted reference remains synthetic; its app sign-in is unavailable.

## Real local account journey

With Supabase running and migrations applied, run:

```powershell
.venv/Scripts/python.exe scripts/tasks.py browser-auth
```

This starts temporary API/Vite servers if needed and tests actual login, preference persistence, reload, logout, captured-mail recovery, and replacement-password login. Disposable credentials travel through process memory/stdin; no credential-bearing traces or screenshots are recorded. Accounts/mail and owned servers are cleaned up. Use local Studio to provision a separate synthetic account for manual development and captured mail for recovery links.

The reported Phase 0 iPhone 16 Pro / iOS 27.2 review passed the non-VoiceOver steps. VoiceOver and the new Phase 1 account screens still need device evidence before private release.

## Hosted account regression

`scripts/hosted_auth_smoke.py` is restricted to the authorized synthetic Preview project. It reads the ignored database/admin settings and a public `ILP_SUPABASE_PUBLISHABLE_KEY` environment variable. Its optional `--migrate` applies Alembic before running. Actual hosted Auth/Data API and current local ASGI checks pass; it never sends external mail and removes its temporary users. This does not verify a deployed Vercel API or the owner inbox. See [current evidence](docs/IMPLEMENTATION_STATUS.md).

Phase 1 acceptance is recorded in docs/IMPLEMENTATION_STATUS.md. The application remains on the protected Preview; Phase 2 has not started and Production was not promoted.

## Phase 2 local people and history

After `db-start` and `db-check`, run the local API and web tasks as above and sign in with a disposable development account. The private screen supports people, archive/restore, priorities/cadence and meetup history. Local schema upgrades now include Alembic `0004_people_meetups`. `db-check` also checks two-user people/meetup isolation, retries and revision conflicts; `browser-auth` exercises actual persistence across a fresh sign-in and saves synthetic responsive screenshots. On this Windows host set `ILP_BROWSER_EXECUTABLE` to the installed Chrome executable for browser checks. Hosted Phase 2 migration/deployment and real iPhone checks remain pending.

Phase 2 protected Preview: [https://i-love-people-c2mef0l08-smooshy.vercel.app](https://i-love-people-c2mef0l08-smooshy.vercel.app) for CI-passed d377735 ([run](https://github.com/TonyL-dev/I-Love-People/actions/runs/44398237798)). Deployed API/RLS/conflict and real browser persistence checks pass; schema is at Alembic 0005. The new exact Auth redirect setting and iPhone people/history review are pending. [Draft PR #2](https://github.com/TonyL-dev/I-Love-People/pull/2) builds on Phase 1 without a merge or Production promotion.

Phase 2 is accepted on [https://i-love-people-c2mef0l08-smooshy.vercel.app](https://i-love-people-c2mef0l08-smooshy.vercel.app) for application d377735. The user reports all requested iPhone Safari and desktop checks pass without screen/keyboard/functional problems; the new Auth redirect and disposable hosted recovery are independently verified. Phase 3 remains planned. VoiceOver remains untested before private release; Production is unchanged.

### Phase 3 development

The private library now opens Catch up and includes People and Weekly review. Set an explicit cadence and log a completed meetup to establish a due date. Profiles provide snooze-until, dismiss-for-today, pause/unpause and cadence editing through Edit person. Nudges appear in the website; external delivery is Phase 4. Alembic head is `0006_in_app_nudges`. Existing `check`, `db-check` and `browser-auth` tasks cover calendar rules, durable preferences, owner isolation and the real Maya due/snooze/new-meetup journey. See [implementation status](docs/IMPLEMENTATION_STATUS.md) for separate local, hosted and device evidence.
