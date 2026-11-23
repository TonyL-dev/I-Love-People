from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Connection

from ilp.people.due import advance, due_rank
from ilp.push.models import JobResult
from ilp.push.repository import Device, PushRepository
from ilp.push.transport import Outcome, PushTransport


@dataclass(frozen=True)
class EligibleReminder:
    device: Device
    day: date
    ttl: int
    name: str | None = field(default=None, repr=False)


def send_window(device: Device, now: datetime) -> tuple[date, int | None]:
    try:
        zone = ZoneInfo(device.timezone)
    except ZoneInfoNotFoundError:
        zone = ZoneInfo("UTC")
    local = now.astimezone(zone)
    quiet_duration = (device.quiet_end - device.quiet_start) % 1440

    def quiet(value: datetime) -> bool:
        minute = value.hour * 60 + value.minute
        return (minute - device.quiet_start) % 1440 < quiet_duration

    if quiet(local):
        return local.date(), None
    # Check elapsed time so queued delivery stays inside this day's window even across DST.
    for minutes in range(1, 16):
        later = (now + timedelta(minutes=minutes)).astimezone(zone)
        if later.date() != local.date() or quiet(later):
            return local.date(), (minutes - 1) * 60
    return local.date(), 900


class PushJob:
    def __init__(self, repository: PushRepository, transport: PushTransport) -> None:
        self.repository = repository
        self.transport = transport

    def run(self) -> JobResult:
        result = JobResult()
        for _ in range(4):
            with self.repository.transaction() as db:
                device_id = self.repository.next_device(db)
                if device_id is None:
                    break
                self.repository.defer(db, device_id, 5)
                eligible = self.eligible(db, device_id)
                lease = self.repository.claim(db, device_id, eligible.day) if eligible else None
            result.checked += 1
            if eligible and lease:
                outcome = self.deliver(device_id, eligible.day, lease)
                if outcome:
                    setattr(result, outcome, getattr(result, outcome) + 1)
        self.repository.prune()
        return result

    def eligible(self, db: Connection, device_id: UUID) -> EligibleReminder | None:
        device = self.repository.active_device(db, device_id)
        if not device:
            return None
        day, ttl = send_window(device, datetime.now(UTC))
        if ttl is None:
            return None
        schedules = self.repository.schedules(db, device, day)
        dated = (
            (
                schedule,
                advance(schedule.completed_on, schedule.cadence_count, schedule.cadence_unit),
            )
            for schedule in schedules
        )
        due_now = ((schedule, due) for schedule, due in dated if due <= day)
        if not device.show_name:
            return EligibleReminder(device, day, ttl) if next(due_now, None) else None
        first = min(
            (
                (
                    due_rank(schedule.priority, due, schedule.name, str(schedule.person_id)),
                    schedule.name,
                )
                for schedule, due in due_now
                if schedule.name is not None
            ),
            default=None,
        )
        return EligibleReminder(device, day, ttl, first[1]) if first else None

    def deliver(self, device_id: UUID, day: date, lease: UUID) -> Outcome | None:
        with self.repository.transaction() as db:
            # Hold the device lock through the bounded request so opt-out and sends serialize.
            eligible = self.eligible(db, device_id)
            if not self.repository.owns_lease(db, device_id, day, lease):
                return None
            if not eligible or eligible.day != day:
                self.repository.finish(db, device_id, day, lease, "retry")
                return None
            outcome = self.repository.finish(
                db,
                device_id,
                day,
                lease,
                self.transport.send(eligible.device.subscription, eligible.ttl, eligible.name),
            )
            if outcome == "retry":
                self.repository.defer(db, device_id, 30)
            return outcome
