from collections.abc import Callable, Coroutine, Iterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from ilp.auth.models import Identity
from ilp.auth.router import auth_service, identity
from ilp.auth.service import public_config
from ilp.infrastructure.settings import get_settings
from ilp.privacy.models import BACKUP_BYTES, Backup, DeleteRequest, RestorePreview, RestoreRequest
from ilp.privacy.repository import PrivacyFailure, PrivacyRepository
from ilp.privacy.service import PrivacyService
from starlette.types import Message


class BoundedPrivacyRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def bounded(request: Request) -> Response:
            if request.method != "POST":
                return await handler(request)
            limit = 8192 if request.url.path.endswith("/delete-all") else BACKUP_BYTES + 1024
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > limit:
                    raise HTTPException(413, "The request is too large.")
                body.extend(chunk)

            async def receive() -> Message:
                return {"type": "http.request", "body": bytes(body)}

            return await handler(Request(request.scope, receive))

        return bounded


router = APIRouter(prefix="/api/privacy", tags=["privacy"], route_class=BoundedPrivacyRoute)
Account = Annotated[Identity, Depends(identity)]


def service() -> Iterator[PrivacyService]:
    try:
        config = public_config(get_settings())
        yield PrivacyService(PrivacyRepository(config.url, config.publishable_key), auth_service())
    except PrivacyFailure as failure:
        detail = {
            403: "Your password could not be verified. Try again.",
            409: "Your library or settings changed. Review the backup again.",
            413: "The backup exceeds the 4 MB limit.",
            422: "The backup contains unsupported settings or records.",
            429: "Too many attempts. Wait before trying again.",
        }.get(failure.status, "The request could not be confirmed. Check your data and try again.")
        raise HTTPException(failure.status, detail) from None
    except (HTTPException, RequestValidationError):
        raise
    except Exception:
        raise HTTPException(503, "The request could not be confirmed. Try again.") from None


Service = Annotated[PrivacyService, Depends(service, scope="function")]


@router.get("/backup", response_model=Backup)
def export(account: Account, svc: Service, response: Response) -> Backup:
    response.headers["Content-Disposition"] = 'attachment; filename="i-love-people-backup.json"'
    return svc.export(account)


@router.post("/restore/preview", response_model=RestorePreview)
def preview(backup: Backup, account: Account, svc: Service) -> RestorePreview:
    return svc.preview(account, backup)


@router.post("/restore", status_code=204)
def restore(value: RestoreRequest, account: Account, svc: Service) -> None:
    svc.restore(account, value)


@router.post("/delete-all", status_code=204)
def delete(value: DeleteRequest, account: Account, svc: Service) -> None:
    svc.delete(account, value.password.get_secret_value())
