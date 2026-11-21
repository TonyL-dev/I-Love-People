from hmac import compare_digest
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials

from ilp.auth.models import Identity
from ilp.auth.router import bearer, identity
from ilp.infrastructure.settings import get_settings
from ilp.push.models import DeviceStatus, Endpoint, Enrollment, JobResult, PushConfig
from ilp.push.repository import EnrollmentConflict, PushRepository
from ilp.push.service import PushJob
from ilp.push.transport import WebPushTransport

router = APIRouter(prefix="/api/push", tags=["notifications"])
Account = Annotated[Identity, Depends(identity)]


def repository() -> PushRepository:
    url = get_settings().database_url
    if not url:
        raise HTTPException(503, "Notification settings are unavailable")
    return PushRepository(url.get_secret_value())


@router.get("/config", operation_id="get_push_config")
def config(_: Account) -> PushConfig:
    transport = WebPushTransport.configured(get_settings())
    return PushConfig(public_key=transport.public_key if transport else None)


@router.post("/status", operation_id="get_push_status")
def status(device: Endpoint, account: Account) -> DeviceStatus | None:
    try:
        return repository().status(account, device.endpoint)
    except Exception:
        raise HTTPException(503, "Notification settings are unavailable") from None


@router.put("/device", operation_id="enroll_push_device")
def enroll(device: Enrollment, account: Account) -> DeviceStatus:
    if not WebPushTransport.configured(get_settings()):
        raise HTTPException(503, "Notifications are unavailable")
    try:
        return repository().enroll(account, device)
    except EnrollmentConflict:
        raise HTTPException(409, "This device could not be registered") from None
    except Exception:
        raise HTTPException(503, "Notification settings could not be saved") from None


@router.post("/unsubscribe", status_code=204, operation_id="unsubscribe_push_device")
def unsubscribe(device: Endpoint, account: Account) -> Response:
    try:
        repository().remove(account, device.endpoint)
    except Exception:
        raise HTTPException(503, "Notification settings could not be saved") from None
    return Response(status_code=204)


@router.post("/job", operation_id="run_push_job")
def run(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> JobResult:
    settings = get_settings()
    if (
        not credentials
        or not settings.push_job_secret
        or len(settings.push_job_secret.get_secret_value()) < 32
        or not compare_digest(
            credentials.credentials.encode(), settings.push_job_secret.get_secret_value().encode()
        )
    ):
        raise HTTPException(401, "Job authorization is required")
    transport = WebPushTransport.configured(settings)
    if not transport:
        raise HTTPException(503, "Notification delivery is unavailable")
    try:
        return PushJob(repository(), transport).run()
    except Exception:
        raise HTTPException(503, "Notification job could not complete") from None
