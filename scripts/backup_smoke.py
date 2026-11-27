"""Drill portable backup and deletion with disposable accounts on a configured API."""

import asyncio
import secrets
from copy import deepcopy
from uuid import uuid4

import httpx
from sqlalchemy import create_engine, text


async def exercise_backup(
    api: httpx.AsyncClient,
    auth: httpx.Client,
    data: httpx.Client,
    public_key: str,
    admin: dict[str, str],
    ids: list[str],
    emails: set[str],
    database_url: str,
) -> None:
    def create_account() -> tuple[dict[str, str], str]:
        email = f"ilp-backup-{uuid4().hex[:12]}@example.test"
        password = secrets.token_urlsafe(32) + "aA1"
        emails.add(email)
        created = auth.post(
            "/admin/users",
            headers=admin,
            json={"email": email, "password": password, "email_confirm": True},
        )
        created.raise_for_status()
        ids.append(created.json()["id"])
        sign_in = auth.post(
            "/token?grant_type=password",
            headers={"apikey": public_key},
            json={"email": email, "password": password},
        )
        sign_in.raise_for_status()
        return {"Authorization": "Bearer " + sign_in.json()["access_token"]}, password

    source, password = create_account()
    target, other_password = create_account()
    backup_url = "/api/privacy/backup"
    preview_url = "/api/privacy/restore/preview"
    restore_url = "/api/privacy/restore"
    delete_url = "/api/privacy/delete-all"
    assert (await api.get(backup_url)).status_code == 401
    assert data.post("/rpc/backup_export", headers={"apikey": public_key}, json={}).is_error
    assert data.post(
        "/rpc/backup_export_with_plans", headers={"apikey": public_key}, json={}
    ).is_error
    assert data.post("/rpc/backup_begin_delete", headers={"apikey": public_key}, json={}).is_error
    assert (
        await api.put("/api/profile", headers=source, json={"timezone": "America/Toronto"})
    ).is_success
    created = await api.post(
        "/api/people",
        headers=source,
        json={
            "name": "Synthetic backup Maya",
            "priority": "closest",
            "cadence_count": 2,
            "cadence_unit": "weeks",
            "archived": True,
            "next_scheduled_on": "2099-11-26",
        },
    )
    created.raise_for_status()
    pid = created.json()["id"]
    for day in ("2020-02-28", "2020-02-29"):
        meetup = await api.post(
            f"/api/people/{pid}/meetups",
            headers=source,
            json={"completed_on": day, "note": "Synthetic note 🗓", "request_id": str(uuid4())},
        )
        assert meetup.is_success
    revision = (await api.get("/api/people", headers=source)).json()[0]["revision"]
    assert (
        await api.put(
            f"/api/people/{pid}/nudge",
            headers=source,
            json={"action": "pause", "revision": revision},
        )
    ).is_success
    response = await api.get(backup_url, headers=source)
    response.raise_for_status()
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["content-disposition"].startswith("attachment;")
    backup = response.json()
    assert set(backup) == {"version", "timezone", "people", "meetups"}
    assert backup["timezone"] == "America/Toronto"
    assert len(backup["people"]) == 1 and len(backup["meetups"]) == 2
    assert backup["people"][0]["archived"] and backup["people"][0]["paused"]
    assert backup["people"][0]["next_scheduled_on"] == "2099-11-26"
    legacy = deepcopy(backup)
    del legacy["people"][0]["next_scheduled_on"]
    assert (await api.post(preview_url, headers=target, json=legacy)).is_success
    assert all(set(row) == {"id", "person_id", "completed_on", "note"} for row in backup["meetups"])
    assert all(mark not in response.text for mark in (*ids[-2:], password, other_password))
    assert (await api.get(backup_url, headers=target)).json() == {
        "version": 1,
        "timezone": "UTC",
        "people": [],
        "meetups": [],
    }

    wrong_parent = deepcopy(backup)
    wrong_parent["meetups"][0]["person_id"] = str(uuid4())
    owner_injection = {**backup, "owner_id": ids[-2]}
    future = deepcopy(backup)
    future["meetups"][0]["completed_on"] = "2999-01-01"
    for invalid in (wrong_parent, owner_injection, future, {**backup, "version": 2}):
        result = await api.post(preview_url, headers=target, json=invalid)
        assert result.status_code == 422 and "Synthetic note" not in result.text
    assert (await api.post(delete_url, headers=source, content=b" " * 8193)).status_code == 413
    assert data.post(
        "/rpc/backup_restore",
        headers={**target, "apikey": public_key},
        json={"backup": wrong_parent, "expected_timezone": "UTC"},
    ).is_error
    assert (await api.get("/api/people", headers=target)).json() == []
    assert (await api.get("/api/profile", headers=target)).json()["timezone"] == "UTC"

    preview = (await api.post(preview_url, headers=target, json=backup)).json()
    assert preview["current_people"] == 0 and preview["people"] == 1 and preview["meetups"] == 2
    apply = {"backup": backup, "preview_token": preview["preview_token"]}
    assert (await api.post(restore_url, headers=source, json=apply)).status_code == 409
    assert (
        await api.put("/api/profile", headers=target, json={"timezone": "Europe/Paris"})
    ).is_success
    assert (await api.post(restore_url, headers=target, json=apply)).status_code == 409
    assert (await api.put("/api/profile", headers=target, json={"timezone": "UTC"})).is_success
    assert (
        await api.post(
            restore_url,
            headers=target,
            json={
                **apply,
                "backup": {**backup, "timezone": "Europe/Paris"},
            },
        )
    ).status_code == 409
    outcomes = await asyncio.gather(
        *(api.post(restore_url, headers=target, json=apply) for _ in range(2))
    )
    assert sorted(response.status_code for response in outcomes) == [204, 409]
    conflict = await api.post(preview_url, headers=target, json=backup)
    assert conflict.json()["current_people"] == 1
    restored = (await api.get(backup_url, headers=target)).json()
    original_person = backup["people"][0]
    new_person = restored["people"][0]
    assert original_person["id"] != new_person["id"]
    assert {**new_person, "id": original_person["id"]} == original_person
    assert restored["timezone"] == backup["timezone"]
    assert all(row["person_id"] == new_person["id"] for row in restored["meetups"])
    assert sorted((m["completed_on"], m["note"]) for m in backup["meetups"]) == sorted(
        (m["completed_on"], m["note"]) for m in restored["meetups"]
    )

    malformed = await api.post(delete_url, headers=source, json={"password": password})
    assert malformed.status_code == 422 and password not in malformed.text
    wrong = await api.post(
        delete_url,
        headers=source,
        json={"password": other_password, "confirmation": "DELETE"},
    )
    assert wrong.status_code == 403 and other_password not in wrong.text
    assert (await api.get(backup_url, headers=source)).json() == backup
    prior = {**source, "apikey": public_key}
    challenge = data.post("/rpc/backup_begin_delete", headers=prior, json={})
    challenge.raise_for_status()
    for caller in (prior, {**target, "apikey": public_key}):
        assert (
            data.post(
                "/rpc/backup_delete_all", headers=caller, json={"challenge": challenge.json()}
            ).status_code
            == 403
        )

    engine = create_engine(database_url, hide_parameters=True)
    try:
        with engine.begin() as connection:
            device = connection.execute(
                text("""
                    INSERT INTO ilp_private.push_devices(owner_id, quiet_start, quiet_end)
                    VALUES(:owner, 60, 120) RETURNING id
                """),
                {"owner": ids[-2]},
            ).scalar_one()
            connection.execute(
                text("""
                    INSERT INTO ilp_private.push_deliveries
                        (device_id, local_day, attempts, lease_token, ready_after, outcome)
                    VALUES(:device, CURRENT_DATE, 1, gen_random_uuid(), now(), 'sent')
                """),
                {"device": device},
            )
        deleted = await api.post(
            delete_url, headers=source, json={"password": password, "confirmation": "DELETE"}
        )
        assert deleted.status_code == 204
        with engine.connect() as connection:
            for table, column in (("push_devices", "id"), ("push_deliveries", "device_id")):
                assert not connection.execute(
                    text(f"SELECT 1 FROM ilp_private.{table} WHERE {column} = :device"),
                    {"device": device},
                ).first()
    finally:
        engine.dispose()
    assert (await api.get(backup_url, headers=source)).json() == {
        "version": 1,
        "timezone": "UTC",
        "people": [],
        "meetups": [],
    }
    assert (await api.get(backup_url, headers=target)).json() == restored
    assert data.get("/meetup_requests", headers={**source, "apikey": public_key}).json() == []
    auth.post("/logout?scope=global", headers={**source, "apikey": public_key}).raise_for_status()
    assert (await api.get(backup_url, headers=source)).status_code == 401
    assert data.post(
        "/rpc/backup_export", headers={**source, "apikey": public_key}, json={}
    ).is_error
    print(
        "Portable export, fresh-account restore, conflicts, reauthentication and isolation passed."
    )
