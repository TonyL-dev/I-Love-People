from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PublicAuthConfig(BaseModel):
    url: str
    publishable_key: str
    minimum_password_length: int = 12


class Identity(BaseModel):
    owner_id: UUID
    session_id: UUID
    email: str
    token: str = Field(repr=False, exclude=True)


class AccountProfile(BaseModel):
    owner_id: UUID
    timezone: str = "UTC"


class ProfileUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    timezone: str = Field(min_length=1, max_length=64)
