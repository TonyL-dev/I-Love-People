# I Love People

A private, responsive place to remember when you last met someone and make time for next time.

Phase 0 is in progress. The React/TypeScript foundation and Python health API run locally. The approved design is implemented as an explicitly synthetic component reference; account authentication and personal-data features are not connected yet.

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

Open [the sample application](http://127.0.0.1:5173/design), [sign-in layout](http://127.0.0.1:5173/), or [component reference](http://127.0.0.1:5173/design/components). The sample uses November 17, 2026 and synthetic people. A sample save stores no record. Sign-in is deliberately unavailable until managed authentication is implemented. Appearance is the only preference saved in browser storage.

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

The Linux workflow is configured in GitHub Actions but has not yet run on GitHub. The Python task runner checks Node/pnpm versions and resolves the portable Windows tools automatically when present.

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

The configuration uses PostgreSQL 17, Auth, the Data API, local Studio on port 54323, and captured mail on port 54324. Public signup and analytics are disabled. Supabase schema migration/seed execution is disabled because Alembic owns application migrations. The baseline contains no personal-data tables and does not modify the managed Auth schema.

The tasks detect standard Windows Docker installation paths and capture CLI credentials without printing them. `db-check` obtains local credentials in process memory, applies the baseline twice, verifies database-backed API readiness and migration-metadata isolation, and runs the two-user Auth/recovery check. No credential file or copied keys are needed. To run only the Auth check:

```powershell
.venv\Scripts\python.exe scripts/local_auth_smoke.py
```

The Auth script generates passwords in memory, verifies two distinct logins, opens the locally captured recovery emails, changes passwords, checks rejection of old passwords and used links, submits logout, verifies blocked signup, and removes its temporary accounts/messages. Application ownership/RLS and session revocation enforcement still belong to Phase 1.

For the standalone API's database readiness outside `db-check`, create a server-only local environment file from `.env.example` if one does not already exist. Then `scripts/tasks.py migrate` applies the baseline using that environment. Preserve any existing local configuration.

`db-start` requests loopback binding through a dedicated `ilp-local` Docker network. The installed Docker Desktop still reported published ports on all interfaces despite this option. Use synthetic data and stop the stack after checks until effective binding is resolved before personal-data use. See the implementation status for this measured limitation.

## Contracts and checks

Run from the repository root using the project's Python interpreter:

```powershell
.venv\Scripts\python.exe scripts/tasks.py contracts
.venv\Scripts\python.exe scripts/tasks.py check
```

Regenerate contracts whenever the API changes. The check task verifies Python formatting/lint/types/tests, contract drift, frontend formatting/lint/types/tests, and a production build. Browser, database integration, hosted CI, deployment smoke, and physical-device evidence are tracked separately.

## Deployment status

`vercel.json` and `api/index.py` prepare the Vite site and Python function for a future Vercel preview. The proposed rewrites keep `/api` separate from SPA deep links. Hosted routing, package installation, HTTPS, security headers and database connectivity have not been verified. No hosted project or deployment has been created. GitHub checks receive no deployment credentials; a trusted deployment job will be added when the preview environment is configured.

## Project documents

See the [documentation index](docs/README.md), [roadmap](docs/PROJECT.md), [design standards](docs/DESIGN_STANDARDS.md), [interaction specification](docs/INTERACTION_SPEC.md), and [verified implementation status](docs/IMPLEMENTATION_STATUS.md). Imported historical documents remain unchanged in `docs/reference/`.
