from contextlib import suppress
from datetime import datetime
from hashlib import sha256
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx
from pydantic import BaseModel, ValidationError

from ilp.auth.models import Identity
from ilp.auth.service import AuthService
from ilp.privacy.models import BACKUP_BYTES, Backup, RestorePreview, RestoreRequest
from ilp.privacy.repository import PrivacyFailure, PrivacyRepository


class Destination(BaseModel):
    timezone: str
    people: int


class PrivacyService:
    def __init__(self, repository: PrivacyRepository, auth: AuthService) -> None:
        self.repository, self.auth = repository, auth

    def export(self, account: Identity) -> Backup:
        try:
            backup = Backup.model_validate(
                self.repository.rpc(account.token, "backup_export_with_plans")
            )
        except ValidationError:
            raise PrivacyFailure(422) from None
        if len(backup.model_dump_json().encode()) > BACKUP_BYTES:
            raise PrivacyFailure(413)
        return backup

    def preview(self, account: Identity, backup: Backup) -> RestorePreview:
        today = datetime.now(ZoneInfo(backup.timezone)).date()
        if any(meetup.completed_on > today for meetup in backup.meetups):
            raise PrivacyFailure(422)
        current = Destination.model_validate(
            self.repository.rpc(account.token, "backup_destination")
        )
        digest = sha256()
        digest.update(account.owner_id.bytes)
        digest.update(current.model_dump_json().encode())
        digest.update(backup.model_dump_json().encode())
        return RestorePreview(
            people=len(backup.people),
            meetups=len(backup.meetups),
            current_people=current.people,
            current_timezone=current.timezone,
            timezone=backup.timezone,
            preview_token=digest.hexdigest(),
        )

    def restore(self, account: Identity, request: RestoreRequest) -> None:
        preview = self.preview(account, request.backup)
        if preview.current_people or preview.preview_token != request.preview_token:
            raise PrivacyFailure(409)
        self.repository.rpc(
            account.token,
            "backup_restore",
            backup=request.backup.model_dump(mode="json"),
            expected_timezone=preview.current_timezone,
        )

    def delete(self, account: Identity, password: str) -> None:
        challenge = UUID(self.repository.rpc(account.token, "backup_begin_delete"))
        fresh_token = self.repository.password_session(account.email, password)
        try:
            fresh = self.auth.authenticate(fresh_token)
            if fresh.owner_id != account.owner_id or fresh.session_id == account.session_id:
                raise PrivacyFailure(403)
            self.repository.rpc(fresh.token, "backup_delete_all", challenge=str(challenge))
        finally:
            # The reauthentication session is never returned to the browser.
            with suppress(httpx.HTTPError):
                self.repository.revoke_password_session(fresh_token)
