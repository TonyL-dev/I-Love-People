from typing import Protocol
from uuid import UUID

import httpx
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool

from ilp.auth.models import AccountProfile


class AuthRepository(Protocol):
    def current_email(self, token: str, owner: UUID) -> str: ...
    def session_active(self, owner: UUID, session: UUID) -> bool: ...


class ProviderIdentityRejected(Exception):
    pass


class SupabaseAuthRepository:
    def __init__(self, url: str, key: str, database_url: str) -> None:
        self._url, self._key, self._database_url = url, key, database_url

    def current_email(self, token: str, owner: UUID) -> str:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.get(
                self._url + "/auth/v1/user",
                headers={"apikey": self._key, "Authorization": "Bearer " + token},
            )
            if response.status_code in (401, 403):
                raise ProviderIdentityRejected()
            response.raise_for_status()
            user = response.json()
        if user.get("id") != str(owner) or not isinstance(user.get("email"), str):
            raise ValueError("Identity validation failed")
        return str(user["email"])

    def session_active(self, owner: UUID, session: UUID) -> bool:
        # Auth owns these tables. This server-only lookup never modifies them and
        # closes the provider's access-token-after-logout window for protected APIs.
        engine = create_engine(
            self._database_url,
            poolclass=NullPool,
            hide_parameters=True,
            connect_args={"connect_timeout": 5},
        )
        try:
            with engine.connect() as connection:
                return bool(
                    connection.execute(
                        text("""
                    SELECT EXISTS (
                        SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id = s.user_id
                        WHERE s.id = :session AND s.user_id = :owner
                        AND (s.not_after IS NULL OR s.not_after > now())
                        AND u.deleted_at IS NULL
                        AND (u.banned_until IS NULL OR u.banned_until <= now())
                    )
                """),
                        {"session": session, "owner": owner},
                    ).scalar_one()
                )
        finally:
            engine.dispose()


class ProfileRepository(Protocol):
    def read(self, owner: UUID, token: str) -> AccountProfile: ...
    def save(self, owner: UUID, token: str, timezone: str) -> AccountProfile: ...


class SupabaseProfileRepository:
    def __init__(self, url: str, key: str) -> None:
        self._url, self._key = url, key

    def _headers(self, token: str) -> dict[str, str]:
        return {"apikey": self._key, "Authorization": "Bearer " + token}

    def read(self, owner: UUID, token: str) -> AccountProfile:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.get(
                self._url + "/rest/v1/profiles",
                headers=self._headers(token),
                params={"owner_id": "eq." + str(owner), "select": "owner_id,timezone"},
            )
            response.raise_for_status()
            rows = response.json()
        if not rows:
            return AccountProfile(owner_id=owner)
        profile = AccountProfile.model_validate(rows[0])
        if profile.owner_id != owner:
            raise ValueError("Profile ownership mismatch")
        return profile

    def save(self, owner: UUID, token: str, timezone: str) -> AccountProfile:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.post(
                self._url + "/rest/v1/profiles",
                headers={
                    **self._headers(token),
                    "Prefer": "resolution=merge-duplicates,return=representation",
                },
                params={"on_conflict": "owner_id", "select": "owner_id,timezone"},
                json={"owner_id": str(owner), "timezone": timezone},
            )
            response.raise_for_status()
            rows = response.json()
        profile = AccountProfile.model_validate(rows[0])
        if profile.owner_id != owner:
            raise ValueError("Profile ownership mismatch")
        return profile
