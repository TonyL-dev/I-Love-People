"""Synthetic Phase 2 regressions shared by local privacy smoke."""

import asyncio
from uuid import uuid4

import httpx


async def exercise_people(
    api: httpx.AsyncClient, sessions: list[tuple[str, str]], public_key: str, data_url: str
) -> None:
    headers = {"Authorization": "Bearer " + sessions[0][1]}
    foreign = {"Authorization": "Bearer " + sessions[1][1]}
    assert (await api.get("/api/people")).status_code == 401
    created = await api.post("/api/people", headers=headers, json={"name": "Synthetic Maya"})
    assert created.status_code == 200
    person = created.json()
    pid = person["id"]
    assert person["last_seen"] is None
    assert (await api.get("/api/people", headers=foreign)).json() == []
    assert (await api.get(f"/api/people/{pid}/meetups", headers=foreign)).status_code == 404
    entry = {"completed_on": "2020-02-29", "note": "Synthetic walk", "request_id": str(uuid4())}
    path = f"/api/people/{pid}/meetups"
    first, concurrent = await asyncio.gather(
        api.post(path, headers=headers, json=entry),
        api.post(path, headers=headers, json=entry),
    )
    assert first.json() == concurrent.json()
    assert first.status_code == 200
    meetup = first.json()
    assert (await api.post(path, headers=headers, json=entry)).json() == meetup
    assert (
        await api.post(path, headers=headers, json={**entry, "note": "changed"})
    ).status_code == 409
    assert (
        await api.post(path, headers=foreign, json={**entry, "request_id": str(uuid4())})
    ).status_code == 404
    assert (
        await api.post(path, headers=headers, json={**entry, "completed_on": "2999-01-01"})
    ).status_code == 422
    assert (await api.get("/api/people", headers=headers)).json()[0]["last_seen"] == "2020-02-29"
    edit_path = "/api/meetups/" + meetup["id"]
    change = {"completed_on": "2020-03-01", "note": "Corrected", "revision": 1}
    assert (await api.put(edit_path, headers=headers, json=change)).status_code == 200
    assert (await api.put(edit_path, headers=headers, json=change)).status_code == 409
    assert (await api.delete(edit_path + "?revision=1", headers=headers)).status_code == 409
    older = await api.post(
        path,
        headers=headers,
        json={**entry, "request_id": str(uuid4()), "completed_on": "2019-01-01"},
    )
    assert older.status_code == 200
    assert (await api.delete(edit_path + "?revision=2", headers=headers)).status_code == 200
    assert (await api.get("/api/people", headers=headers)).json()[0]["last_seen"] == "2019-01-01"
    # A delayed retry after editing/deletion cannot resurrect stale content.
    assert (await api.post(path, headers=headers, json=entry)).status_code == 409
    assert len((await api.get(path, headers=headers)).json()) == 1
    with httpx.Client(base_url=data_url, timeout=10) as data:
        own = {**headers, "apikey": public_key}
        other = {**foreign, "apikey": public_key}
        for table in ("people", "meetups", "meetup_requests"):
            assert data.get("/" + table, headers={"apikey": public_key}).status_code in (401, 403)
            assert data.get("/" + table, headers=other).json() == []
        assert data.post(
            "/meetups", headers=other, json={"person_id": pid, "completed_on": "2020-01-01"}
        ).is_error
        assert data.post(
            "/meetups", headers=own, json={"person_id": pid, "completed_on": "2999-01-01"}
        ).is_error
        assert data.patch(
            "/people", headers=own, params={"id": "eq." + pid}, json={"name": "Bypass"}
        ).is_error
        assert data.patch(
            "/people",
            headers=own,
            params={"id": "eq." + pid},
            json={"owner_id": sessions[1][0], "revision": 2},
        ).is_error
    person_edit = {
        "name": "Synthetic Maya",
        "archived": True,
        "priority": "closest",
        "cadence_count": 6,
        "cadence_unit": "months",
        "revision": (await api.get("/api/people", headers=headers)).json()[0]["revision"],
    }
    assert (
        await api.put("/api/people/" + pid, headers=headers, json=person_edit)
    ).status_code == 200
    assert len((await api.get(path, headers=headers)).json()) == 1
    assert (
        await api.put("/api/people/" + pid, headers=headers, json=person_edit)
    ).status_code == 409
    assert (
        await api.delete(
            "/api/people/" + pid + f"?revision={person_edit['revision'] + 1}", headers=foreign
        )
    ).status_code == 404
    assert (
        await api.delete(
            "/api/people/" + pid + f"?revision={person_edit['revision'] + 1}", headers=headers
        )
    ).status_code == 200
    with httpx.Client(base_url=data_url, timeout=10) as data:
        for table in ("people", "meetups", "meetup_requests"):
            assert data.get("/" + table, headers={**headers, "apikey": public_key}).json() == []
    print(
        "Phase 2 persistence, backdates, retries, conflicts, "
        "archive, cascade and two-user RLS passed."
    )
    from nudge_smoke import exercise_nudges

    await exercise_nudges(api, headers, foreign, public_key, data_url)
