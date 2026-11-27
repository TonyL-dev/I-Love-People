# Cache server data

Start by writing a policy for each read. Pick a freshness window based on how the data changes and what a stale result would cost the user.

| Read                                     | I Love People policy                                     | Refresh trigger                                                  |
| ---------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| People and meetup history                | Up to 24 hours of freshness within the signed-in session | Relevant successful write or explicit refresh                    |
| Account and notification settings        | Reuse within the signed-in session                       | Confirmed save or detected change to the local push subscription |
| Date-dependent views                     | Include the date and timezone in the query key           | Local midnight or return to the tab after the date changed       |
| Sign-in, recovery, and backup operations | Live requests                                            | User action                                                      |

## Integrate

1. Create a `QueryClient` when a session starts. Mount a `QueryClientProvider` around the authenticated tree and give each new session a fresh client. On sign-out, expiry, or account switch, unmount that tree, cancel its pending queries, and clear its cache. Use an opaque session identifier if you need a React key.
2. Include every value that changes the result in the query key. Use a shared key prefix to invalidate related lists. Fetch detail data on demand and forward the query’s `AbortSignal` to the API client.
3. After a successful save, write the returned record into any cache it fully represents. Invalidate affected keys for derived results or lists. Keep the freshness window and garbage-collection time separate when choosing how long inactive data should be retained.
4. Keep private query data in memory. The server still verifies identity and ownership on every request. Keep private HTTP responses out of shared caches.

Capture the session-specific client when you start a save. If the session ends before the save finishes, skip its cache update and success feedback. Canceling reads cannot undo a write the server already accepted.

The [cache example](examples/session-cache.ts) shows a session client, a detail query, and a targeted cache update. It keeps the default stale-on-focus refresh behavior for active stale queries. Decide whether that behavior fits each destination project. Use a live `refetch()` for a manual refresh action.

## Verify

- Count requests on the initial read, reopen, focus while fresh, and manual refresh.
- Change a record and verify that the list and detail show the confirmed state.
- Reject a save and verify that the last confirmed cache entry stays intact.
- Switch accounts during a pending request and check the new session cannot see the previous session’s data.
