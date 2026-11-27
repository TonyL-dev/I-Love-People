# Frontend playbook

Copy this directory into a React and TypeScript project. Start with one screen that reads and saves data, then repeat the same steps for each feature. The examples use generic projects and preferences. Supply your app’s session lifecycle, authorized API client, and data types at the integration points.

For a new app, start with the [infrastructure and sign-in guide](infrastructure.md). It covers the local stack, deployment, email recovery, and optional scheduled jobs.

| Step                     | Decide and build                                                  | Ready when                                                                                        |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [1. Styling](styling.md) | Establish semantic tokens and shared control states.              | The screen works in light and dark, at phone widths, and with keyboard navigation.                |
| [2. Caching](caching.md) | Define query keys, freshness, and which saves affect which reads. | Revisiting fresh data reuses it, saves update the right view, and sign-out discards private data. |
| [3. Forms](forms.md)     | Define defaults, validation, API payload, and feedback.           | A failed save preserves edits. A confirmed save updates the view and resets the form baseline.    |

## Reuse for each feature

1. Write down the screen’s read, edit, and save states. Include empty results, failed requests, and retry.
2. Identify each read’s owner and inputs. Decide how stale it can be and what should refresh it.
3. Build the form with visible labels and an explicit save action. Map fields to the API payload at submit time.
4. Verify loading, success, failure, reload or revisit, and sign-out where relevant. Test at least one keyboard-only path.

For a first implementation, use the [typed preferences form](examples/preferences-form.tsx), the [cache example](examples/session-cache.ts), and the [tokens and controls](examples/styles.css). The examples use React Hook Form `7.92.0` and TanStack React Query `5.108.4`, the versions used for these patterns in I Love People. Check compatibility with the destination project and lock the versions you install.

The source project keeps the active UI and its tests in `frontend/`. This directory can travel independently.

## Wire up the first screen

1. Import `examples/styles.css` and put `className="playbook-ui"` on the app shell.
2. At sign-in, call `createSessionCache()` once and pass the result to `QueryClientProvider`. Fetch the record inside that provider with `useQuery(projectQuery(id, readProject))` or define a query for your own resource.
3. Once the record loads, render `PreferencesForm` with the saved values and your async `save` function. Return the saved values from the server and update or invalidate the queries that depend on them.
4. At sign-out, discard the signed-in UI and call `disposeSessionCache()` on the client for that session.
