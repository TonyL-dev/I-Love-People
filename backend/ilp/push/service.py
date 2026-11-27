from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from itertools import islice
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Connection

from ilp.people.due import advance, due_rank
from ilp.push.models import JobResult
from ilp.push.repository import Device, PushRepository, Schedule
from ilp.push.transport import Outcome, PushTransport


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
        remaining = 4
        for _ in range(4):
            if not remaining:
                break
            with self.repository.transaction() as db:
                device_id = self.repository.next_device(db)
                if device_id is None:
                    break
                self.repository.defer(db, device_id, 5)
                claims = self.claim(db, device_id, remaining)
            result.checked += 1
            remaining -= len(claims)
            for person, day, lease in claims:
                outcome = self.deliver(device_id, person, day, lease)
                if outcome:
                    setattr(result, outcome, getattr(result, outcome) + 1)
        self.repository.prune()
        return result

    def claim(self, db: Connection, device_id: UUID, limit: int) -> list[tuple[UUID, date, UUID]]:
        device = self.repository.active_device(db, device_id)
        if not device:
            return []
        day, ttl = send_window(device, datetime.now(UTC))
        if ttl is None:
            return []
        candidates = []
        for schedule in self.repository.schedules(db, device, day):
            due = due_date(schedule)
            if due <= day:
                person = schedule.person_id
                candidates.append(
                    (due_rank(schedule.priority, due, schedule.name or "", str(person)), person)
                )
        claims = []
        for _, person in islice(sorted(candidates), limit):
            lease = self.repository.claim(db, device_id, person, day)
            if lease:
                claims.append((person, day, lease))
        return claims

    def deliver(self, device_id: UUID, person: UUID, day: date, lease: UUID) -> Outcome | None:
        with self.repository.transaction() as db:
            # Hold the device lock through the bounded request so opt-out and sends serialize.
            device = self.repository.active_device(db, device_id)
            if not device or not self.repository.owns_lease(db, device_id, person, day, lease):
                return None
            current_day, ttl = send_window(device, datetime.now(UTC))
            schedule = next(self.repository.schedules(db, device, day, person), None)
            if current_day != day or ttl is None or not schedule or due_date(schedule) > day:
                self.repository.release(db, device_id, person, day)
                return None
            tag = sha256(f"{device_id}:{person}:{day}".encode()).hexdigest()[:32]
            return self.repository.finish(
                db,
                device_id,
                person,
                day,
                lease,
                self.transport.send(device.subscription, ttl, schedule.name, tag),
            )


def due_date(schedule: Schedule) -> date:
    return advance(schedule.completed_on, schedule.cadence_count, schedule.cadence_unit)
