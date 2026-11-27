import asyncio
import time
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch
from uuid import UUID

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from ilp.auth.models import AccountProfile
from ilp.auth.router import profile_service
from ilp.auth.service import (
    AuthenticationFailed,
    AuthenticationUnavailable,
    AuthService,
    InvalidTimezone,
    ProfileService,
    SigningKeyVerifier,
    public_config,
)
from ilp.infrastructure.settings import Settings
from ilp.main import create_app

OWNER = UUID("11111111-1111-4111-8111-111111111111")
OTHER = UUID("22222222-2222-4222-8222-222222222222")
SESSION = UUID("33333333-3333-4333-8333-333333333333")
SETTINGS = Settings(
    supabase_url="https://preview.example", supabase_publishable_key="sb_publishable_synthetic"
)


def claims() -> dict[str, Any]:
    return {
        "sub": str(OWNER),
        "session_id": str(SESSION),
        "role": "authenticated",
        "iss": "https://preview.example/auth/v1",
        "aud": "authenticated",
        "iat": int(time.time()) - 10,
        "exp": int(time.time()) + 60,
    }


@pytest.mark.parametrize(
    "change",
    [
        "valid",
        "small-clock-skew",
        "future-issued",
        "expired",
        "issuer",
        "audience",
        "missing-exp",
        "signature",
        "algorithm",
    ],
)
def test_jwt_validation_enforces_cryptographic_and_registered_claims(change: str) -> None:
    key = ec.generate_private_key(ec.SECP256R1())
    payload = claims()
    if change == "expired":
        payload["exp"] = int(time.time()) - 10
    if change == "small-clock-skew":
        payload["iat"] = int(time.time()) + 2
    if change == "future-issued":
        payload["iat"] = int(time.time()) + 60
    if change == "issuer":
        payload["iss"] = "https://attacker.example/auth/v1"
    if change == "audience":
        payload["aud"] = "other-service"
    if change == "missing-exp":
        del payload["exp"]
    token = jwt.encode(payload, key, algorithm="ES256", headers={"kid": "synthetic"})
    if change == "algorithm":
        token = jwt.encode(
            payload,
            "synthetic-secret-material-for-tests-only-32-bytes",
            algorithm="HS256",
            headers={"kid": "synthetic"},
        )
    verifier = SigningKeyVerifier(SETTINGS)
    public = (
        ec.generate_private_key(ec.SECP256R1()).public_key()
        if change == "signature"
        else key.public_key()
    )
    with patch.object(
        verifier._keys, "get_signing_key_from_jwt", return_value=SimpleNamespace(key=public)
    ):
        if change in ("valid", "small-clock-skew"):
            assert verifier.verify(token)["sub"] == str(OWNER)
        else:
            with pytest.raises(AuthenticationFailed):
                verifier.verify(token)


class SyntheticVerifier:
    def __init__(self, payload: dict[str, Any] | None = None) -> None:
        self.payload = claims() if payload is None else payload

    def verify(self, token: str) -> dict[str, Any]:
        return self.payload


class SyntheticAuthRepository:
    def __init__(self, active: bool = True, fail: bool = False) -> None:
        self.active, self.fail = active, fail

    def current_email(self, token: str, owner: UUID) -> str:
        if self.fail:
            raise RuntimeError("synthetic-sensitive-provider-message")
        return "synthetic@example.test"

    def session_active(self, owner: UUID, session: UUID) -> bool:
        assert owner == OWNER and session == SESSION
        return self.active


@pytest.mark.parametrize(
    "change", ["missing-session", "invalid-owner", "wrong-role", "revoked", "oversized"]
)
def test_auth_rejects_invalid_identity_and_revoked_sessions(change: str) -> None:
    payload = claims()
    if change == "missing-session":
        del payload["session_id"]
    if change == "invalid-owner":
        payload["sub"] = "not-an-id"
    if change == "wrong-role":
        payload["role"] = "service_role"
    service = AuthService(
        SyntheticVerifier(payload), SyntheticAuthRepository(active=change != "revoked")
    )
    with pytest.raises(AuthenticationFailed):
        service.authenticate("x" * 8193 if change == "oversized" else "synthetic-token")


def test_provider_outage_fails_closed_without_echoing_errors() -> None:
    with pytest.raises(AuthenticationUnavailable) as failure:
        AuthService(SyntheticVerifier(), SyntheticAuthRepository(fail=True)).authenticate(
            "synthetic-token"
        )
    assert "sensitive" not in str(failure.value)


@pytest.mark.parametrize(
    "key",
    [
        "sb_secret_must-not-leak",
        "not-a-key",
        jwt.encode(
            {"role": "service_role"},
            "synthetic-secret-material-for-tests-only-32-bytes",
            algorithm="HS256",
        ),
    ],
)
def test_public_config_never_returns_privileged_or_malformed_keys(key: str) -> None:
    with pytest.raises(AuthenticationUnavailable):
        public_config(
            Settings(supabase_url="https://preview.example", supabase_publishable_key=key)
        )


def test_alternate_loopback_auth_port_works_in_development_and_fails_in_production() -> None:
    url = "http://127.0.0.1:55421"
    settings = Settings(
        environment="development",
        supabase_url=url,
        supabase_publishable_key="sb_publishable_synthetic",
    )
    assert public_config(settings).url == url
    with pytest.raises(AuthenticationUnavailable):
        public_config(settings.model_copy(update={"environment": "production"}))


class SyntheticProfiles:
    def __init__(self) -> None:
        self.saved: list[tuple[UUID, str]] = []

    def read(self, owner: UUID, token: str) -> AccountProfile:
        return AccountProfile(owner_id=owner)

    def save(self, owner: UUID, token: str, timezone: str) -> AccountProfile:
        self.saved.append((owner, timezone))
        return AccountProfile(owner_id=owner, timezone=timezone)


def test_http_boundary_requires_auth_and_derives_ownership() -> None:
    async def run() -> None:
        app = create_app()
        repository = SyntheticProfiles()
        app.dependency_overrides[profile_service] = lambda: ProfileService(repository)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            assert (await client.get("/api/profile")).status_code == 401
            with patch(
                "ilp.auth.router.auth_service",
                return_value=AuthService(SyntheticVerifier(), SyntheticAuthRepository()),
            ):
                headers = {"Authorization": "Bearer synthetic-token"}
                response = await client.put(
                    "/api/profile", headers=headers, json={"timezone": "America/Toronto"}
                )
                assert response.status_code == 200
                assert response.json()["owner_id"] == str(OWNER)
                assert response.headers["cache-control"] == "no-store"
                assert repository.saved == [(OWNER, "America/Toronto")]
                response = await client.put(
                    "/api/profile",
                    headers=headers,
                    json={"timezone": "UTC", "owner_id": str(OTHER)},
                )
                assert response.status_code == 422
                assert len(repository.saved) == 1

    asyncio.run(run())


def test_invalid_timezone_never_reaches_repository() -> None:
    repository = SyntheticProfiles()
    identity = AuthService(SyntheticVerifier(), SyntheticAuthRepository()).authenticate(
        "synthetic-token"
    )
    with pytest.raises(InvalidTimezone):
        ProfileService(repository).save(identity, "../not-a-timezone")
    assert repository.saved == []
