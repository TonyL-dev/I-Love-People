from datetime import UTC, date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import Connection

from ilp.people.due import advance
from ilp.push.models import JobResult
from ilp.push.repository import Device, PushRepository
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
        for _ in range(4):
            with self.repository.transaction() as db:
                device_id = self.repository.next_device(db)
                if device_id is None:
                    break
                self.repository.defer(db, device_id, 5)
                eligible = self.eligible(db, device_id)
                lease = self.repository.claim(db, device_id, eligible[1]) if eligible else None
            result.checked += 1
            if eligible and lease:
                outcome = self.deliver(device_id, eligible[1], lease)
                if outcome:
                    setattr(result, outcome, getattr(result, outcome) + 1)
        self.repository.prune()
        return result

    def eligible(self, db: Connection, device_id: UUID) -> tuple[Device, date, int] | None:
        device = self.repository.active_device(db, device_id)
        if not device:
            return None
        day, ttl = send_window(device, datetime.now(UTC))
        if ttl is None or not any(
            advance(completed_on, count, unit) <= day
            for count, unit, completed_on in self.repository.schedules(db, device.owner_id, day)
        ):
            return None
        return device, day, ttl

    def deliver(self, device_id: UUID, day: date, lease: UUID) -> Outcome | None:
        with self.repository.transaction() as db:
            # Hold the device lock through the bounded request so opt-out and sends serialize.
            eligible = self.eligible(db, device_id)
            if not self.repository.owns_lease(db, device_id, day, lease):
                return None
            if not eligible or eligible[1] != day:
                self.repository.finish(db, device_id, day, lease, "retry")
                return None
            device, _, ttl = eligible
            outcome = self.repository.finish(
                db, device_id, day, lease, self.transport.send(device.subscription, ttl)
            )
            if outcome == "retry":
                self.repository.defer(db, device_id, 30)
            return outcome
