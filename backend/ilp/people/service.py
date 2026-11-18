from datetime import datetime
from typing import Any
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from ilp.auth.models import Identity
from ilp.auth.repository import ProfileRepository
from ilp.people.models import Meetup, MeetupInput, Person
from ilp.people.repository import JournalFailure, PeopleRepository


class PeopleService:
    def __init__(self, repository: PeopleRepository, profiles: ProfileRepository) -> None:
        self.repository, self.profiles = repository, profiles

    def people(self, account: Identity) -> list[Person]:
        result = []
        for row in self.repository.people(account):
            dates = [entry["completed_on"] for entry in row.pop("meetups")]
            row["last_seen"] = max(dates, default=None)
            result.append(Person.model_validate(row))
        return result

    def history(self, account: Identity, person: UUID) -> list[Meetup]:
        if not any(p.id == person for p in self.people(account)):
            raise JournalFailure(404)
        return [Meetup.model_validate(row) for row in self.repository.meetups(account, person)]

    def write(
        self,
        account: Identity,
        action: str,
        target: UUID | None,
        revision: int,
        payload: dict[str, Any],
    ) -> Any:
        if action in ("meetup_create", "meetup_edit"):
            meetup = MeetupInput.model_validate({k: payload[k] for k in ("completed_on", "note")})
            timezone = self.profiles.read(account.owner_id, account.token).timezone
            if meetup.completed_on > datetime.now(ZoneInfo(timezone)).date():
                raise JournalFailure(422)
        return self.repository.write(account, action, target or uuid4(), revision, payload)
