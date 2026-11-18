# Hosted Phase 1 setup and acceptance

The implementation is tested locally with disposable users. Complete these provider-owned steps on the isolated `i-love-people-preview` project before hosted acceptance. Keep all passwords, API secrets, and reset links out of chat, source control, screenshots, and logs.

## Provider configuration

1. Open [Supabase Authentication settings](https://supabase.com/dashboard/project/efuixughigoyyyflyelm/auth/providers). Disable **Allow new users to sign up**. Keep anonymous sign-ins disabled. Email/password authentication stays enabled; public registration is not part of this release.
2. In Email/password settings, require at least **12 characters**, including lowercase letters, uppercase letters, and numbers. Keep provider rate limits enabled; record their actual displayed values when verifying the hosted setup. Do not enable a paid option or custom SMTP service without a separate cost decision.
3. In [Authentication → Users](https://supabase.com/dashboard/project/efuixughigoyyyflyelm/auth/users), provision the owner through the administrative Add user flow using your own email and a password you enter yourself. Keep the password in your password manager. Do not send it to the agent.
4. For the disposable hosted two-user regression, add `ILP_SUPABASE_ADMIN_KEY` to ignored `.env.preview` using the project's server-only secret API key from [API Keys](https://supabase.com/dashboard/project/efuixughigoyyyflyelm/settings/api-keys). Keep the existing database URL. This key is only for an explicitly bounded test script; it must never become a browser variable or ordinary API runtime credential. No test message is sent to external recipients by this regression.

Supabase's default email service restricts eligible recipients and limits delivery. Use the owner's Supabase organization-member address unless a separately tested SMTP setup is adopted. See [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [email delivery restrictions](https://supabase.com/docs/guides/auth/auth-smtp), and [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).

## Deployment and redirects

The verified Phase 1 Preview is [https://i-love-people-o73m6xnlh-smooshy.vercel.app](https://i-love-people-o73m6xnlh-smooshy.vercel.app), running CI-passed `e60a47f`. Set that exact origin as the Site URL and `https://i-love-people-o73m6xnlh-smooshy.vercel.app/reset-password` as the exact Redirect URL in [Auth URL configuration](https://supabase.com/dashboard/project/efuixughigoyyyflyelm/auth/url-configuration). Remove earlier Phase 1 Preview redirect entries; avoid a broad wildcard. Keep the default managed implicit-flow recovery template. This final URL replaces the earlier `duuvdt09d` and `n6qyphccq` candidates. Deployment Protection remains enabled; use the owner's Vercel access.

The server receives `ILP_SUPABASE_URL`, `ILP_SUPABASE_PUBLISHABLE_KEY`, `ILP_ENVIRONMENT=production`, and a server-only `ILP_DATABASE_URL` in the Vercel Preview environment. The public configuration endpoint rejects secret/service-role keys. Application data repositories use the user's verified bearer token and publishable key; the SQL credential serves only infrastructure readiness and live Auth-session validation. The admin test key is excluded from the application deployment.

## Owner browser and email check

1. Sign in on the actual Phase 1 Preview; save a timezone, reload, and confirm fresh sign-in is required and the saved preference survives.
2. Sign out and confirm the private account view disappears. The app requests global provider sign-out and discards tab state even if the network fails, while stating that server sign-out is unconfirmed in that case.
3. Request a reset email to the eligible owner address. Open the real link in the intended browser. Confirm the password form loads, URL credentials disappear, and a new strong password succeeds. Sign in with the replacement password. The old password and a reused link should fail. Do not share either password or the reset link.
4. Report the actual recipient eligibility, received email, link destination/result, browser/device, and provider-limit settings. Local captured mail is not evidence of delivery to the owner's inbox.

The Phase 0 Safari review covered the synthetic reference on iPhone 16 Pro / iOS 27.2. The user now reports the requested iPhone Safari account/recovery journey passed with no screen/keyboard problems. VoiceOver remains untested and tracked separately.

## Verification progress — November 18, 2026

Provider steps 1–4 were reported configured. Disabled signup/anonymous sign-in, enabled email/password, one pre-existing account and server-only test access were verified. Actual hosted regression rejects short passwords and missing lowercase/uppercase/numbers. Migrations through 0003_profile_timezone, real managed logins, caller-scoped Data API ownership and local-ASGI authorization/revocation tests pass; disposable users are removed. The admin key remains only in ignored .env.preview. No test mail is sent.

Preview-only public runtime settings are stored. GitHub access is restored, both Linux CI jobs pass and the final Phase 1 Preview above passes deployed API and live browser checks. Earlier Phase 0/Phase 1 candidate URLs are not the recovery acceptance target. Owner browser/email recovery and provider-rate-limit evidence were supplied and recorded below; Phase 1 is accepted.

## Accepted owner recovery and provider limits — November 18, 2026

The user confirmed final Site URL/redirect configuration and reported that login, timezone save/reload, sign-out, real reset email arrival, password reset and replacement-password login worked, with no iPhone screen/keyboard problems. This is user-reported inbox/device evidence. An independent disposable hosted Chrome recovery passed the exact final redirect, password update, old-password rejection and used-link rejection without sending email; cleanup passed. Phase 1 is accepted. VoiceOver is still untested before private release.

Displayed rate limits reported by the user:

| Category | Limit |
| --- | --- |
| Emails | 2 per hour |
| SMS messages | 30 per hour |
| Token refresh | 150 per 5 minutes; 1800 per hour |
| Token verification | 30 per 5 minutes; 360 per hour |
| Anonymous-user requests | 30 per hour |
| Sign-ups/sign-ins | 30 per 5 minutes; 360 per hour |
| Web3 sign-ups/sign-ins | 30 per 5 minutes |
| Minimum interval per user | 60 seconds |

These are reported settings, not load-test results. Reporting an SMS, anonymous or Web3 limit does not enable that feature; initial app use remains email/password with public signup disabled. No paid email service or feature was enabled.
