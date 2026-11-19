from datetime import UTC, date, datetime
from unittest.mock import Mock, patch
from uuid import UUID, uuid4

import pytest
from ilp.auth.models import AccountProfile, Identity
from ilp.people.due import advance, derive, due_order
from ilp.people.models import Person
from ilp.people.service import PeopleService


def person(**changes: object) -> Person:
    return Person.model_validate(
        {
            "id": str(uuid4()),
            "name": "Maya",
            "revision": 1,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
            "last_seen": "2024-01-31",
            "cadence_count": 1,
            "cadence_unit": "months",
            **changes,
        }
    )


@pytest.mark.parametrize(
    ("start", "count", "unit", "expected"),
    [
        ("2024-01-31", 1, "months", "2024-02-29"),
        ("2023-01-31", 1, "months", "2023-02-28"),
        ("2024-02-29", 12, "months", "2025-02-28"),
        ("2023-12-31", 2, "months", "2024-02-29"),
        ("2024-01-31", 2, "months", "2024-03-31"),
        ("2024-02-28", 1, "days", "2024-02-29"),
        ("2024-03-03", 1, "weeks", "2024-03-10"),
        ("2024-11-01", 1, "weeks", "2024-11-08"),
    ],
)
def test_calendar_cadences(start: str, count: int, unit: str, expected: str) -> None:
    assert advance(date.fromisoformat(start), count, unit).isoformat() == expected


@pytest.mark.parametrize(
    ("today", "timing"),
    [
        ("2024-02-21", "later"),
        ("2024-02-22", "soon"),
        ("2024-02-28", "soon"),
        ("2024-02-29", "now"),
        ("2024-03-01", "now"),
    ],
)
def test_inclusive_seven_day_window(today: str, timing: str) -> None:
    assert derive(person(), date.fromisoformat(today)).timing == timing


def test_snooze_dismiss_pause_and_unknown_do_not_rewrite_due_date() -> None:
    today = date(2024, 3, 1)
    p = person(snoozed_until="2024-03-10", dismissed_on="2024-03-01")
    assert derive(p, today).suppression == "dismissed"
    next_day = derive(p, date(2024, 3, 2))
    assert next_day.suppression == "snoozed"
    assert next_day.due_on == date(2024, 2, 29)
    assert next_day.eligible_on == date(2024, 3, 10)
    assert derive(p, date(2024, 3, 10)).suppression is None
    assert derive(person(paused=True), today).suppression == "paused"
    assert derive(person(archived=True, paused=True), today).suppression == "archived"
    assert derive(person(last_seen=None), today).eligible_on is None
    assert derive(person(cadence_count=None, cadence_unit=None), today).due_on is None


def test_timing_then_priority_then_due_name_id() -> None:
    today = date(2024, 3, 1)
    rows = [
        person(name="Z", priority="closest", last_seen="2024-02-05"),
        person(name="A", priority=None),
        person(name="B", priority="close"),
        person(name="C", priority="closest"),
        person(name="A", priority="close"),
        person(name="A", priority="close", last_seen="2024-01-30"),
    ]
    ranked = sorted([derive(p, today) for p in rows], key=due_order)
    assert [(p.name, p.priority) for p in ranked] == [
        ("C", "closest"),
        ("A", "close"),
        ("A", "close"),
        ("B", "close"),
        ("A", None),
        ("Z", "closest"),
    ]
    a, b = person(id=UUID(int=1)), person(id=UUID(int=2))
    assert due_order(derive(a, today)) < due_order(derive(b, today))


@pytest.mark.parametrize(
    ("timezone", "timing"),
    [
        ("America/Toronto", "soon"),
        ("Pacific/Kiritimati", "now"),
    ],
)
def test_reads_use_saved_timezone_and_recalculate(timezone: str, timing: str) -> None:
    account = Identity(
        owner_id=uuid4(), session_id=uuid4(), token="synthetic", email="a@example.test"
    )
    repository, profiles = Mock(), Mock()
    profiles.read.return_value = AccountProfile(owner_id=account.owner_id, timezone=timezone)
    raw = person(last_seen="2024-02-28", cadence_unit="days").model_dump(mode="json")
    raw["meetups"] = [{"completed_on": "2024-02-28"}]
    repository.people.side_effect = lambda account: [dict(raw)]
    svc = PeopleService(repository, profiles)
    instant = datetime(2024, 2, 29, 1, tzinfo=UTC)
    with patch("ilp.people.service.datetime") as clock:
        clock.now.side_effect = lambda zone: instant.astimezone(zone)
        assert svc.people(account)[0].timing == timing
        # A fresh service derives the same state, with no process-level timer/cache.
        assert PeopleService(repository, profiles).people(account)[0].timing == timing


@pytest.mark.parametrize(
    "instant",
    [
        datetime(2024, 3, 10, 6, 59, tzinfo=UTC),
        datetime(2024, 3, 10, 7, 1, tzinfo=UTC),
        datetime(2024, 11, 3, 5, 59, tzinfo=UTC),
        datetime(2024, 11, 3, 6, 1, tzinfo=UTC),
    ],
)
def test_dst_changes_do_not_expire_dismissal_mid_date(instant: datetime) -> None:
    from zoneinfo import ZoneInfo

    local_date = instant.astimezone(ZoneInfo("America/Toronto")).date()
    p = person(dismissed_on=local_date)
    assert derive(p, local_date).suppression == "dismissed"
    assert derive(p, local_date.replace(day=local_date.day + 1)).suppression is None
