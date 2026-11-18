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

Use the pinned CLI through a local-services adapter that detects standard Windows Docker paths and captures credential-bearing CLI output. `db-check` reads local status in memory and exercises the real foundation without a credential file. The two-user recovery drill uses only local Auth/mail APIs and removes its temporary users/messages. An additional credential-free CI database job runs the same sequence; GitHub execution remains unverified.

Request loopback binding through a per-project Docker network following [Supabase local-development guidance](https://supabase.com/docs/guides/local-development). Do not change global Docker settings for a project concern. The installed Docker Desktop still reported all-interface published ports with that option set. Stop services at handoff, use only synthetic data, and retain effective binding as an outstanding check before personal-data use. Requested configuration is not measured network isolation.
