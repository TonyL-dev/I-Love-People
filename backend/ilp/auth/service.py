import base64
import json
from functools import lru_cache
from typing import Any, Protocol
from urllib.parse import urlsplit
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import jwt

from ilp.auth.models import AccountProfile, Identity, PublicAuthConfig
from ilp.auth.repository import AuthRepository, ProfileRepository, ProviderIdentityRejected
from ilp.infrastructure.settings import Settings


class AuthenticationFailed(Exception):
    pass


class AuthenticationUnavailable(Exception):
    pass


class InvalidTimezone(Exception):
    pass


def public_config(settings: Settings) -> PublicAuthConfig:
    url, key = settings.supabase_url, settings.supabase_publishable_key
    if not url or not key:
        raise AuthenticationUnavailable()
    parsed = urlsplit(url)
    secure = parsed.scheme == "https" and bool(parsed.hostname)
    local = (
        settings.environment != "production"
        and parsed.scheme == "http"
        and parsed.hostname == "127.0.0.1"
        and parsed.port is not None
    )
    if (
        not (secure or local)
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise AuthenticationUnavailable()
    if parsed.path not in ("", "/"):
        raise AuthenticationUnavailable()
    # Reject accidental privileged-key configuration before a browser sees it.
    if not key.startswith("sb_publishable_"):
        try:
            payload = json.loads(base64.urlsafe_b64decode(key.split(".")[1] + "=="))
            if payload.get("role") != "anon":
                raise ValueError()
        except Exception:
            raise AuthenticationUnavailable() from None
    return PublicAuthConfig(
        url=url.rstrip("/"), publishable_key=key, signup_enabled=settings.signup_enabled
    )


class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict[str, Any]: ...


class SigningKeyVerifier:
    def __init__(self, settings: Settings) -> None:
        config = public_config(settings)
        self._settings = settings
        self._issuer = config.url + "/auth/v1"
        self._keys = jwt.PyJWKClient(
            self._issuer + "/.well-known/jwks.json",
            timeout=8,
            lifespan=60,
        )

    def verify(self, token: str) -> dict[str, Any]:
        try:
            header = jwt.get_unverified_header(token)
            if header.get("alg") not in self._settings.jwt_algorithms or not header.get("kid"):
                raise AuthenticationFailed()
            key = self._keys.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                key.key,
                algorithms=list(self._settings.jwt_algorithms),
                issuer=self._issuer,
                audience=self._settings.jwt_audience,
                # Provider and API clocks can differ slightly. Keep this bounded;
                # live account/session checks still enforce immediate revocation.
                leeway=5,
                options={"require": ["sub", "exp", "iat", "iss", "aud", "session_id", "role"]},
            )
        except jwt.PyJWKClientConnectionError:
            raise AuthenticationUnavailable() from None
        except jwt.PyJWTError:
            raise AuthenticationFailed() from None


@lru_cache(maxsize=4)
def signing_key_verifier(settings: Settings) -> SigningKeyVerifier:
    return SigningKeyVerifier(settings)


class AuthService:
    def __init__(self, verifier: TokenVerifier, repository: AuthRepository) -> None:
        self._verifier, self._repository = verifier, repository

    def authenticate(self, token: str) -> Identity:
        if not token or len(token) > 8192:
            raise AuthenticationFailed()
        claims = self._verifier.verify(token)
        try:
            if claims["role"] != "authenticated":
                raise ValueError()
            owner, session = UUID(claims["sub"]), UUID(claims["session_id"])
        except (KeyError, TypeError, ValueError):
            raise AuthenticationFailed() from None
        try:
            email = self._repository.current_email(token, owner)
            if not self._repository.session_active(owner, session):
                raise AuthenticationFailed()
        except AuthenticationFailed:
            raise
        except ProviderIdentityRejected:
            raise AuthenticationFailed() from None
        except Exception:
            raise AuthenticationUnavailable() from None
        return Identity(owner_id=owner, session_id=session, email=email, token=token)


class ProfileService:
    def __init__(self, repository: ProfileRepository) -> None:
        self._repository = repository

    def read(self, identity: Identity) -> AccountProfile:
        return self._repository.read(identity.owner_id, identity.token)

    def save(self, identity: Identity, timezone: str) -> AccountProfile:
        try:
            ZoneInfo(timezone)
        except (ZoneInfoNotFoundError, ValueError):
            raise InvalidTimezone() from None
        return self._repository.save(identity.owner_id, identity.token, timezone)
