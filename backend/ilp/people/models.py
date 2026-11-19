from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PersonInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=120)
    priority: Literal["closest", "close", "occasional", "distant"] | None = None
    cadence_count: int | None = Field(default=None, ge=1, le=365)
    cadence_unit: Literal["days", "weeks", "months"] | None = None
    archived: bool = False

    @model_validator(mode="after")
    def paired_cadence(self) -> "PersonInput":
        if (self.cadence_count is None) != (self.cadence_unit is None):
            raise ValueError("Choose both a cadence count and unit")
        return self


class Person(PersonInput):
    model_config = ConfigDict(extra="ignore")
    id: UUID
    revision: int
    created_at: datetime
    updated_at: datetime
    last_seen: date | None = None
    paused: bool = False
    snoozed_until: date | None = None
    dismissed_on: date | None = None
    due_on: date | None = None
    eligible_on: date | None = None
    timing: Literal["now", "soon", "later", "unknown"] = "unknown"
    suppression: Literal["archived", "paused", "snoozed", "dismissed"] | None = None
    reason: str = "No meetup logged"


class NudgeEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=1)
    action: Literal["snooze", "unsnooze", "dismiss", "undismiss", "pause", "unpause"]
    until: date | None = None


class PersonEdit(PersonInput):
    revision: int = Field(ge=1)


class MeetupInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    completed_on: date
    note: str = Field(default="", max_length=2000)


class MeetupCreate(MeetupInput):
    request_id: UUID


class MeetupEdit(MeetupInput):
    revision: int = Field(ge=1)


class Meetup(MeetupInput):
    model_config = ConfigDict(extra="ignore")
    id: UUID
    person_id: UUID
    revision: int
    created_at: datetime
    updated_at: datetime
