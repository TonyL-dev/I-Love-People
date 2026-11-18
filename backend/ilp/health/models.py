from typing import Literal

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: Literal["i-love-people-api"] = "i-love-people-api"


class ReadinessResponse(BaseModel):
    status: Literal["ready"] = "ready"


class UnavailableResponse(BaseModel):
    detail: Literal["Service temporarily unavailable"] = "Service temporarily unavailable"
