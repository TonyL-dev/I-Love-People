from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ilp.auth.models import AccountProfile, Identity, ProfileUpdate, PublicAuthConfig
from ilp.auth.repository import SupabaseAuthRepository, SupabaseProfileRepository
from ilp.auth.service import (
    AuthenticationFailed,
    AuthenticationUnavailable,
    AuthService,
    InvalidTimezone,
    ProfileService,
    public_config,
    signing_key_verifier,
)
from ilp.infrastructure.settings import get_settings

router = APIRouter(prefix="/api", tags=["account"])
bearer = HTTPBearer(auto_error=False)


def auth_service() -> AuthService:
    settings = get_settings()
    config = public_config(settings)
    if settings.database_url is None:
        raise AuthenticationUnavailable()
    return AuthService(
        signing_key_verifier(settings),
        SupabaseAuthRepository(
            config.url, config.publishable_key, settings.database_url.get_secret_value()
        ),
    )


def identity(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Identity:
    if credentials is None:
        raise HTTPException(401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"})
    try:
        return auth_service().authenticate(credentials.credentials)
    except AuthenticationFailed:
        raise HTTPException(
            401, "Sign in to continue", headers={"WWW-Authenticate": "Bearer"}
        ) from None
    except AuthenticationUnavailable:
        raise HTTPException(503, "Account validation is temporarily unavailable") from None


def profile_service() -> ProfileService:
    try:
        config = public_config(get_settings())
    except AuthenticationUnavailable:
        raise HTTPException(503, "Account service is temporarily unavailable") from None
    return ProfileService(SupabaseProfileRepository(config.url, config.publishable_key))


@router.get("/auth/config", response_model=PublicAuthConfig, operation_id="get_auth_config")
def auth_config() -> PublicAuthConfig:
    try:
        return public_config(get_settings())
    except AuthenticationUnavailable:
        raise HTTPException(503, "Account access is not configured") from None


@router.get("/profile", response_model=AccountProfile, operation_id="get_profile")
def get_profile(
    account: Annotated[Identity, Depends(identity)],
    service: Annotated[ProfileService, Depends(profile_service)],
) -> AccountProfile:
    try:
        return service.read(account)
    except Exception:
        raise HTTPException(503, "Your account could not be loaded. Try again.") from None


@router.put("/profile", response_model=AccountProfile, operation_id="update_profile")
def update_profile(
    update: ProfileUpdate,
    account: Annotated[Identity, Depends(identity)],
    service: Annotated[ProfileService, Depends(profile_service)],
) -> AccountProfile:
    try:
        return service.save(account, update.timezone)
    except InvalidTimezone:
        raise HTTPException(422, "Choose a valid IANA timezone, such as America/Toronto") from None
    except Exception:
        raise HTTPException(503, "Your account could not be saved. Try again.") from None
