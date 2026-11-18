# Repository instructions for I Love People

Updated November 17, 2026. Read docs/PROJECT.md, docs/IMPLEMENTATION_STATUS.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, and docs/PROJECT_GUIDELINES.md before changes.

This project is a private responsive website with a $0 monthly hosting target. The active roadmap is in docs/PROJECT.md. Implement phases in order when requested. Phase 0 implementation is in progress; local source and database/Auth checks pass, with hosted gates still pending. Imported resume-project files are preserved in docs/reference as historical reference material. Their implementation claims and commands do not establish this project's state.

Read docs/DESIGN_STANDARDS.md for UI, code, and documentation changes. Apply its typography, semantic tokens, spacing, accessibility, interaction states, and visual review gates from Phase 0. Use local Supabase and synthetic data for repeatable development checks before hosted verification.

- Preserve React/TypeScript and Python boundaries. Routers adapt HTTP, services own business logic, and repositories alone access application data. Alembic owns application schema migrations. Supabase owns its authentication schema.
- Use managed Supabase Auth. Never store plaintext passwords or implement custom password cryptography. Derive ownership from verified identity. Test API authorization and RLS with two synthetic users.
- Keep privileged provider/database/deployment credentials on the server or in trusted CI secrets. Redact passwords, tokens, reset links, personal notes, and push endpoints from logs. Bundle UI assets locally. Add no telemetry.
- Use Python 3.12+, Node 24, pnpm 11.19.0, locked dependencies, and generated OpenAPI types. Establish scripts/tasks.py check and api in Phase 0 before claiming they can run here. Regenerate contracts after API changes.
- Treat the original product backlog as ideas. Web platform scope and release gates follow docs/PROJECT.md. Closed-browser reminders require a verified hosted sender and real-device testing.
- Distinguish local checks, hosted CI, deployment smoke, and device evidence. Use synthetic data for tests. Do not infer successful deployment or security from documentation.
- Before ending work, maintain AGENTS.md, docs/ARCHITECTURE.md, docs/IMPLEMENTATION_STATUS.md, docs/DECISIONS.md, docs/SKILLS.md, and docs/PROJECT.md. Preserve original references and report outstanding checks accurately.

Session November 17, 2026 adapted imported documents into the web roadmap and recorded managed authentication, ownership rules, hosting assumptions, and acceptance gates. No application implementation or deployment exists yet.

Documentation organization, November 17, 2026. Active project documents live in docs/. Keep this AGENTS.md at the repository root. Historical source-project documents remain in docs/reference and are archival material. Use docs/README.md as the documentation index. Seven supporting documents were moved and their local links checked.

Interface planning, November 17, 2026. docs/INTERACTION_SPEC.md outlines the active roadmap's screens and interactions and distinguishes later backlog ideas. A synthetic interactive mockup is available in the design chat. It is a planning preview outside application source; all implementation phases and hosted/device acceptance gates remain pending.

Foundation implementation, November 17, 2026. The user approved beginning development from the mockup. React/Vite source, Python health API, generated contracts, Alembic baseline, Supabase local configuration, check tasks, and a credential-free GitHub checks workflow now exist. `/design` is an explicitly synthetic reference, not a private-data release. Run `.venv/Scripts/python.exe scripts/tasks.py check` on this Windows setup; README.md documents setup and browser checks. The Docker follow-up below verifies the local Auth/database foundation. Hosted CI, preview deployment, and real-device gates remain unverified. Do not advance to Phase 1 until Phase 0 acceptance is met.

Docker follow-up, November 17, 2026. Docker Engine 29.9.3 started local Supabase successfully. The baseline migration, database-backed readiness, two synthetic login/recovery journeys, signup blocking, and cleanup passed. Database tasks capture credentials instead of logging them. The dedicated network requests loopback binding, but Docker Desktop still reported all-interface published ports; use synthetic data and stop services after checks until effective binding is resolved. Hosted CI/deployment and product authentication/RLS remain pending.
