"""Verify device privacy and scheduled delivery against real local Postgres."""

import asyncio
import secrets
from base64 import urlsafe_b64encode
from datetime import datetime
from unittest.mock import patch
from uuid import uuid4
from zoneinfo import ZoneInfo

import httpx
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from ilp.infrastructure.settings import get_settings
from ilp.push.repository import PushRepository
from ilp.push.transport import WebPushTransport
from sqlalchemy import text


def encode(value: bytes) -> str:
    return urlsafe_b64encode(value).decode().rstrip("=")


async def exercise_push(
    api: httpx.AsyncClient,
    sessions: list[tuple[str, str]],
    public_key: str,
    data_url: str,
) -> None:
    own, foreign = ({"Authorization": "Bearer " + token} for _, token in sessions)
    database_url = get_settings().database_url
    assert database_url
    repo = PushRepository(database_url.get_secret_value())

    async def due_person(headers: dict[str, str], name: str, priority: str) -> str:
        person = await api.post(
            "/api/people",
            headers=headers,
            json={"name": name, "priority": priority, "cadence_count": 1, "cadence_unit": "months"},
        )
        person.raise_for_status()
        pid = str(person.json()["id"])
        (
            await api.post(
                f"/api/people/{pid}/meetups",
                headers=headers,
                json={"completed_on": "2020-01-31", "request_id": str(uuid4())},
            )
        ).raise_for_status()
        return pid

    async def reset_check() -> None:
        with repo.transaction() as db:
            db.execute(
                text("UPDATE ilp_private.push_devices SET next_check = now() WHERE owner_id = :id"),
                {"id": sessions[0][0]},
            )

    pid = await due_person(own, "Synthetic push Maya", "closest")
    private_key = ec.generate_private_key(ec.SECP256R1())
    scalar = private_key.private_numbers().private_value.to_bytes(32, "big")
    public = private_key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    endpoint = {"endpoint": f"https://fcm.googleapis.com/wp/synthetic-{uuid4().hex}"}
    local = datetime.now(ZoneInfo("America/Toronto"))
    current_minute = local.hour * 60 + local.minute
    device = {
        **endpoint,
        "p256dh": encode(public),
        "auth": encode(secrets.token_bytes(16)),
        "quiet_start": (current_minute + 120) % 1440,
        "quiet_end": (current_minute + 240) % 1440,
    }
    job_secret = secrets.token_urlsafe(40)
    job_auth = {"Authorization": "Bearer " + job_secret}
    env = {
        "ILP_PUSH_PRIVATE_KEY": encode(scalar),
        "ILP_PUSH_SUBJECT": "mailto:synthetic@example.test",
        "ILP_PUSH_JOB_SECRET": job_secret,
    }
    try:
        with patch.dict("os.environ", env):
            get_settings.cache_clear()
            assert (await api.get("/api/push/config", headers=own)).json() == {
                "public_key": encode(public)
            }
            assert (await api.post("/api/push/job", headers=own)).status_code == 401
            assert (await api.post("/api/push/status", json=endpoint)).status_code == 401
            invalid = await api.put(
                "/api/push/device",
                headers=own,
                json={**device, "endpoint": "https://example.test/synthetic-private"},
            )
            assert invalid.status_code == 422 and "synthetic-private" not in invalid.text
            saved = await api.put("/api/push/device", headers=own, json=device)
            assert saved.status_code == 200
            assert saved.json() == {
                "quiet_start": device["quiet_start"],
                "quiet_end": device["quiet_end"],
                "show_name": False,
            }
            assert (
                await api.put("/api/push/device", headers=foreign, json=device)
            ).status_code == 409
            assert (
                await api.post("/api/push/status", headers=foreign, json=endpoint)
            ).json() is None
            assert (
                await api.post("/api/push/unsubscribe", headers=foreign, json=endpoint)
            ).status_code == 204
            assert (
                await api.post("/api/push/status", headers=own, json=endpoint)
            ).json() == saved.json()

            with httpx.Client(base_url=data_url, timeout=5, trust_env=False) as data:
                headers = {"apikey": public_key, **own, "Accept-Profile": "ilp_private"}
                for table in ("push_devices", "push_deliveries", "person_push_deliveries"):
                    assert data.get("/" + table, headers=headers).is_error

            async def nudge(action: str) -> None:
                people = (await api.get("/api/people", headers=own)).json()
                item = next(person for person in people if person["id"] == pid)
                response = await api.put(
                    f"/api/people/{pid}/nudge",
                    headers=own,
                    json={"action": action, "revision": item["revision"]},
                )
                assert response.status_code == 200

            async def job() -> httpx.Response:
                return await api.post("/api/push/job", headers=job_auth)

            async def plan(day: str | None) -> None:
                people = (await api.get("/api/people", headers=own)).json()
                item = next(person for person in people if person["id"] == pid)
                body = {
                    key: item[key]
                    for key in (
                        "name",
                        "priority",
                        "cadence_count",
                        "cadence_unit",
                        "archived",
                        "revision",
                    )
                }
                body["next_scheduled_on"] = day
                assert (
                    await api.put(f"/api/people/{pid}", headers=foreign, json=body)
                ).status_code == 404
                saved = await api.put(f"/api/people/{pid}", headers=own, json=body)
                assert saved.is_success and saved.json()["next_scheduled_on"] == day

            with patch.object(WebPushTransport, "send", return_value="sent") as send:
                await nudge("pause")
                assert (await job()).json()["sent"] == 0
                send.assert_not_called()
                await nudge("unpause")
                await plan(local.date().isoformat())
                await reset_check()
                assert (await job()).json()["sent"] == 0
                send.assert_not_called()
                await plan("2099-01-01")
                await reset_check()
                assert (await job()).json()["sent"] == 0
                send.assert_not_called()
                await plan(None)
                await reset_check()
                one, two = await asyncio.gather(job(), job())
                assert one.status_code == two.status_code == 200
                assert one.json()["sent"] + two.json()["sent"] == 1
                send.assert_called_once()
                assert send.call_args.args[2] is None
                await reset_check()
                assert (await job()).json()["sent"] == 0
                send.assert_called_once()

            await api.post("/api/push/unsubscribe", headers=own, json=endpoint)
            assert (await api.post("/api/push/status", headers=own, json=endpoint)).json() is None
            await plan("2020-02-01")
            await due_person(own, "Synthetic push Aaron", "distant")
            await due_person(foreign, "A foreign synthetic person", "closest")
            named = {**device, "endpoint": endpoint["endpoint"] + "-named", "show_name": True}
            named_endpoint = {"endpoint": named["endpoint"]}
            assert (await api.put("/api/push/device", headers=own, json=named)).json()["show_name"]
            assert (
                await api.post("/api/push/status", headers=foreign, json=named_endpoint)
            ).json() is None
            legacy = {key: value for key, value in named.items() if key != "show_name"}
            assert (await api.put("/api/push/device", headers=own, json=legacy)).json()["show_name"]
            with patch.object(WebPushTransport, "send", return_value="sent") as send:
                assert (await job()).json()["sent"] == 2
                assert [call.args[2] for call in send.call_args_list] == [
                    "Synthetic push Maya",
                    "Synthetic push Aaron",
                ]
                assert len({call.args[3] for call in send.call_args_list}) == 2
                await reset_check()
                assert (await job()).json()["sent"] == 0
                assert send.call_count == 2
            assert (
                await api.post("/api/push/unsubscribe", headers=own, json=named_endpoint)
            ).status_code == 204
            assert (await api.put("/api/push/device", headers=own, json=legacy)).json()[
                "show_name"
            ] is False
            assert (
                await api.post("/api/push/unsubscribe", headers=own, json=named_endpoint)
            ).status_code == 204

            opt_out = {**named, "endpoint": endpoint["endpoint"] + "-opt-out"}
            assert (await api.put("/api/push/device", headers=own, json=opt_out)).json()[
                "show_name"
            ] is True
            assert (
                await api.put("/api/push/device", headers=own, json={**opt_out, "show_name": False})
            ).json()["show_name"] is False
            with patch.object(WebPushTransport, "send", return_value="sent") as send:
                assert (await job()).json()["sent"] == 2
                assert [call.args[2] for call in send.call_args_list] == [None, None]
                assert len({call.args[3] for call in send.call_args_list}) == 2
            assert (
                await api.post(
                    "/api/push/unsubscribe", headers=own, json={"endpoint": opt_out["endpoint"]}
                )
            ).status_code == 204

            with patch.object(WebPushTransport, "send", return_value="revoked") as send:
                assert (await job()).json()["sent"] == 0
                send.assert_not_called()
                revoked = {**device, "endpoint": endpoint["endpoint"] + "-revoked"}
                assert (
                    await api.put("/api/push/device", headers=own, json=revoked)
                ).status_code == 200
                assert (await job()).json()["revoked"] == 1
                send.assert_called_once()
                status = await api.post(
                    "/api/push/status", headers=own, json={"endpoint": revoked["endpoint"]}
                )
                assert status.json() is None

            with repo.transaction() as db:
                for role in ("anon", "authenticated", "service_role"):
                    for table in ("push_devices", "push_deliveries", "person_push_deliveries"):
                        assert not db.execute(
                            text(
                                "SELECT has_table_privilege("
                                ":role, :table, 'SELECT, INSERT, UPDATE, DELETE')"
                            ),
                            {"role": role, "table": f"ilp_private.{table}"},
                        ).scalar_one()
                outcomes = (
                    db.execute(
                        text("""
                    SELECT r.outcome FROM ilp_private.person_push_deliveries r
                    JOIN ilp_private.push_devices d ON d.id = r.device_id
                    WHERE d.owner_id = :owner
                """),
                        {
                            "owner": sessions[0][0],
                        },
                    )
                    .scalars()
                    .all()
                )
                assert "sent" in outcomes and "revoked" in outcomes

            retry_device = {**device, "endpoint": endpoint["endpoint"] + "-retry"}
            enabled = await api.put("/api/push/device", headers=own, json=retry_device)
            assert enabled.status_code == 200
            tags: list[set[str]] = []
            with patch.object(WebPushTransport, "send", return_value="retry") as send:
                for expected in ("retry", "retry", "failed"):
                    send.reset_mock()
                    assert (await job()).json()[expected] == 2
                    tags.append({call.args[3] for call in send.call_args_list})
                    assert (await job()).json()["retry"] == 0
                    await reset_check()
                    with repo.transaction() as db:
                        db.execute(
                            text("""
                                UPDATE ilp_private.person_push_deliveries r SET ready_after = now()
                                FROM ilp_private.push_devices d
                                WHERE r.device_id = d.id AND d.owner_id = :owner
                                    AND r.outcome = 'retry'
                            """),
                            {"owner": sessions[0][0]},
                        )
                assert (await job()).json()["retry"] == 0
                assert send.call_count == 2
                assert len(tags[0]) == 2 and tags[0] == tags[1] == tags[2]
    finally:
        get_settings.cache_clear()
