"""Calendar-only recurrence; no elapsed-hour arithmetic or cached eligibility."""

from calendar import monthrange
from datetime import date, timedelta

from ilp.people.models import Person

PRIORITY = {"closest": 0, "close": 1, "occasional": 2, "distant": 3, None: 4}
TIMING = {"now": 0, "soon": 1, "later": 2, "unknown": 3}


def advance(start: date, count: int, unit: str) -> date:
    if unit == "months":
        year, month = divmod(start.year * 12 + start.month - 1 + count, 12)
        return date(year, month + 1, min(start.day, monthrange(year, month + 1)[1]))
    return start + timedelta(days=count * (7 if unit == "weeks" else 1))


def derive(person: Person, today: date) -> Person:
    due = (
        advance(person.last_seen, person.cadence_count, person.cadence_unit)
        if person.last_seen and person.cadence_count and person.cadence_unit
        else None
    )
    eligible = max(due, person.snoozed_until or due) if due else None
    suppression = (
        "archived"
        if person.archived
        else "paused"
        if person.paused
        else "dismissed"
        if person.dismissed_on == today
        else "snoozed"
        if due and person.snoozed_until and person.snoozed_until > today
        else None
    )
    timing = (
        "unknown"
        if due is None
        else "now"
        if due <= today
        else "soon"
        if (due - today).days <= 7
        else "later"
    )
    reason = (
        "No meetup logged"
        if person.last_seen is None
        else "Choose a cadence to receive nudges"
        if due is None
        else f"Last meetup {person.last_seen}; every {person.cadence_count} {person.cadence_unit}; "
        f"catch-up date {due}"
    )
    return person.model_copy(
        update={
            "due_on": due,
            "eligible_on": eligible,
            "timing": timing,
            "suppression": suppression,
            "reason": reason,
        }
    )


def due_order(person: Person) -> tuple[int, int, date, str, str]:
    return (
        TIMING[person.timing],
        PRIORITY[person.priority],
        person.due_on or date.max,
        person.name.casefold(),
        str(person.id),
    )
