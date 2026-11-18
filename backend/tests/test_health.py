import asyncio

import httpx
import pytest
from fastapi import FastAPI
from ilp.health.router import get_health_service
from ilp.health.service import HealthService
from ilp.main import create_app


class SyntheticRepository:
    def __init__(self, ready: bool, fail: bool = False) -> None:
        self.ready = ready
        self.fail = fail

    def can_connect(self) -> bool:
        if self.fail:
            raise RuntimeError("synthetic-secret-must-not-leak")
        return self.ready


def request(path: str, application: FastAPI | None = None) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=application or create_app())
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            return await client.get(path)

    return asyncio.run(send())


def test_health_is_liveness_not_a_database_claim() -> None:
    response = request("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "i-love-people-api"}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "ready,fail,expected", [(True, False, 200), (False, False, 503), (False, True, 503)]
)
def test_readiness_fails_closed_without_exposing_errors(
    ready: bool, fail: bool, expected: int
) -> None:
    application = create_app()
    application.dependency_overrides[get_health_service] = lambda: HealthService(
        SyntheticRepository(ready, fail)
    )
    response = request("/api/ready", application)
    assert response.status_code == expected
    assert "synthetic-secret" not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_people_route_requires_authentication() -> None:
    assert request("/api/people").status_code == 401
