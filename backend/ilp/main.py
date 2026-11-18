from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response

from ilp.health.router import router


def create_app() -> FastAPI:
    application = FastAPI(
        title="I Love People API",
        version="0.1.0",
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    application.include_router(router)

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
