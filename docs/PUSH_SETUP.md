# Web Push setup

The notification settings are enabled when the server has a valid P-256 VAPID private key, VAPID contact, job secret and database connection setting. Catch up remains available independently of notification configuration.

## Production

The [protected Production site](https://i-love-people.vercel.app/) uses its own VAPID key, operator contact and job bearer. Vercel stores all three as sensitive Production-only settings. The production [Worker configuration](../scheduler/wrangler.production.toml) reuses the tested scheduler, targets the stable origin and disables public and preview URLs.

1. Deploy the Worker with `wrangler deploy --config scheduler/wrangler.production.toml`. Add the matching job bearer as the Worker secret `ILP_PUSH_JOB_SECRET`. Add the named Vercel project automation credential as the Worker secret `ILP_PREVIEW_BYPASS`. The latter binding name is shared with the Preview code. The credential can cross Vercel's hosting gate for the project, and the job still verifies its own bearer.
2. Stage Production with the fresh server settings. Check deployment protection, the Production Auth origin, readiness and service worker assets. Use the automation header to verify the app rejects a missing or wrong job bearer. Verify a valid bearer returns HTTP 200 and only aggregate counts. Repeat these checks on the stable domain after explicit promotion.
3. In Cloudflare, confirm the Production Worker has no route and both URL flags are off. Attach one `*/5 * * * *` Cron Trigger to Production after the stable smoke. Verify Cloudflare records a successful scheduled invocation with one subrequest. Keep the Preview schedule empty.
4. On the iPhone, open Production from its Home Screen icon and sign in. In **Menu**, choose **Enable on this device** and allow notifications. Make sure **Catch up** shows a person due. The default quiet hours are 9 p.m. to 9 a.m. in the account timezone. Close the app outside quiet hours without signing out. Check that a generic reminder arrives and opens the app when tapped. Remove any synthetic fixture after testing. **Turn off on this device** ends the subscription if you only want to test.

To pause delivery, remove the Production Cron Trigger. To retire the scheduler, also remove both Production Worker secrets and revoke its named Vercel automation credential. Keep the VAPID key stable during routine scheduler maintenance because rotating it requires re-enrolling devices.

The Production Worker invokes the stable URL. During staging, verify that the name preference saves and reloads. Verify scheduled named wording from the stable Home Screen app after promotion. A daily receipt recorded by the previous sender can delay the first named notification until the next eligible local date.

## Configure the protected Preview

1. Apply Alembic to the tested source revision's head on the isolated synthetic Supabase Preview. Named reminders require `0009_push_names`. Verify that the client roles cannot read or write either push table in `ilp_private`.
2. In trusted Preview-only settings, add `ILP_PUSH_PRIVATE_KEY` (32 raw P-256 scalar bytes encoded as URL-safe Base64), `ILP_PUSH_SUBJECT` (an operator-controlled `mailto:` address), and `ILP_PUSH_JOB_SECRET` (a random secret of at least 32 characters). Generate the key with the installed cryptography package or another vetted VAPID key generator. Keep the private key and job secret out of build variables, source control and terminal output. The API derives the matching public key for the browser.
3. Deploy the exact CI-passed source and verify the manifest, PNG icons, `/service-worker.js` JavaScript content type and `no-cache` header. Confirm the existing HTTPS/API security and deployment protection. Inspect the service worker's cache inventory using a synthetic account.
4. Configure the worker in `scheduler/` with `ILP_PREVIEW_ORIGIN` set to the exact deployment origin and the matching `ILP_PUSH_JOB_SECRET`. Use worker secrets for the job bearer and the protected Preview's `ILP_PREVIEW_BYPASS` automation credential. The worker has a scheduled entry point and no public route. Record the scope of the bypass credential and revoke it when the trial ends. The Worker uses a single outbound POST with a 50-second deadline and discards the response body. Review the latest plan limits before enabling the cron trigger. [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [Vercel automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
5. Record the UTC cron event, function status and duration, and the redacted delivery outcome for an eligible synthetic account. Verify a missing or incorrect job bearer is rejected even when Vercel permits the request. Run the next tick and verify one delivery for the device's local date.

## iPhone and desktop

The November 21–22 trial used [the exact Phase 4 Preview](https://i-love-people-8fi33jomc-smooshy.vercel.app). The trial is closed and its disposable credentials have been removed. For a future trial, provision a new disposable account and seed a due meetup before the device check. Use the Vercel account with Preview access at the Vercel prompt, then the disposable account at the I Love People prompt. Keep the phone online and outside quiet hours during the test.

1. Use a supported iPhone, open the exact HTTPS Preview in Safari, share it to the Home Screen, open the installed app and sign in. Resolve Preview Authentication in the installed context if prompted.
2. In Menu, choose **Enable on this device** and allow notifications. Check quiet hours and ensure the synthetic person has a due meetup and the current time is outside the quiet window.
3. Close the Home Screen web app. Verify the next scheduled run produces a generic notification with no person or priority information. Tap it and verify the app opens at the normal entry point and applies its usual account checks.
4. Revoke permission in system settings and verify delivery stops. Open the app to review denied-permission guidance. Re-enable permission, then verify **Turn off on this device** and the checked sign-out opt-out both suppress future sends. Test a second device or browser to confirm its separate settings stay intact.
5. Repeat enrollment, closed-window delivery and permission revocation in a supported desktop browser. Chrome DevTools push simulation verifies the service worker locally. The hosted test verifies the live browser push provider.
6. Try airplane mode with a partially filled form. Verify the open page retains the text in memory, shows the offline notice, and allows saving after reconnecting. Reload offline to verify the generic fallback. Include VoiceOver and enlarged text in pre-release review.

Record real-device evidence, the hosted schedule and source CI independently in `IMPLEMENTATION_STATUS.md`. Remove synthetic data and disable trial scheduling when the test ends. iPhone support starts with Home Screen web apps on iOS 16.4. [WebKit Web Push](https://webkit.org/blog/13878/)

## Named reminder device check

The November 23 trial used [the protected Phase 6 deployment](https://i-love-people-5wf9drj1g-smooshy.vercel.app) with two synthetic people. The user confirmed both reminder wordings and the disposable account has been removed. Use a new disposable account for a future trial. Use the Vercel account at the hosting prompt and disposable credentials at the app prompt.

1. Use a disposable account with two people due and distinct priorities. Check the order in **Catch up**. Enroll the iPhone Home Screen app and a second browser. Confirm **Show a name in reminders** starts unchecked on both.
2. On the iPhone, turn the option on and choose **Save notification settings**. Reopen Menu to confirm it persisted. Leave the other browser on its default. Close both apps without signing out, outside quiet hours.
3. Check that the iPhone receives the first eligible person's name and the other browser receives generic text. Tap the iPhone notification to verify it opens the app.
4. Clear the checkbox on the iPhone, save, and confirm notifications stay enabled. Close the app and verify generic wording on the next eligible local date. The sender allows one delivery per device per local date.

## Per-person reminder trial

For Phase 8, apply Alembic `0010_person_reminders` on the isolated Preview before running the candidate sender. Verify that the updated service worker controls the Home Screen app. The older worker uses one shared notification tag.

1. Seed two people with overdue completed meetups for a disposable account. Set a plan for one person and check that only the other is eligible. Clear the plan, and use a fresh device subscription or the next eligible local date for the two-delivery check.
2. With name visibility enabled and outside quiet hours, close the app and confirm that one scheduled run produces two distinct alerts with the expected names. Confirm a subsequent run sends zero repeats. Generic mode should produce two distinct alerts with no names.
3. Verify automatic resumption with an elapsed plan date and that editing the plan leaves completed meetup history intact. Check opt-out and clean up the trial.

Old combined receipts can suppress delivery for an already-served device until its next local date. For a Production code rollback, pause the sender while switching builds if rollback occurs on the same local date as a new send. The older job does not read per-person receipts.

## End the Preview trial

Disable the Cloudflare Cron Trigger and verify the schedules list is empty. Remove the trial secret bindings from the Worker. Revoke the temporary project automation bypass in the Vercel project and confirm the credential stops working. Remove the disposable Auth accounts and their ignored local credential files. Remove the ignored Windows-encrypted `.tools/phase4-access.dpapi` trial credentials after verification.

For Phase 6, also remove the three Phase 6 branch-scoped push settings in Vercel and the Windows-encrypted `.tools/phase6-*.dpapi` files. Verify the trial account, device rows, and delivery receipts are gone.
