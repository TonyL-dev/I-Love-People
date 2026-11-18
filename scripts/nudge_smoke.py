"""Real caller-scoped persistence and reminder cycle regression checks."""

from datetime import date, timedelta
from uuid import uuid4

import httpx


async def exercise_nudges(
    api: httpx.AsyncClient,
    own: dict[str, str],
    foreign: dict[str, str],
    public_key: str,
    data_url: str,
) -> None:
    created = await api.post(
        "/api/people",
        headers=own,
        json={
            "name": "Synthetic nudge Maya",
            "cadence_count": 1,
            "cadence_unit": "months",
        },
    )
    assert created.status_code == 200
    pid = created.json()["id"]
    path = "/api/people/" + pid
    future = (date.today() + timedelta(days=30)).isoformat()

    async def read() -> dict[str, object]:
        return next(p for p in (await api.get("/api/people", headers=own)).json() if p["id"] == pid)

    async def preference(action: str, **extra: object) -> None:
        p = await read()
        response = await api.put(
            path + "/nudge",
            headers=own,
            json={
                "revision": p["revision"],
                "action": action,
                **extra,
            },
        )
        assert response.status_code == 200

    async def log(day: str) -> dict[str, object]:
        response = await api.post(
            path + "/meetups",
            headers=own,
            json={
                "completed_on": day,
                "note": "",
                "request_id": str(uuid4()),
            },
        )
        assert response.status_code == 200
        return response.json()  # type: ignore[no-any-return]

    assert (await read())["due_on"] is None
    first = await log("2020-01-31")
    assert (await read())["due_on"] == "2020-02-29"
    assert (await read())["timing"] == "now"
    await preference("snooze", until=future)
    assert (await read())["suppression"] == "snoozed"
    assert (await read())["due_on"] == "2020-02-29"
    assert (await read())["eligible_on"] == future
    # Invalid dates, stale tabs, and foreign targets fail without changing state.
    p = await read()
    for token, revision, until, expected in [
        (foreign, p["revision"], future, 404),
        (own, 1, future, 409),
        (own, p["revision"], "2000-01-01", 422),
    ]:
        assert (
            await api.put(
                path + "/nudge",
                headers=token,
                json={
                    "action": "snooze",
                    "until": until,
                    "revision": revision,
                },
            )
        ).status_code == expected
    older = await log("2019-12-01")
    assert (await read())["snoozed_until"] == future
    # Note-only edits preserve nudge state.
    assert (
        await api.put(
            "/api/meetups/" + str(first["id"]),
            headers=own,
            json={
                "revision": 1,
                "completed_on": "2020-01-31",
                "note": "Changed note",
            },
        )
    ).status_code == 200
    assert (await read())["snoozed_until"] == future
    await preference("dismiss")
    assert (await read())["suppression"] == "dismissed"
    newest = await log("2020-03-31")
    p = await read()
    assert p["snoozed_until"] is None and p["dismissed_on"] is None
    assert p["due_on"] == "2020-04-30"
    await preference("pause")
    assert (await read())["suppression"] == "paused"
    await preference("unpause")
    assert (await read())["suppression"] is None
    await preference("snooze", until=future)
    # Direct Data API changes also reset a cycle and cannot change a foreign profile.
    with httpx.Client(base_url=data_url, timeout=10) as data:
        p = await read()
        denied = data.post(
            "/rpc/nudge_write",
            headers={**foreign, "apikey": public_key},
            json={
                "action": "nudge",
                "target": pid,
                "expected": p["revision"],
                "payload": {"action": "pause"},
            },
        )
        assert denied.is_error
        assert data.post(
            "/rpc/nudge_write",
            headers={"apikey": public_key},
            json={
                "action": "nudge",
                "target": pid,
                "expected": p["revision"],
                "payload": {"action": "pause"},
            },
        ).is_error
        assert data.patch(
            "/meetups",
            headers={**own, "apikey": public_key},
            params={"id": "eq." + str(newest["id"])},
            json={"completed_on": "2020-04-30", "revision": 2},
        ).is_success
    assert (await read())["snoozed_until"] is None
    assert (await read())["due_on"] == "2020-05-30"
    await preference("snooze", until=future)
    for entry, revision in [(newest, 2), (first, 2), (older, 1)]:
        assert (
            await api.delete(
                "/api/meetups/" + str(entry["id"]) + f"?revision={revision}", headers=own
            )
        ).status_code == 200
    p = await read()
    assert p["due_on"] is None and p["eligible_on"] is None
    assert p["snoozed_until"] is None and p["dismissed_on"] is None
    assert (await api.delete(path + f"?revision={p['revision']}", headers=own)).status_code == 200
    print(
        "Phase 3 calendar due dates, preferences, cycle resets, "
        "conflicts and two-user access passed."
    )
