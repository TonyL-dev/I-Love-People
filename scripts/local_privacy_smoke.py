"""Exercise real local managed Auth, API verification, RLS and revocation with two users."""

import asyncio
import secrets
import uuid
from pathlib import Path

import httpx
from ilp.infrastructure.settings import get_settings
from ilp.main import create_app
from local_auth_smoke import AUTH_URL, cleanup_synthetic_data
from local_services import status
from people_smoke import exercise_people


async def exercise(
    public_key: str,
    admin_key: str,
    ids: list[str],
    emails: set[str],
    *,
    auth_url: str = AUTH_URL,
    data_url: str = "http://127.0.0.1:54321/rest/v1",
    admin_headers: dict[str, str] | None = None,
    check_password_policy: bool = False,
) -> None:
    public = {"apikey": public_key}
    admin = admin_headers or {**public, "Authorization": "Bearer " + admin_key}
    sessions: list[tuple[str, str]] = []
    with httpx.Client(base_url=auth_url, timeout=20, trust_env=False) as auth:
        for _ in range(2):
            email = f"ilp-privacy-{uuid.uuid4().hex[:12]}@example.test"
            emails.add(email)
            password = secrets.token_urlsafe(32) + "aA1"
            created = auth.post(
                "/admin/users",
                headers=admin,
                json={"email": email, "password": password, "email_confirm": True},
            )
            created.raise_for_status()
            owner = str(created.json()["id"])
            ids.append(owner)
            signed = auth.post(
                "/token?grant_type=password",
                headers=public,
                json={"email": email, "password": password},
            )
            signed.raise_for_status()
            sessions.append((owner, str(signed.json()["access_token"])))
            if check_password_policy:
                for weak_password in (
                    "aA1",
                    "Abcdefghij1",
                    "lowercase12345",
                    "UPPERCASE12345",
                    "OnlyLettersAbcd",
                ):
                    weak = auth.put(
                        "/user",
                        headers={**public, "Authorization": "Bearer " + sessions[-1][1]},
                        json={"password": weak_password},
                    )
                    assert weak.status_code == 422
                    assert weak.json().get("error_code") == "weak_password"
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=create_app()), base_url="http://test"
        ) as api:
            assert (await api.get("/api/profile")).status_code == 401
            assert (
                await api.get("/api/profile", headers={"Authorization": "Bearer invalid"})
            ).status_code == 401
            for index, (owner, token) in enumerate(sessions):
                headers = {**public, "Authorization": "Bearer " + token}
                timezone = "America/Toronto" if index == 0 else "Europe/Paris"
                saved = await api.put("/api/profile", headers=headers, json={"timezone": timezone})
                if saved.status_code != 200:
                    print(
                        "Profile update HTTP status:",
                        saved.status_code,
                        "validation unavailable:",
                        saved.json().get("detail")
                        == "Account validation is temporarily unavailable",
                    )
                assert saved.status_code == 200
                assert saved.json() == {"owner_id": owner, "timezone": timezone}
                foreign = sessions[1 - index][0]
                assert (
                    await api.put(
                        "/api/profile",
                        headers=headers,
                        json={"owner_id": foreign, "timezone": "UTC"},
                    )
                ).status_code == 422
            await exercise_people(api, sessions, public_key, data_url)
            with httpx.Client(base_url=data_url, timeout=20, trust_env=False) as data:
                assert data.get("/profiles", headers=public).status_code in (401, 403)
                for index, (owner, token) in enumerate(sessions):
                    headers = {**public, "Authorization": "Bearer " + token}
                    own = data.get(
                        "/profiles", headers=headers, params={"select": "owner_id,timezone"}
                    )
                    own.raise_for_status()
                    assert [row["owner_id"] for row in own.json()] == [owner]
                    invalid = data.patch(
                        "/profiles",
                        headers=headers,
                        params={"owner_id": "eq." + owner},
                        json={"timezone": "not/a/timezone"},
                    )
                    assert invalid.status_code == 400
                    foreign = sessions[1 - index][0]
                    assert (
                        data.get(
                            "/profiles", headers=headers, params={"owner_id": "eq." + foreign}
                        ).json()
                        == []
                    )
                    denied = data.post(
                        "/profiles",
                        headers={**headers, "Prefer": "resolution=merge-duplicates"},
                        json={"owner_id": foreign, "timezone": "UTC"},
                    )
                    assert denied.status_code == 403
                    unchanged = data.patch(
                        "/profiles",
                        headers={**headers, "Prefer": "return=representation"},
                        params={"owner_id": "eq." + foreign},
                        json={"timezone": "UTC"},
                    )
                    unchanged.raise_for_status()
                    assert unchanged.json() == []
                owner, token = sessions[0]
                headers = {**public, "Authorization": "Bearer " + token}
                auth.post("/logout?scope=global", headers=headers).raise_for_status()
                assert (await api.get("/api/profile", headers=headers)).status_code == 401
                assert data.get("/profiles", headers=headers).json() == []
                assert (
                    data.post(
                        "/profiles",
                        headers={**headers, "Prefer": "resolution=merge-duplicates"},
                        json={"owner_id": owner, "timezone": "UTC"},
                    ).status_code
                    == 403
                )
                owner, token = sessions[1]
                auth.put(
                    "/admin/users/" + owner, headers=admin, json={"ban_duration": "1h"}
                ).raise_for_status()
                headers = {**public, "Authorization": "Bearer " + token}
                assert (await api.get("/api/profile", headers=headers)).status_code == 401
                assert data.get("/profiles", headers=headers).json() == []


def main() -> int:
    ids: list[str] = []
    emails: set[str] = set()
    admin_headers: dict[str, str] = {}
    result = 0
    try:
        local = status()
        import os

        os.environ["ILP_DATABASE_URL"] = local["DB_URL"].replace(
            "postgresql://", "postgresql+psycopg://", 1
        )
        os.environ["ILP_SUPABASE_URL"] = "http://127.0.0.1:54321"
        os.environ["ILP_SUPABASE_PUBLISHABLE_KEY"] = local["ANON_KEY"]
        get_settings.cache_clear()
        admin_headers = {
            "apikey": local["ANON_KEY"],
            "Authorization": "Bearer " + local["SERVICE_ROLE_KEY"],
        }
        asyncio.run(exercise(local["ANON_KEY"], local["SERVICE_ROLE_KEY"], ids, emails))
        print(
            "Two-user API ownership/RLS, anonymous denial, logout-token rejection "
            "and account-disable checks passed.",
            flush=True,
        )
    except Exception as error:
        import traceback

        print(
            "Failure locations:",
            [
                (Path(frame.filename).name, frame.lineno)
                for frame in traceback.extract_tb(error.__traceback__)
            ],
        )
        print(
            f"Local privacy smoke failed ({type(error).__name__}); "
            "credentials and response bodies withheld."
        )
        result = 1
    finally:
        if ids and not cleanup_synthetic_data(ids, emails, admin_headers):
            print("Privacy-test cleanup incomplete; inspect synthetic local users.")
            result = 1
        elif ids:
            print("Privacy-test users and owned profiles removed.", flush=True)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
