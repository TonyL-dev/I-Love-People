from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from ilp.auth.router import router as account_router
from ilp.health.router import router
from ilp.people.router import router as people_router
from ilp.push.router import router as push_router


def create_app() -> FastAPI:
    application = FastAPI(
        title="I Love People API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    application.include_router(router)
    application.include_router(account_router)
    application.include_router(people_router)
    application.include_router(push_router)

    @application.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError) -> Response:
        if request.url.path.startswith("/api/push/"):
            return JSONResponse({"detail": "Invalid notification settings"}, status_code=422)
        return await request_validation_exception_handler(request, error)

    @application.middleware("http")
    async def private_responses(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    return application


app = create_app()
