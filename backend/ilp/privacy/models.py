from datetime import date
from typing import Annotated, Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from ilp.people.models import MeetupInput, PersonInput
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

BACKUP_BYTES = 4_000_000


class BackupPerson(PersonInput):
    model_config = ConfigDict(str_strip_whitespace=False)
    id: UUID
    paused: bool
    snoozed_until: date | None
    dismissed_on: date | None


class BackupMeetup(MeetupInput):
    model_config = ConfigDict(str_strip_whitespace=False)
    id: UUID
    person_id: UUID


class Backup(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: Literal[1]
    timezone: Annotated[str, Field(min_length=1, max_length=64)]
    people: list[BackupPerson] = Field(max_length=20_000)
    meetups: list[BackupMeetup] = Field(max_length=20_000)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (KeyError, ValueError):
            raise ValueError("Invalid timezone") from None
        return value

    @model_validator(mode="after")
    def validate_relationships(self) -> "Backup":
        people = {person.id for person in self.people}
        if len(people) != len(self.people) or len({m.id for m in self.meetups}) != len(
            self.meetups
        ):
            raise ValueError("Duplicate record identifier")
        if any(meetup.person_id not in people for meetup in self.meetups):
            raise ValueError("Missing meetup parent")
        return self


class RestorePreview(BaseModel):
    people: int
    meetups: int
    current_people: int
    current_timezone: str
    timezone: str
    preview_token: str


class RestoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    backup: Backup
    # Binds the apply step to the reviewed file and destination timezone.
    preview_token: str = Field(pattern=r"^[0-9a-f]{64}$")


class DeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    confirmation: Literal["DELETE"]
    password: SecretStr = Field(min_length=1, max_length=1024)
