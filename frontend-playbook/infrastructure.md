# Set up an app from local development to Production

Use this sequence for a React app with a backend API. GitHub holds the source and runs checks, Supabase handles sign-in and data, Vercel hosts the app and API, and an optional Cloudflare Worker runs scheduled jobs. Start with synthetic data and one signed-in screen that reads and saves a record.

| Environment | App and API                        | Data and Auth                                   | Scheduled jobs                            |
| ----------- | ---------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Local       | Local dev servers                  | Local Supabase and captured email               | Manual or simulated calls                 |
| Preview     | Protected Vercel branch deployment | Separate hosted project and disposable accounts | Optional test Worker and credentials      |
| Production  | Stable Vercel domain               | Separate hosted project and real accounts       | Separate Worker and credentials if needed |

Record the app origin, Supabase project reference, deployment ID, migration revision, and any Worker name for each environment. Record where credentials are stored and who can rotate them. Keep secret values out of the record.

| Configuration                    | Where it belongs                                                            |
| -------------------------------- | --------------------------------------------------------------------------- |
| Supabase URL and publishable key | Browser or public app configuration                                         |
| Database connection URL          | Backend runtime or trusted migration job, according to its purpose          |
| Supabase secret key              | Trusted admin tooling only, if admin operations are needed                  |
| SMTP credentials                 | The matching Supabase project's Auth settings                               |
| Scheduled job bearer             | The backend and its matching Cloudflare Worker                              |
| Vercel automation credential     | The matching Cloudflare Worker, if it needs access through the hosting gate |

## 1. Set up the repo and local stack

1. Pin language and package manager versions, commit lockfiles, and add CI for lint, type checking, builds, and tests. Make these checks runnable locally too.
2. Install the Supabase CLI and a compatible container runtime. Run `supabase init` once from the repo root, then `supabase start` for local development. Use the local API URL and publishable key in your ignored local configuration. Open the captured-mail inbox listed by `supabase status` to inspect local confirmation and recovery messages. [Supabase local development](https://supabase.com/docs/guides/local-development)
3. Choose one migration tool for the application schema. I Love People uses Alembic because its API is Python. Supabase CLI migrations are an option for a new stack. Let Supabase manage its Auth schema. Apply migrations locally, then to Preview before running them against Production.
4. Create one application table with an indexed `owner_id` linked to the Supabase Auth user. Enable Row Level Security and restrict each operation to `auth.uid() = owner_id` for authenticated users. For inserts and updates, use `WITH CHECK` to enforce ownership of the written row. Verify the rules through the app API and directly through the Data API using two synthetic accounts. [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

## 2. Build sign-in and recovery

1. In Supabase **Authentication → Sign In / Providers**, enable email and password and set the password requirements. For a private app, leave self-service signup closed and create the first test user in **Authentication → Users**. If offering signup, keep **Confirm email** enabled, add a **Create account** screen using `signUp`, and verify that unconfirmed accounts cannot sign in. Keep anonymous sign-ins off for this setup. [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
2. Build a labeled email and password form. Use React Hook Form for the draft, validation, and submit state. Call `signInWithPassword({ email, password })` through the Supabase client and give failed sign-ins a generic message. Use `autocomplete="email"` and `autocomplete="current-password"` so password managers work. [Form workflow](forms.md) · [Supabase sign-in reference](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
3. Decide how long the session should live. I Love People keeps it in tab memory, so a reload requires sign-in. With `supabase-js`, configure `persistSession: false` for this approach. Attach the access token to protected API calls and verify identity at the server before using the user ID. When querying owned data through the Data API, use the caller's token so RLS applies. Clear the private UI and [session cache](caching.md) on sign-out, expiry, or account change. Verify server logout semantics if your app requires immediate session revocation. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
4. Add a **Forgot password** form using `resetPasswordForEmail(email, { redirectTo })`. Set the redirect to your app's recovery route and configure that exact URL in Supabase **URL Configuration**. The recovery screen needs a valid recovery session before calling `updateUser({ password })`. Use `autocomplete="new-password"` and keep recovery credentials out of logs. Test that the new password works, the old one fails, and a used link has a useful recovery path. [Supabase recovery flow](https://supabase.com/docs/guides/auth/passwords#resetting-a-password) · [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)
5. For hosted tests, configure custom SMTP in the correct Supabase project and check the sender's limits. In **Email Templates**, edit **Confirm signup** for registration and **Reset password** for recovery. Use a fresh message to verify each change. A confirmation page that waits for a click or an OTP entry can prevent email scanners from using single-use links automatically. Test deliverability with an inbox you control outside the Supabase project team. [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) · [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

## 3. Connect GitHub and Vercel

1. Import the GitHub repo into Vercel. Set the app root, framework, pinned runtime, install command, and build output. For a React SPA, confirm direct navigation to routes such as `/reset-password` loads the app shell and `/api/*` reaches the API. Give the API a basic health endpoint and a readiness endpoint that checks required dependencies. [Vercel Git deployments](https://vercel.com/docs/git)
2. Set environment variables for the intended target. The browser can receive the Supabase project URL and publishable key. Put database URLs, admin credentials, and job secrets in trusted server or CI variables. A `VITE_` variable is included in the client bundle. Keep Preview and Production values separate and redeploy after editing Vercel variables. [Vercel environment variables](https://vercel.com/docs/environment-variables)
3. Deploy and protect a branch Preview. Point it at the test Supabase project and update that project's Site URL and exact recovery redirect. Use one stable branch URL for mail tests if you redeploy frequently. Set the browser Content Security Policy to allow connections to the correct Supabase origin. Vercel's hosting gate and the app's sign-in are separate checks. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
4. For Production, verify the exact release commit passed CI. Apply any needed schema changes through a trusted, serialized release job, and keep a current backup. With Vercel CLI, `vercel deploy --prod --skip-domain` stages a build with Production variables before assigning the live domain. Verify which Supabase project the candidate actually uses. Test sign-in and a disposable create, read, update, and delete journey before running `vercel promote <deployment-id>`. [Vercel staged promotion](https://vercel.com/docs/deployments/promoting-a-deployment)
5. On the stable domain, check health, readiness, assets, sign-in, recovery destination, and access denial without an app session. Record the previous deployment ID for rollback and recheck the site after a rollback. Treat database recovery separately from code rollback. [Vercel rollback](https://vercel.com/docs/deployments/instant-rollback)

## 4. Add Cloudflare only when you need a scheduled job

1. Put the work behind a server endpoint such as `POST /api/jobs/reminders`. Require a dedicated job credential from a trusted secret store. Make the job idempotent so a repeated or overlapping tick cannot duplicate work. For reminders, use a unique delivery record keyed by recipient and intended delivery period.
2. Create a Worker with a `scheduled` handler and separate Preview and Production configuration. Add a UTC cron expression through Wrangler. Store the bearer with `wrangler secret put JOB_SECRET` for the relevant Worker environment. Set the exact app origin in its configuration and call the job endpoint with a timeout. Use the app's timezone rules for user-facing schedules. [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/) · [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
3. For a Vercel-protected target, use a dedicated automation credential to cross the hosting gate if required. The job endpoint must also validate its own credential. Keep the Worker limited to the intended target and keep secrets out of request logs. [Vercel automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
4. Test a local tick, a hosted test tick, a missing or invalid bearer, and a repeated tick. Verify the effect, such as a single reminder delivered, as well as the HTTP result. To pause, remove the cron schedule. To retire the job, also revoke its credentials. [Cloudflare Cron Trigger testing](https://developers.cloudflare.com/workers/configuration/cron-triggers/#test-cron-triggers-locally)

## Release checklist

- [ ] Local sign-in, sign-out, request cancellation, and captured recovery mail pass.
- [ ] Two Preview accounts can create and read their own data. Cross-account access and signed-out access fail through both the application API and the Data API.
- [ ] The Preview app points to Preview Supabase. The Production candidate points to Production Supabase.
- [ ] Hosted email arrives and opens the intended origin. For self-service signup, verify the confirmation screen and rejected reuse.
- [ ] The staged build passes signed-in and signed-out checks before promotion. Disposable accounts and their data are cleaned up.
- [ ] The stable release passes smoke checks. Record the rollback target and the expected usage and cost of each provider.
- [ ] If enabled, the scheduled job ran once as expected, duplicate runs produced no extra effect, and the pause procedure is documented.
