import re
from base64 import urlsafe_b64decode
from urllib.parse import SplitResult, urlsplit

from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator


def decode_key(value: str, size: int) -> bytes:
    if not re.fullmatch(r"[A-Za-z0-9_-]+={0,2}", value):
        raise ValueError("Invalid key")
    data = urlsafe_b64decode(value + "=" * (-len(value) % 4))
    if len(data) != size:
        raise ValueError("Invalid key")
    return data


def push_url(endpoint: str) -> SplitResult:
    # Pin to the browser push services we support. No redirects or arbitrary origins.
    if not endpoint.isascii() or any(ord(character) <= 32 for character in endpoint):
        raise ValueError("Unsupported notification service")
    url = urlsplit(endpoint)
    host = url.netloc
    if (
        url.scheme != "https"
        or url.fragment
        or not url.path.startswith("/")
        or not (
            host == "fcm.googleapis.com"
            and url.path.startswith(("/fcm/send/", "/wp/"))
            or host in {"updates.push.services.mozilla.com", "push.services.mozilla.com"}
            and url.path.startswith("/wpush/")
            or re.fullmatch(r"(?:[a-z0-9-]+\.)?push\.apple\.com", host)
            or re.fullmatch(r"[a-z0-9-]+\.notify\.windows\.com", host)
            and url.path.startswith("/w/")
        )
    ):
        raise ValueError("Unsupported notification service")
    return url


class Endpoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    endpoint: str = Field(min_length=1, max_length=2048, repr=False)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, value: str) -> str:
        push_url(value)
        return value


class DeviceStatus(BaseModel):
    quiet_start: int = Field(ge=0, le=1439)
    quiet_end: int = Field(ge=0, le=1439)
    show_name: StrictBool = False

    @model_validator(mode="after")
    def different_times(self) -> "DeviceStatus":
        if self.quiet_start == self.quiet_end:
            raise ValueError("Choose different quiet-hour times")
        return self


class Enrollment(Endpoint, DeviceStatus):
    p256dh: str = Field(min_length=87, max_length=88, repr=False)
    auth: str = Field(min_length=22, max_length=24, repr=False)

    @field_validator("p256dh", "auth")
    @classmethod
    def validate_key(cls, value: str) -> str:
        if len(value) >= 87:
            ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), decode_key(value, 65))
        else:
            decode_key(value, 16)
        return value


class PushConfig(BaseModel):
    public_key: str | None


class JobResult(BaseModel):
    checked: int = 0
    sent: int = 0
    revoked: int = 0
    retry: int = 0
    failed: int = 0
