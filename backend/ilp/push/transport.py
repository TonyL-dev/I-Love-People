from base64 import urlsafe_b64encode
from dataclasses import dataclass, field
from http.client import HTTPException, HTTPSConnection
from json import dumps
from time import time
from typing import Literal, Protocol
from urllib.parse import urlunsplit

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid  # type: ignore[import-untyped]
from pydantic import SecretStr
from pywebpush import WebPusher  # type: ignore[import-untyped]

from ilp.infrastructure.settings import Settings
from ilp.push.models import decode_key, push_url

Outcome = Literal["sent", "retry", "revoked", "failed"]


@dataclass(frozen=True)
class Subscription:
    endpoint: str = field(repr=False)
    p256dh: str = field(repr=False)
    auth: str = field(repr=False)


class PushTransport(Protocol):
    def send(self, subscription: Subscription, ttl: int, name: str | None, tag: str) -> Outcome: ...


class WebPushTransport:
    def __init__(self, private_key: SecretStr, subject: str) -> None:
        raw = decode_key(private_key.get_secret_value(), 32)
        key = ec.derive_private_key(int.from_bytes(raw, "big"), ec.SECP256R1())
        public = key.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
        self.public_key = urlsafe_b64encode(public).decode().rstrip("=")
        self._vapid = Vapid.from_raw(urlsafe_b64encode(raw))
        self._subject = subject

    @classmethod
    def configured(cls, settings: Settings) -> "WebPushTransport | None":
        if (
            not settings.push_private_key
            or not settings.push_subject
            or not settings.push_subject.startswith("mailto:")
            or "@" not in settings.push_subject
            or not settings.push_job_secret
            or len(settings.push_job_secret.get_secret_value()) < 32
            or not settings.database_url
        ):
            return None
        try:
            return cls(settings.push_private_key, settings.push_subject)
        except ValueError:
            return None

    def send(self, subscription: Subscription, ttl: int, name: str | None, tag: str) -> Outcome:
        try:
            url = push_url(subscription.endpoint)
            headers = self._vapid.sign(
                {"aud": f"https://{url.netloc}", "sub": self._subject, "exp": int(time()) + 3600}
            )
            headers.update(
                {
                    "Content-Encoding": "aes128gcm",
                    "Content-Type": "application/octet-stream",
                    "TTL": str(ttl),
                    "Topic": tag,
                    "Urgency": "normal",
                }
            )
            pusher = WebPusher(
                {
                    "endpoint": subscription.endpoint,
                    "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
                }
            )
            payload = {"type": "catch-up", "tag": tag}
            if name is not None:
                payload["name"] = name
            body = pusher.encode(dumps(payload, separators=(",", ":")).encode())["body"]
        except Exception:
            # Library errors can contain endpoint or key material.
            return "failed"
        connection = HTTPSConnection(url.netloc, timeout=4)
        try:
            connection.request(
                "POST", urlunsplit(("", "", url.path, url.query, "")), body=body, headers=headers
            )
            with connection.getresponse() as response:
                status = response.status
        except (OSError, HTTPException):
            return "retry"
        finally:
            connection.close()
        if 200 <= status < 300:
            return "sent"
        if status in (404, 410):
            return "revoked"
        if status in (408, 429) or status >= 500:
            return "retry"
        return "failed"
