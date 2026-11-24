from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ILP_", env_file=".env", extra="ignore", frozen=True
    )

    environment: Literal["development", "test", "production"] = "development"
    database_url: SecretStr | None = None
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    signup_enabled: bool = False
    jwt_audience: str = "authenticated"
    jwt_algorithms: tuple[str, ...] = ("ES256", "RS256")
    push_private_key: SecretStr | None = None
    push_subject: str | None = None
    push_job_secret: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
