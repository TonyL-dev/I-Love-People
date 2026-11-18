# Workflow and skills notes

Updated November 17, 2026. Imported notes are retained in reference/SKILLS.md.

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
