# I Love People design and craft standards

Adopted November 17, 2026. This specification applies from Phase 0 onward. Tokens and synthetic reference components are now implemented in Phase 0. Baseline contrast and browser review evidence are recorded in IMPLEMENTATION_STATUS.md; full device and accessibility acceptance remains pending.

## Visual direction

A calm, personal interface inspired by Apple's hierarchy, legibility, restraint, and attention to interaction details. People and their meetup dates should lead each view. Use generous space, clear typography, quiet surfaces, and one recognizable action color. Every element should help someone understand a relationship, navigate, or act.

Use familiar web controls and browser behavior. Keep headings short, actions specific, and reminder language kind. A due state can say “Time to catch up.” Present the private priority scale with words and optional supporting descriptions.

Apple references inform the principles. The values below are web design decisions for this application. References include [typography](https://developer.apple.com/design/human-interface-guidelines/typography), [color](https://developer.apple.com/design/human-interface-guidelines/color), [layout](https://developer.apple.com/design/human-interface-guidelines/layout), and [accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## Typography

Use the locally installed system UI font through `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Apple devices resolve their own system face. This requires no font download. Keep system fonts installed on the device and use CSS fallbacks on other platforms.

| Role | Initial size / line height | Weight |
| --- | --- | --- |
| Page title | 32 / 38 CSS px | 700 |
| Section heading | 22 / 28 CSS px | 600 |
| Person name or control label | 17 / 24 CSS px | 600 |
| Body and form input | 17 / 26 CSS px | 400 |
| Supporting information | 15 / 22 CSS px | 400 |
| Caption | 13 / 18 CSS px | 400 |

Implement these as rem tokens relative to the browser default. Essential instructions and errors use body or supporting sizes. Keep body text left aligned and prose at approximately 60–70 characters per line. Allow names and labels to wrap. Test browser text enlargement and zoom explicitly. Web text scaling needs its own checks on iPhone.

## Colors

Use semantic CSS custom properties with light and dark values. Components consume roles such as `--color-text-secondary` and `--color-action`. Define the raw values in one token file.

| Role | Light | Dark |
| --- | --- | --- |
| Page background | #F5F5F7 | #121214 |
| Surface | #FFFFFF | #1C1C1E |
| Primary text | #1D1D1F | #F5F5F7 |
| Secondary text | #636366 | #AEAEB2 |
| Action/link | #005FCC | #7DB5FF |
| On solid action | #FFFFFF | #121214 |
| Separator, decorative | #D2D2D7 | #38383A |
| Control boundary | #76767B | #8E8E93 |
| Destructive text | #B42318 | #FFB4AB |
| Success text | #216E39 | #8ED6A0 |

Respect `prefers-color-scheme` and offer System, Light, and Dark settings. Check actual foreground/background combinations, including focus, errors, hover, and disabled states. Target WCAG 2.2 AA, including 4.5:1 normal text, 3:1 large text, and 3:1 required control indicators. Decorative separators are distinct from boundaries needed to identify a control. Use visible labels and icons alongside status colors. Avoid making distance or overdue status feel punitive.

## Spacing and geometry

| Token family | Starting values |
| --- | --- |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 CSS px |
| Page gutters | 20 px on phones, 32 px on wider screens |
| Content width | Up to 960 px, centered |
| Forms and reading width | Up to 560 px |
| Input and button height | At least 44 px, expanding with text |
| Corner radius | 10 px controls, 16 px grouped surfaces, 24 px sheets |
| Borders | 1 px where needed |
| Person rows | At least 72 px with 16 px vertical padding |

Use layout gaps and shared padding tokens. Keep related content close and place larger gaps between sections. Reserve shadows for floating layers. Use blur only where contrast stays legible, with an opaque fallback. Respect iPhone safe areas and leave sufficient space above sticky controls and the software keyboard.

## Screens and components

- Login has the app name, a short purpose statement, labeled inputs, one primary sign-in action, and an accessible recovery link. Support password managers and paste.
- The main screen leads with who is due. Rows show a person's name, last meetup, and next action. Keep secondary actions available through a clearly labeled menu.
- Person detail presents name, meetup information, and “Log meetup” first. Group editable preferences and history into readable sections.
- Use a single column on phones. Wider layouts may introduce a navigation rail and detail pane when each retains comfortable space. Preserve state when resizing.
- Build shared buttons, fields, person rows, dialogs, menus, notices, and empty states. Define default, hover, pressed, keyboard focus, disabled, loading, success, and error behavior wherever applicable.
- Use a consistent bundled, web-licensed outline icon family with a shared stroke weight. Give icon-only actions accessible names. Review asset licenses before adding them.
- Loading reserves the final layout's space. Errors identify what failed and provide an actionable retry. Empty states explain the next useful action. Preserve form input after recoverable failures.
- Dialogs have a title, intentional initial focus, keyboard dismissal, focus containment, and focus return. Confirm destructive operations with the affected person's name.
- Animations normally last 120–200 ms with a shared easing token. Honor reduced motion. Keep meaning and feedback available when animation is disabled.

## Code craft

Readable code is a deliverable. Use domain terms, explicit types, small cohesive functions, consistent formatting, and clear error handling. Keep related logic together and extract shared code when real callers benefit. Comments explain a constraint or reason that the code alone cannot communicate.

Keep React rendering declarative. Derive values from authoritative state, preserve stable identities, and handle asynchronous cancellation and stale results deliberately. Separate domain logic from UI. Centralize tokens and component variants so repeated elements stay consistent. Keep page-specific rules beside their page and shared primitives in the shared UI layer.

Keep Python HTTP, business rules, and data access in their documented layers. Transactions, ownership checks, retries, and concurrency behavior must be understandable at their boundary. Generated artifacts stay generated. Pin dependencies and include only dependencies used by the implementation.

Use automated formatting, linting, strict types, contract drift checks, and meaningful behavioral tests. Favor explicit, maintainable solutions that a new contributor can follow. Include keyboard semantics and accessible names in normal component implementation.

## Documentation craft

Write concise Markdown with descriptive headings, consistent terminology, short paragraphs, and working relative links. Give each document a clear purpose. Use tables for genuine comparisons and Mermaid only when a flow benefits from a diagram.

PROJECT.md owns goals and phase acceptance, ARCHITECTURE.md owns boundaries, DECISIONS.md owns rationale, IMPLEMENTATION_STATUS.md owns verified state, and this file owns design/craft standards. Link to their authoritative sections to keep repeated instructions synchronized. PROJECT_GUIDELINES.md preserves the original product ideas.

Add a short README with setup, start, checks, and links when source scaffolding exists. Commands must identify their working directory and required environment, work when copied, and omit secrets. Label planned commands until runnable. Document errors with a concrete recovery action. Keep examples synthetic and screenshots free of private records.

Record actual evidence and unresolved checks. Separate historical references from current instructions. Update documentation alongside behavior changes. Markdown's host determines typography and rendering, so structure, prose, diagrams, and consistency carry the documentation's visual quality.

## Acceptance throughout implementation

In Phase 0 create the token file, foundational CSS, and a small component reference view using synthetic content. Review login, people list, person detail, and logging form at phone and desktop widths before expanding components.

For every UI phase, review light/dark mode, 320/390/768/1440 px layouts, long names, empty/loading/error states, keyboard navigation, visible focus, reduced motion, and 200% zoom. At 320 CSS px ensure reflow without horizontal page scrolling. Measure contrast and check screen-reader names and meaningful reading order. Include real iPhone Safari checks before release.

Save representative screenshots and record visual review separately from automated checks. Passing functional tests alone leaves visual review pending. Changes to tokens or shared components require review of their affected consumers. Update the specification when an intentional design decision changes.


## Navigation and action feedback - November 19, 2026

Clearly mark the current library section using the semantic action/on-action pair, a check mark, programmatic current state and a matching heading. Keep section context available when scrolling. Person opening shows an explicit detail view, brings its heading and Back action into view, and returns focus/list context on Back. Account for wrapping navigation at enlarged text sizes.

Show a concise toast only after a mutation is confirmed. Use a polite status announcement, an accessible 44 px dismiss control and a safe-area-aware position. Allow seven idle seconds and pause expiration on hover/focus. Do not steal focus, emit success on failure, store private messages persistently, or invent an Undo operation. Retain useful inline errors.
