# Phase 0 device review

Prepared November 18, 2026. These checks require a real iPhone and human observation. Desktop Chrome/axe checks do not establish Safari, VoiceOver, software-keyboard, or safe-area behavior. Record findings in [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

## Open the synthetic preview

Use iPhone Safari to open [the synthetic design reference](https://i-love-people-9xnbgkdx9-smooshy.vercel.app/design). Sign into Vercel if Deployment Protection asks. The app's own Sign in button is intentionally disabled in Phase 0; use **Explore the sample** if you arrive at the app's welcome page. All people and saves are synthetic. No real personal information is needed.

Tested source: `34305ba27752de65f6e5223b391b1aa26b7da55a`. Preview deployment: `dpl_8E33qgjzEaizmJforFHnrs1HhtUL`. Local networking changes do not change this UI.

## Safari and touch

1. In portrait, browse Catch up, People, Maya Chen's profile, and Settings. Repeat with Light and Dark appearance. Text, names, and actions should remain readable without sideways page scrolling.
2. Rotate to landscape and back. Check the notch, rounded screen edges, and bottom home indicator do not cover content or controls.
3. In People, search for Maya, open her profile, then open **Log meetup**. Tap the optional note field and type a short synthetic draft. With the software keyboard open, scroll the dialog and reach its date, note, cancel, close, and sample-save controls. Focus must remain understandable and the keyboard must not permanently cover an action.
4. Close the dirty dialog, choose **Keep editing**, and confirm the draft survives. Close again and discard it. Reopen and try a sample save; it should announce that no record was stored.
5. Set Safari Page Zoom to 200%. Repeat People/profile/dialog navigation, checking wrapped labels and reachable actions. Restore zoom afterward. This complements desktop text-enlargement tests.

## VoiceOver

Enable VoiceOver using your usual iPhone accessibility control. Use swipe navigation and double-tap activation.

1. Navigate the page heading, main navigation, People search field, and Maya's profile link. Labels and reading order should be meaningful; decorative icons should not create redundant stops.
2. Open **Log meetup**. VoiceOver should announce the dialog title, labeled date/note fields, and named buttons. Swipe forward and backward through its controls: background navigation should remain outside the modal focus sequence.
3. Trigger the dirty-draft confirmation. Identify **Keep editing** and **Discard changes** clearly. After closing the dialog, focus should return to its **Log meetup** opener.
4. Try a sample save and check that the result is announced. On Catch up, switch the reference screen-state selector to Loading, Empty, Error, and Offline; identify the status and available recovery action.

## Send back the result

Report iPhone model, iOS version, date, Safari/zoom result, keyboard/safe-area result, VoiceOver result, and any exact failing step. Include the appearance and orientation when reporting a problem. A screenshot can help, but omit private browser/account information.

November 18, 2026: user-reported pass on iPhone 16 Pro, iOS 27.2, for all non-VoiceOver steps in DEVICE_REVIEW.md. VoiceOver was explicitly not tested. This is user-reported device evidence, not an agent-observed session.

VoiceOver/screen-reader review remains open before private release. Desktop Page Zoom and second-device LAN evidence remain separate where unverified.

## Phase 1 owner journey report — November 18, 2026

The user reports the requested iPhone Safari journey passed: owner login, timezone save/reload, sign-out, real reset email arrival, password reset and replacement-password login, with no screen or keyboard problems. Earlier device identification was iPhone 16 Pro / iOS 27.2. This report does not establish a new VoiceOver run; VoiceOver remains explicitly untested before private release.


## Phase 2 people/history review — pending

Use a disposable synthetic account on the new Phase 2 Preview once deployed. Add a name-only person, choose/clear priority, explicitly accept a suggested cadence, then change cadence independently. Search and open the person. Log today and a backdated meetup, edit/delete the latest entry, and confirm last seen updates or becomes unknown. Verify archive/restore keeps history and person deletion removes it after confirmation. Reload, sign in again and verify persistence. Try the same record in two tabs to check a stale edit reports a conflict. Review date/note keyboard handling, both appearances, large text, portrait/landscape and VoiceOver modal focus/labels. Report this separately from earlier Phase 0/1 device evidence.


Phase 2 review target: [https://i-love-people-c2mef0l08-smooshy.vercel.app](https://i-love-people-c2mef0l08-smooshy.vercel.app). On iPhone Safari, sign in and add a disposable person. Log today and a backdated meetup; edit/delete the latest entry and check last seen. Check priority/cadence independence, archive/restore retaining history, then reload/sign in again and verify persistence. Delete the disposable person after reviewing the named confirmation. Report screen/keyboard problems and any failing step; do not send credentials or personal notes. Before testing recovery on this origin, save the exact Site URL and reset redirect in AUTH_SETUP.md. This device review is pending user evidence.


Phase 2 user journey report — November 18, 2026. The user confirmed saving the new Auth settings and reported every requested test passed in iPhone Safari and desktop with no screen, keyboard or functional problems. This covers the preceding Phase 2 people/history checklist, including persistence after fresh sign-in and on desktop. The user did not report a new device/OS version or a VoiceOver run. VoiceOver remains unverified before private release.


## Phase 3 review on the final Preview

On iPhone Safari and desktop, sign in and add synthetic Maya with a cadence and backdated meetup. Confirm Catch up shows her due and More opens her profile. Snooze to a future date: the catch-up date stays visible and Maya moves to Taking a pause. Review the last-seen/cadence reason in Weekly review. Try dismiss-for-today and pause/unpause. Log a newer meetup and confirm snooze/dismiss clear; change cadence and archive/restore. Check date controls, software keyboard, long names, light/dark, enlarged text and readable errors. Record actual device/version/results separately. VoiceOver remains an outstanding pre-release check.


Phase 3 review target: [https://i-love-people-k5cwd4tp3-smooshy.vercel.app](https://i-love-people-k5cwd4tp3-smooshy.vercel.app), application `a559aa5`. Hosted Chrome checks pass; iPhone Safari and VoiceOver are not inferred from those checks. Use the Phase 3 checklist above and report any screen/keyboard/function problems.


## Phase 3 usability feedback - November 19, 2026

The user reports existing date controls, software keyboard, long names, light/dark, enlarged text and readable errors work correctly. Navigation clarity, success feedback and mobile person opening need improvement. No new device/OS version or VoiceOver result was provided. After the revised Preview is verified, recheck the clearly selected section, opening a person into details with the name/Back action in view, Back restoring search, and success toasts after snooze/pause and saving a meetup. The earlier report is not automatically evidence for the revised UI.


Revised review target, November 19: [https://i-love-people-kipv1n31u-smooshy.vercel.app](https://i-love-people-kipv1n31u-smooshy.vercel.app), `cedb269`. Recheck just the requested improvements: selected section remains unmistakable while scrolling; opening a person shows details with name and Back visible; Back returns to the filtered list; snooze/pause and meetup saves show a readable success toast. Prior reported mobile passes remain recorded above. No new VoiceOver pass is inferred.


## Settings menu and toast follow-up

On the revised Preview, check that preferences/account panels are hidden until Menu opens the side drawer. Opening should focus Close without automatically raising the keyboard; timezone/appearance and logout remain usable inside. Close or tap the backdrop and confirm the open person/search remain. Check enlarged-text scrolling and the Close control. Confirm a snooze/pause toast keeps its checkmark beside the first message line. This request alone does not establish a device pass or a VoiceOver result.


Settings-menu review target: [https://i-love-people-pfoktasn6-smooshy.vercel.app](https://i-love-people-pfoktasn6-smooshy.vercel.app), `97e40ea`. Recheck Menu opening/closing, timezone/appearance and logout within the drawer, preserved person/search on close, enlarged-text drawer scrolling, and the toast checkmark on the first message line. Agent Chrome results do not establish a new iPhone or VoiceOver pass.


Latest UI approval, November 19: the user reports everything looks good after the settings-menu/toast update and requested phone recheck. Record this as user-reported approval of the revised interactions, with no new device/OS identifier or VoiceOver claim. This closes the outstanding UI review; provider recovery URL configuration is separately tracked in AUTH_SETUP.md.


Phase 3 acceptance, November 19: the user approves the revised UI, including the on-demand preferences/account menu and toast checkmark alignment. No new device/OS or VoiceOver result was supplied. Final-origin recovery also passes independently after the user confirms saving Auth URLs, closing Phase 3 alongside existing CI/hosted evidence. VoiceOver remains explicitly untested before private release; acceptance does not establish a new agent-observed real-device session.

## Phase 5 backup and accessibility review

Use the [protected Phase 5 Preview](https://i-love-people-b28h7198z-smooshy.vercel.app) for this review.

On iPhone Safari and the installed Home Screen app, use a disposable account and synthetic records. With VoiceOver active, open Menu, find **Backups and data**, and check that names, fields, status updates and errors are read in order. Download a backup and find it in Files. Choose it again to hear the conflict with the existing library, then cancel. Use an empty disposable account for restore. Confirm the counts and timezone are read, restore succeeds, and the person and meetup note appear.

Open **Delete all data**, confirm you can read its scope and cancel without changes, then verify that the password and typed confirmation have distinct labels. Complete deletion only with a disposable account. Check large text, keyboard presentation, focus when opening/closing Menu, and the light/dark appearance. Record the device, OS, deployment and actual results before private release.
