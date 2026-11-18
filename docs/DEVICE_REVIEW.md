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
