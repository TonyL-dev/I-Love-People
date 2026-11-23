# Interface mockup and interaction specification

Proposed November 17, 2026. This is a planning deliverable, not application implementation. [PROJECT.md](PROJECT.md) owns release scope and phase acceptance. [DESIGN_STANDARDS.md](DESIGN_STANDARDS.md) owns visual tokens and review requirements. All names, dates, notes, and account details in the preview are synthetic.

## Preview and scope

The interactive preview is presented in the design conversation. It models the complete active Phase 0–5 interface and includes a built-in interaction guide. Its demo date is November 17, 2026 in America/Toronto. The preview controls are review tools, outside the proposed product interface.

The preview is held in this chat's visualization directory, outside application source. It has no backend, authentication provider, persistent personal storage, notification sender, or deployment. Actions simulate the experience in browser memory. Provider permission, backup processing, cross-device concurrency, and security enforcement require the actual implementation and separate verification.

Phase 0 follow-up: the repository now has a separate synthetic React component reference at `/design`. Its verified behavior and remaining implementation gates are recorded in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). This interaction specification continues to describe the intended full release, rather than claiming every flow is implemented.

The intended product is a calm personal tool: who to catch up with, when you last met, and one obvious next action. No relationship score, streak, punitive overdue indicator, marketing dashboard, or public registration is introduced.

## Visual specification

Use the exact semantic light/dark palette and type roles in DESIGN_STANDARDS.md. Use the device system face through `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; no downloaded font or remote photographs. Initials are placeholder identity marks, with names always present. Use consistently weighted Lucide outline icons in the preview; a production bundle must include its license and local assets.

| Element | Proposed treatment |
| --- | --- |
| Page | #F5F5F7 light / #121214 dark; centered content up to 960 px |
| Grouped surface | #FFFFFF / #1C1C1E; 16 px corner radius; minimal decorative borders |
| Primary action | #005FCC / #7DB5FF; #FFFFFF / #121214 text |
| Primary / secondary text | #1D1D1F / #F5F5F7 and #636366 / #AEAEB2 |
| Required control boundary | #76767B / #8E8E93; 1 px |
| Destructive / success | #B42318 / #FFB4AB and #216E39 / #8ED6A0, with words |
| Page / section heading | 32/38 px at 700; 22/28 px at 600; rem equivalents |
| Names / body / secondary / captions | 17/24 at 600; 17/26 at 400; 15/22 at 400; 13/18 at 400 |
| Spacing | 4, 8, 12, 16, 24, 32, 48, 64 px |
| Page gutters | 20 px phone; 32 px desktop |
| Forms | At most 560 px; 20–24 px between fields; persistent visible labels |
| Controls | At least 44 px high; 10 px corners; text can wrap and increase height |
| Person rows | At least 72 px, with 16 px vertical padding; preview uses 96 px for three readable lines |
| Dialogs | 24 px corners/padding; opaque surface, restrained floating shadow |
| Motion | 160 ms for control feedback, within the 120–200 ms standard; disabled for reduced motion |

Desktop uses a quiet navigation rail and one readable content column. Phones move navigation into wrapping compact buttons below the brand. This avoids obscuring content with a simulated fixed bottom bar in the conversation. A production sticky navigation treatment must respect safe areas, keyboard overlap, and zoom. People rows wrap actions beneath identity text on phones. Long names wrap rather than truncate. State is preserved when resizing.

Appearance defaults to System, with Light and Dark in Settings. Controls retain visible keyboard focus. Color never carries status alone. Measurements and accessibility evidence belong to implementation acceptance, rather than being assumed from these tokens.

## Screen and interaction map

### 1. Sign in and account recovery — Phase 1

The login page shows the app name, purpose, labeled email/password inputs, show/hide password, Sign in, and Forgot password. Password managers, paste, keyboard submit, and correct autocomplete attributes are supported. There is no sign-up link.

| Trigger or state | Result and recovery |
| --- | --- |
| Submit incomplete form | Associate native/inline validation with the affected field; focus the first invalid field |
| Submit valid form | Disable duplicate submission, announce progress, then open Catch up on success |
| Invalid credentials | Generic error that does not reveal whether the email exists; retain email, permit retry |
| Rate limit / provider unavailable | Explain that sign-in cannot complete now; offer retry when allowed; never expose provider secrets |
| Forgot password | Email form; generic confirmation regardless of account existence |
| Recovery email delayed | Check spam, verify entered address, and request another link subject to provider limits |
| Valid reset link | New-password form with configured provider rules and clear success |
| Expired, used, or invalid link | Explain that a fresh link is needed; return to recovery request |
| Expired session | Remove private UI; sign in again; preserve already saved server records |
| Reload | Fresh sign-in required under the initial memory-only session policy |
| Change password | Start managed password recovery for the verified account |
| Sign out | Confirm, offer device notification opt-out, clear account caches and unsaved drafts, show login |

The preview accepts synthetic credentials and demonstrates recovery screens. It does not verify credentials or send messages. Generic credential failures, provider throttling, real redirect behavior, and reauthentication are specified above for future implementation.

### 2. Catch up — Phase 3

Lead with a short greeting and date, then Time to catch up, In the next 7 days, A little later, and No meetup logged. Secondary paused/snoozed/dismissed records can appear under Taking a pause. Each row contains name, last meetup, reminder status, Log meetup, and a visibly labeled More control.

Timing groups take precedence over priority. Within groups sort by Closest, Close, Comme ci, comme ça, Distant, unranked; then due date, name, stable ID. Do not infer a meetup date for someone who has no history. Cadence-off records remain accessible in People. If nobody is eligible, offer a gentle all-caught-up state without suggesting a failed goal.

Calendar days/weeks are exact intervals; calendar months clamp to the last valid day of the target month. The account timezone determines today, dismiss expiry, and external delivery timing. Meetups are completed calendar dates, not UTC instants.

### 3. People and person editor — Phase 2

People provides name search, Active/Archived/Everyone, Name/Priority sorting, Add person, and profile opening. Search updates results without losing input focus. Empty collections invite adding a person; no-match results offer clearing search.

Add person requires only a name. Last meetup, priority, and cadence are optional. Clearing last meetup during creation means unknown, rather than today. An entered date creates an actual history entry. Future completed dates are rejected.

The private priority picker uses full words and explanations:

| Priority | Description | Suggested cadence, explicitly accepted |
| --- | --- | --- |
| Closest | I want to make time for them regularly. | 2 weeks |
| Close | I want to see them fairly often. | 1 calendar month |
| Comme ci, comme ça | I'd like to see them occasionally. | 3 calendar months |
| Distant | I'd like to catch up once in a while. | 6 calendar months |
| No priority | Optional ranking cleared | Existing cadence retained |

Changing priority offers Use suggested pace. It never changes cadence silently. Cadence supports a positive number of days, weeks, or months and a clear off state; the prototype expresses off as 0 with an explicit explanation. Production bounds must be enforced on both sides of the API. Changing cadence recalculates eligibility. It does not rewrite history.

### 4. Person profile and lifecycle — Phases 2–3

Show name, private priority, reminder status, Log meetup, Edit person, and More actions. Then show last meetup, cadence-derived catch-up date, pace, and reminder state. History follows, newest first, with per-entry edit controls. Optional notes stay inside the private view.

| Action | Result |
| --- | --- |
| Edit name / priority / cadence | Save updates the profile; cancel leaves the record unchanged |
| Snooze | Choose a future local date; suppress nudges until that date; show original due date on the profile |
| Dismiss for today | Suppress the nudge until the next local date; preserve history and due date |
| Pause | Keep history, cadence, and visible due date; suppress nudges |
| Resume | Derive current eligibility from saved history/settings |
| Archive | Confirm named person; keep history; suppress nudges; find through Archived filter |
| Restore archived person | Confirm; return to active list and recalculate eligibility |
| Delete person | Confirm name and history impact; remove person and owned dependent entries atomically |

Archive is reversible. Person deletion has no misleading Undo promise. An actionable failure retains the existing record and allows retry.

### 5. Log, edit, and delete a meetup — Phase 2

From a profile or row, Log meetup opens with today prefilled and Save meetup available immediately. This is one submit after opening; it does not fabricate a completed meetup on the initial click. Backdate with an exact date picker; notes are optional. Cancel/close/Escape on a dirty form asks Keep editing or Discard changes.

Submission shows Saving and prevents duplicate submit. The actual implementation must retain the same idempotency key across an uncertain retry. On success update history and derived dates and announce completion. Creation offers Undo, which removes the created entry and recomputes eligibility. Notes are never echoed into logs or notification text.

Older added entries do not move the last-seen date. A new latest meetup clears snooze/dismiss state and starts the next cadence cycle. Editing/deleting the latest entry uses the latest surviving date. Removing the final entry returns to unknown last seen and clears recurring eligibility. Editing a note alone should not clear snooze or dismissal.

Recoverable save failures retain form input in this tab. Revision conflicts explain another tab/device changed the record and offer loading current values for review or returning to the draft. No silent overwrite. Production implementation must compare revisions again before retrying; the preview only demonstrates the conflict decision.

### 6. Weekly review — Phase 3

List people due now or within seven days and explain each: last meetup + chosen pace = catch-up date. Include priority in the private review, with status for snooze/dismiss. Provide View person and Log meetup. Paused and archived profiles do not generate active review nudges. The review is a planning aid, not a score or automatic outreach tool.

### 7. Settings, installation, and external notifications — Phase 4

Appearance, IANA account timezone, per-device notifications, quiet hours, installation guidance, data controls, and account actions are grouped in readable surfaces.

Notification setup is initiated only by Enable on this device. Explain generic wording before requesting browser permission. Track each device separately. States include unsupported browser, Home Screen installation needed, permission not yet requested, denied, subscribed, revoked/expired endpoint, unsubscribe pending, and unsubscribed. Denial provides device/browser settings guidance and keeps in-app reminders useful.

On a supported iPhone, guide Safari Share → Add to Home Screen → reopen the app → sign in → opt in. No pretend automatic iOS install button. Desktop can use normal browser support. Neither installation nor closed-browser delivery is claimed verified by this prototype.

Sample notification: “A little time to reconnect. Open I Love People when you have a moment.” Never include names, priorities, or notes on the lock screen. Click routing must authenticate before revealing a profile. Quiet hours use the saved timezone, including windows across midnight. Opt-out unsubscribes that device. Sender eligibility is rechecked after pause, archive, deletion, and logout opt-out. Delivery delays/retries do not imply changes to meetup history.

### 8. Export, restore, and delete all — Phase 5

Export explains included people, history, settings, and version metadata; excludes passwords, tokens, privileged keys, and push endpoints. Successful production export downloads a portable file; failures offer retry. The preview shows a count summary without downloading data.

Restore starts with a file picker and a validated preview of people, meetups, and the timezone change. An existing library blocks restore and lets the user keep their current data. Intentional replacement requires a separate password-confirmed delete-all and a fresh preview. The apply step rechecks the reviewed file and destination, writes in one transaction, and announces the restored counts. Invalid files block apply with an error. The destination is always the signed-in account.

Delete-all requires current-account reauthentication, a clear statement of what is removed, and an explicit typed confirmation. Failure preserves records. Success clears owned library data and device subscriptions, returning to an empty library; account deletion itself is not added to the current roadmap. A future account lifecycle decision would need separate design. The preview uses a synthetic password field and DELETE confirmation, without performing authentication.

## Shared states and accessibility

| State | Interface behavior |
| --- | --- |
| Loading | Reserve final layout space; status announcement; no fake private records |
| Empty | Explain the state and show the next useful action |
| Service failure | State what failed and offer retry; no raw provider error or secret |
| Offline | Explain private records require a connection; never cache API/auth/personal data; preserve current drafts in memory only |
| Form validation | Specific field errors, retained values, meaningful focus, accessible associations |
| Submitting | Disable duplicate action and announce progress |
| Success | Concise non-blocking confirmation; Undo only for an operation that can really be reversed |
| Conflict | Retain draft, show current-record review option, avoid silent overwrite |
| Destructive confirmation | Name the person/operation; initial focus favors cancellation; no accidental destructive default |
| Dialog | Accessible title, intentional focus, focus containment, Escape/dirty review, focus return |
| Appearance / resize | Maintain reading order, state, status words, focus visibility, and readable controls |

Use native semantic controls, programmatic labels, keyboard activation, visible focus, status/alert announcements, and reduced-motion support. Final acceptance includes 320/390/768/1440 px layouts, long names, 200% zoom, actual VoiceOver/screen-reader use, touch target review, contrast measurements, iPhone Safari, software keyboard, safe areas, and light/dark states. A browser preview alone does not satisfy these gates.

## Future backlog boundaries — Phase 6

The original product backlog remains in [PROJECT_GUIDELINES.md](PROJECT_GUIDELINES.md). It is not a promise that every idea ships in the first release. The built-in guide groups every backlog area; individual later interactions require a selected scope and acceptance checklist.

| Backlog area | Proposed later journey |
| --- | --- |
| Contacts, recognition, and organization | Explicit import permission → choose fields/people → preview duplicates; profile photos/nicknames/pronunciation, contact shortcuts, groups, pins, households, locations, richer sorting, and merge preview |
| Richer history | Pick attendees → shared meetup draft → confirm completed attendees; optional types, other contact kinds, approximate dates, time/duration, venues, photos/links, history search, batch entry, same-day duplicate review |
| Flexible reminders | Group defaults, windows and seasons; first check-in, one-off follow-up, preferred days, digest, notification actions, dated pause, vacation mode, upcoming-plan awareness, reminder history, birthdays/anniversaries |
| Planning and invitations | Choose activity/date/place → tentative plan → reviewed draft/calendar handoff → status changes → confirm whether it happened; availability permission, group outings, city/trip shortlist, manual location fallback |
| Context and reflection | Private profile notes, conversation topics, shared interests, milestones, traditions, combined timeline, monthly review, cadence reflection, reconnect list, optional reminiscence |
| Platform conveniences | Separate platform decision for native widgets, Lock Screen widgets, Shortcuts, share sheet, Watch; one-handed logging, accessible timelines, localization, optional app lock |
| Portability and privacy extensions | Richer permission management, spreadsheet import with preview/deduplication, printable timeline, deliberate attachment/note export choices; existing cloud persistence and Phase 5 backup are already active roadmap items |

## Evidence

This specification and its preview do not advance implementation phases. Browser mockup review is recorded in IMPLEMENTATION_STATUS.md. Hosted CI, authentication, RLS, API ownership, database persistence, deployment, genuine backup recovery, and real-device notification evidence remain pending.
