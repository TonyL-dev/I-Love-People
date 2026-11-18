from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ilp.health.models import HealthResponse, ReadinessResponse, UnavailableResponse
from ilp.health.repository import DatabaseHealthRepository
from ilp.health.service import HealthService
from ilp.infrastructure.settings import get_settings

router = APIRouter(prefix="/api", tags=["health"])


def get_health_service() -> HealthService:
    url = get_settings().database_url
    return HealthService(DatabaseHealthRepository(url.get_secret_value() if url else None))


@router.get("/health", response_model=HealthResponse, operation_id="get_health")
def health() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={503: {"model": UnavailableResponse}},
    operation_id="get_readiness",
)
def readiness(service: Annotated[HealthService, Depends(get_health_service)]) -> ReadinessResponse:
    if not service.is_ready():
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")
    return ReadinessResponse()
