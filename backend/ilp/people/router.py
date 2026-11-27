from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query

from ilp.auth.models import Identity
from ilp.auth.repository import SupabaseProfileRepository
from ilp.auth.router import identity
from ilp.auth.service import public_config
from ilp.infrastructure.settings import get_settings
from ilp.people.models import (
    Meetup,
    MeetupCreate,
    MeetupEdit,
    NudgeEdit,
    Person,
    PersonEdit,
    PersonInput,
)
from ilp.people.repository import JournalFailure, PeopleRepository
from ilp.people.service import PeopleService

router = APIRouter(prefix="/api", tags=["people"])
Account = Annotated[Identity, Depends(identity)]


def service() -> PeopleService:
    config = public_config(get_settings())
    return PeopleService(
        PeopleRepository(config.url, config.publishable_key),
        SupabaseProfileRepository(config.url, config.publishable_key),
    )


Service = Annotated[PeopleService, Depends(service)]


def write(
    svc: PeopleService,
    account: Identity,
    action: str,
    target: UUID | None,
    revision: int,
    payload: dict[str, Any],
) -> Any:
    try:
        return svc.write(account, action, target, revision, payload)
    except JournalFailure as failure:
        raise HTTPException(
            failure.status,
            "Reload to review changes, then try again."
            if failure.status == 409
            else "The change could not be saved. Review your input and try again.",
        ) from None
    except Exception:
        raise HTTPException(503, "Your change could not be confirmed. Try again.") from None


@router.get("/people", response_model=list[Person])
def people(account: Account, svc: Service) -> list[Person]:
    try:
        return svc.people(account)
    except Exception:
        raise HTTPException(503, "People could not be loaded. Try again.") from None


@router.post("/people", response_model=Person)
def create_person(value: PersonInput, account: Account, svc: Service) -> Any:
    return write(svc, account, "person_create", None, 0, value.model_dump(mode="json"))


@router.put("/people/{person}", response_model=Person)
def edit_person(person: UUID, value: PersonEdit, account: Account, svc: Service) -> Any:
    return write(
        svc,
        account,
        "person_edit",
        person,
        value.revision,
        value.model_dump(
            mode="json",
            exclude={"revision"}
            if "next_scheduled_on" in value.model_fields_set
            else {"revision", "next_scheduled_on"},
        ),
    )


@router.delete("/people/{person}")
def delete_person(
    person: UUID, account: Account, svc: Service, revision: Annotated[int, Query(ge=1)]
) -> Any:
    return write(svc, account, "person_delete", person, revision, {})


@router.put("/people/{person}/nudge", response_model=Person)
def edit_nudge(person: UUID, value: NudgeEdit, account: Account, svc: Service) -> Any:
    return write(
        svc,
        account,
        "nudge",
        person,
        value.revision,
        value.model_dump(mode="json", exclude={"revision"}),
    )


@router.get("/people/{person}/meetups", response_model=list[Meetup])
def history(person: UUID, account: Account, svc: Service) -> list[Meetup]:
    try:
        return svc.history(account, person)
    except JournalFailure as failure:
        raise HTTPException(failure.status, "Person is unavailable.") from None
    except Exception:
        raise HTTPException(503, "History could not be loaded. Try again.") from None


@router.post("/people/{person}/meetups", response_model=Meetup)
def create_meetup(person: UUID, value: MeetupCreate, account: Account, svc: Service) -> Any:
    return write(svc, account, "meetup_create", person, 0, value.model_dump(mode="json"))


@router.put("/meetups/{meetup}", response_model=Meetup)
def edit_meetup(meetup: UUID, value: MeetupEdit, account: Account, svc: Service) -> Any:
    return write(
        svc,
        account,
        "meetup_edit",
        meetup,
        value.revision,
        value.model_dump(mode="json", exclude={"revision"}),
    )


@router.delete("/meetups/{meetup}")
def delete_meetup(
    meetup: UUID, account: Account, svc: Service, revision: Annotated[int, Query(ge=1)]
) -> Any:
    return write(svc, account, "meetup_delete", meetup, revision, {})
