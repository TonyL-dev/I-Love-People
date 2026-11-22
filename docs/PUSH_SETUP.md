# Phase 4 Preview verification

The notification settings are enabled when the server has a valid P-256 VAPID private key, VAPID contact, job secret and database connection setting. Catch up remains available independently of notification configuration.

## Configure the protected Preview

1. Apply Alembic through `0007_web_push` to the isolated synthetic Supabase Preview. Verify that the client roles cannot read or write either table in `ilp_private`.
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

## End the Preview trial

Disable the Cloudflare Cron Trigger and verify the schedules list is empty. Remove the trial secret bindings from the Worker. Revoke the temporary project automation bypass in the Vercel project and confirm the credential stops working. Remove the disposable Auth accounts and their ignored local credential files. Remove the ignored Windows-encrypted `.tools/phase4-access.dpapi` trial credentials after verification.
