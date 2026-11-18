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
    jwt_audience: str = "authenticated"
    jwt_algorithms: tuple[str, ...] = ("ES256", "RS256")


@lru_cache
def get_settings() -> Settings:
    return Settings()
