from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import date
from hashlib import sha256
from typing import cast
from uuid import UUID, uuid4

from sqlalchemy import Connection, create_engine, text
from sqlalchemy.pool import NullPool

from ilp.auth.models import Identity
from ilp.push.models import DeviceStatus, Enrollment
from ilp.push.transport import Outcome, Subscription


@dataclass(frozen=True)
class Device:
    id: UUID
    owner_id: UUID
    timezone: str
    quiet_start: int
    quiet_end: int
    subscription: Subscription = field(repr=False)
    show_name: bool = False


@dataclass(frozen=True)
class Schedule:
    cadence_count: int
    cadence_unit: str
    completed_on: date
    person_id: UUID
    name: str | None = field(repr=False)
    priority: str | None


class EnrollmentConflict(Exception):
    pass


class PushRepository:
    def __init__(self, database_url: str) -> None:
        self.engine = create_engine(
            database_url,
            poolclass=NullPool,
            hide_parameters=True,
            connect_args={"connect_timeout": 4},
        )

    @contextmanager
    def transaction(self) -> Iterator[Connection]:
        with self.engine.begin() as connection:
            connection.execute(text("SET LOCAL statement_timeout = '4s'"))
            connection.execute(text("SET LOCAL lock_timeout = '2s'"))
            yield connection

    def status(self, account: Identity, endpoint: str) -> DeviceStatus | None:
        with self.transaction() as db:
            row = (
                db.execute(
                    text("""
                    SELECT quiet_start, quiet_end, show_name FROM ilp_private.push_devices
                    WHERE owner_id = :owner AND endpoint_hash = :digest AND endpoint IS NOT NULL
                """),
                    {"owner": account.owner_id, "digest": sha256(endpoint.encode()).digest()},
                )
                .mappings()
                .one_or_none()
            )
        return DeviceStatus.model_validate(dict(row)) if row is not None else None

    def enroll(self, account: Identity, update: Enrollment) -> DeviceStatus:
        owner = account.owner_id
        digest = sha256(update.endpoint.encode()).digest()
        name_setting = update.show_name if "show_name" in update.model_fields_set else None
        with self.transaction() as db:
            # Serialize the per-owner device limit and enrollment.
            db.execute(
                text("SELECT id FROM auth.users WHERE id = :owner FOR NO KEY UPDATE"),
                {"owner": owner},
            ).scalar_one()
            count = db.execute(
                text("""
                    SELECT count(*) FROM ilp_private.push_devices
                    WHERE owner_id = :owner AND endpoint_hash <> :digest AND endpoint IS NOT NULL
                """),
                {"owner": owner, "digest": digest},
            ).scalar_one()
            if count >= 8:
                raise EnrollmentConflict()
            row = (
                db.execute(
                    text("""
                    INSERT INTO ilp_private.push_devices
                        (owner_id, endpoint_hash, endpoint, p256dh, auth_secret,
                         quiet_start, quiet_end, show_name)
                    VALUES (:owner, :digest, :endpoint, :p256dh, :auth, :quiet_start, :quiet_end,
                            COALESCE(:show_name, false))
                    ON CONFLICT (endpoint_hash) DO UPDATE SET
                        endpoint = EXCLUDED.endpoint, p256dh = EXCLUDED.p256dh,
                        auth_secret = EXCLUDED.auth_secret,
                        next_check = CASE WHEN push_devices.endpoint IS NULL THEN now()
                            ELSE push_devices.next_check END,
                        quiet_start = EXCLUDED.quiet_start, quiet_end = EXCLUDED.quiet_end,
                        show_name = COALESCE(:show_name, push_devices.show_name)
                    WHERE push_devices.owner_id = EXCLUDED.owner_id
                    RETURNING quiet_start, quiet_end, show_name
                """),
                    {
                        **update.model_dump(),
                        "show_name": name_setting,
                        "owner": owner,
                        "digest": digest,
                    },
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise EnrollmentConflict()
            return DeviceStatus.model_validate(dict(row))

    def remove(self, account: Identity, endpoint: str) -> None:
        with self.transaction() as db:
            # Clear credentials while keeping today's receipt if the same endpoint is re-enabled.
            db.execute(
                text("""
                    UPDATE ilp_private.push_devices
                    SET endpoint = NULL, p256dh = NULL, auth_secret = NULL,
                        show_name = false, next_check = now()
                    WHERE owner_id = :owner AND endpoint_hash = :digest AND endpoint IS NOT NULL
                """),
                {"owner": account.owner_id, "digest": sha256(endpoint.encode()).digest()},
            )

    def next_device(self, db: Connection) -> UUID | None:
        return db.execute(
            text("""
                SELECT id FROM ilp_private.push_devices
                WHERE endpoint IS NOT NULL AND next_check <= now()
                ORDER BY next_check, id LIMIT 1 FOR UPDATE SKIP LOCKED
            """)
        ).scalar_one_or_none()

    def defer(self, db: Connection, device: UUID, minutes: int) -> None:
        db.execute(
            text("""
                UPDATE ilp_private.push_devices
                SET next_check = now() + make_interval(mins => :minutes) WHERE id = :id
            """),
            {"id": device, "minutes": minutes},
        )

    def active_device(self, db: Connection, device: UUID) -> Device | None:
        row = db.execute(
            text("""
                SELECT d.id, d.owner_id, d.endpoint, d.p256dh, d.auth_secret,
                       d.quiet_start, d.quiet_end, d.show_name,
                       coalesce(p.timezone, 'UTC') AS timezone
                FROM ilp_private.push_devices d
                JOIN auth.users u ON u.id = d.owner_id
                LEFT JOIN public.profiles p ON p.owner_id = d.owner_id
                WHERE d.id = :id AND d.endpoint IS NOT NULL AND u.deleted_at IS NULL
                    AND (u.banned_until IS NULL OR u.banned_until <= now())
                FOR UPDATE OF d
            """),
            {"id": device},
        ).one_or_none()
        if row is None:
            return None
        return Device(
            row.id,
            row.owner_id,
            row.timezone,
            row.quiet_start,
            row.quiet_end,
            Subscription(row.endpoint, row.p256dh, row.auth_secret),
            row.show_name,
        )

    def schedules(
        self, db: Connection, device: Device, today: date, person: UUID | None = None
    ) -> Iterator[Schedule]:
        rows = db.execute(
            text("""
                SELECT p.cadence_count, p.cadence_unit, latest.completed_on, p.id,
                       CASE WHEN :show_name THEN p.name END,
                       CASE WHEN :show_name THEN p.priority END
                FROM public.people p
                CROSS JOIN LATERAL (
                    SELECT completed_on FROM public.meetups m
                    WHERE m.owner_id = p.owner_id AND m.person_id = p.id
                    ORDER BY completed_on DESC LIMIT 1
                ) latest
                WHERE p.owner_id = :owner AND NOT p.archived AND NOT p.paused
                    AND p.cadence_count IS NOT NULL
                    AND (p.next_scheduled_on IS NULL OR p.next_scheduled_on < :today)
                    AND p.dismissed_on IS DISTINCT FROM :today
                    AND (p.snoozed_until IS NULL OR p.snoozed_until <= :today)
                    AND (
                        p.id = CAST(:person AS uuid) OR (
                            CAST(:person AS uuid) IS NULL AND NOT EXISTS (
                                SELECT 1 FROM ilp_private.person_push_deliveries r
                                WHERE r.device_id = :id AND r.person_id = p.id
                                    AND r.local_day = :today AND NOT (
                                        r.outcome IN ('retry', 'sending')
                                        AND r.attempts < 3 AND r.ready_after <= now()
                                    )
                            ) AND NOT EXISTS (
                                SELECT 1 FROM ilp_private.push_deliveries legacy
                                WHERE legacy.device_id = :id AND legacy.local_day = :today
                                    AND legacy.outcome IN ('sending', 'sent')
                            )
                        )
                    )
            """),
            {
                "owner": device.owner_id,
                "id": device.id,
                "today": today,
                "show_name": device.show_name,
                "person": person,
            },
        )
        for row in rows.tuples():
            yield Schedule(*row)

    def claim(self, db: Connection, device: UUID, person: UUID, day: date) -> UUID | None:
        return db.execute(
            text("""
                INSERT INTO ilp_private.person_push_deliveries AS receipt
                    (device_id, person_id, local_day, attempts, lease_token, ready_after, outcome)
                SELECT :id, :person, :day, 1, :lease, now() + interval '2 minutes', 'sending'
                FROM public.people WHERE id = :person FOR KEY SHARE
                ON CONFLICT (device_id, person_id, local_day) DO UPDATE SET
                    attempts = receipt.attempts + 1, lease_token = EXCLUDED.lease_token,
                    ready_after = EXCLUDED.ready_after, outcome = 'sending'
                WHERE receipt.outcome IN ('retry', 'sending')
                    AND receipt.ready_after <= now() AND receipt.attempts < 3
                RETURNING lease_token
            """),
            {"id": device, "person": person, "day": day, "lease": uuid4()},
        ).scalar_one_or_none()

    def owns_lease(
        self, db: Connection, device: UUID, person: UUID, day: date, lease: UUID
    ) -> bool:
        return bool(
            db.execute(
                text("""
                SELECT EXISTS (
                    SELECT 1 FROM ilp_private.person_push_deliveries
                    WHERE device_id = :id AND person_id = :person AND local_day = :day
                        AND lease_token = :lease
                        AND outcome = 'sending' AND ready_after > clock_timestamp()
                    FOR UPDATE
                )
            """),
                {"id": device, "person": person, "day": day, "lease": lease},
            ).scalar_one()
        )

    def finish(
        self, db: Connection, device: UUID, person: UUID, day: date, lease: UUID, result: Outcome
    ) -> Outcome:
        stored = db.execute(
            text("""
                UPDATE ilp_private.person_push_deliveries
                SET outcome = CASE WHEN :outcome = 'retry' AND attempts = 3
                    THEN 'failed' ELSE :outcome END,
                    ready_after = now() + interval '30 minutes'
                WHERE device_id = :id AND person_id = :person AND local_day = :day
                    AND lease_token = :lease
                RETURNING outcome
            """),
            {"id": device, "person": person, "day": day, "lease": lease, "outcome": result},
        ).scalar_one()
        if result == "revoked":
            db.execute(
                text("""
                    UPDATE ilp_private.push_devices
                    SET endpoint = NULL, p256dh = NULL, auth_secret = NULL,
                        endpoint_hash = NULL, show_name = false, next_check = now()
                    WHERE id = :id
                """),
                {"id": device},
            )
        return cast(Outcome, stored)

    def release(self, db: Connection, device: UUID, person: UUID, day: date) -> None:
        params = {"id": device, "person": person, "day": day}
        db.execute(
            text("""
                DELETE FROM ilp_private.person_push_deliveries
                WHERE device_id = :id AND person_id = :person AND local_day = :day AND attempts = 1
            """),
            params,
        )
        db.execute(
            text("""
                UPDATE ilp_private.person_push_deliveries
                SET attempts = attempts - 1, outcome = 'retry', ready_after = now()
                WHERE device_id = :id AND person_id = :person AND local_day = :day
            """),
            params,
        )

    def prune(self) -> None:
        with self.transaction() as db:
            db.execute(
                text("""
                DELETE FROM ilp_private.person_push_deliveries
                WHERE (device_id, person_id, local_day) IN (
                    SELECT device_id, person_id, local_day
                    FROM ilp_private.person_push_deliveries
                    WHERE local_day < current_date - 30 LIMIT 100 FOR UPDATE SKIP LOCKED
                );
            """)
            )
            db.execute(
                text("""
                DELETE FROM ilp_private.push_devices WHERE id IN (
                    SELECT id FROM ilp_private.push_devices
                    WHERE endpoint IS NULL AND next_check < now() - interval '30 days'
                    LIMIT 100 FOR UPDATE SKIP LOCKED
                );
            """)
            )
            db.execute(
                text("""
                DELETE FROM ilp_private.push_deliveries WHERE (device_id, local_day) IN (
                    SELECT device_id, local_day FROM ilp_private.push_deliveries
                    WHERE local_day < current_date - 30 LIMIT 100 FOR UPDATE SKIP LOCKED
                );
            """)
            )
