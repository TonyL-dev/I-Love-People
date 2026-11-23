from datetime import UTC, datetime
from json import loads
from secrets import token_bytes
from uuid import uuid4

import http_ece  # type: ignore[import-untyped]
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from ilp.push.models import push_url
from ilp.push.repository import Device
from ilp.push.service import send_window
from ilp.push.transport import Subscription, WebPushTransport
from push_smoke import encode
from pydantic import SecretStr


@pytest.mark.parametrize(
    "endpoint",
    [
        "http://fcm.googleapis.com/wp/example",
        "https://fcm.googleapis.com:443/wp/example",
        "https://fcm.googleapis.com@elsewhere.test/wp/example",
        "https://notpush.apple.com/example",
        "https://fcm.googleapis.com/unrelated",
    ],
)
def test_only_supported_https_push_endpoints(endpoint: str) -> None:
    with pytest.raises(ValueError):
        push_url(endpoint)


def test_quiet_hours_wrap_and_ttl_respects_the_dst_jump() -> None:
    subscription = Subscription("https://fcm.googleapis.com/wp/synthetic", "", "")
    nights = Device(uuid4(), uuid4(), "America/Toronto", 21 * 60, 9 * 60, subscription)
    assert send_window(nights, datetime(2026, 11, 19, 3, tzinfo=UTC)) == (
        datetime(2026, 11, 18).date(),
        None,
    )
    assert send_window(nights, datetime(2026, 11, 19, 14, tzinfo=UTC))[1] == 900
    mornings = Device(uuid4(), uuid4(), "America/Toronto", 180, 240, subscription)
    assert send_window(mornings, datetime(2026, 3, 8, 6, 58, tzinfo=UTC))[1] == 60
    assert send_window(mornings, datetime(2026, 3, 8, 7, tzinfo=UTC))[1] is None


@pytest.mark.parametrize(
    "status, outcome", [(201, "sent"), (410, "revoked"), (429, "retry"), (307, "failed")]
)
@pytest.mark.parametrize("name", [None, "Synthetic Maïa"])
def test_web_push_encrypts_and_signs_without_redirecting(
    monkeypatch: pytest.MonkeyPatch, status: int, outcome: str, name: str | None
) -> None:
    receiver = ec.generate_private_key(ec.SECP256R1())
    point = receiver.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    auth = token_bytes(16)
    sender = ec.generate_private_key(ec.SECP256R1()).private_numbers().private_value
    transport = WebPushTransport(
        SecretStr(encode(sender.to_bytes(32, "big"))), "mailto:push@example.test"
    )
    endpoint = "https://fcm.googleapis.com/wp/synthetic"

    class MockHTTPS:
        def __init__(self, host: str, *, timeout: int) -> None:
            assert host == "fcm.googleapis.com" and timeout == 4

        def request(
            self, method: str, target: str, *, body: bytes, headers: dict[str, str]
        ) -> None:
            assert (method, target) == ("POST", "/wp/synthetic")
            assert headers["Authorization"].startswith("vapid t=")
            assert headers["Content-Encoding"] == "aes128gcm" and headers["TTL"] == "60"
            plain = http_ece.decrypt(
                body, private_key=receiver, auth_secret=auth, version="aes128gcm"
            )
            expected = {"type": "catch-up"}
            if name is not None:
                expected["name"] = name
            assert loads(plain) == expected

        def getresponse(self) -> "MockHTTPS":
            return self

        @property
        def status(self) -> int:
            return status

        def __enter__(self) -> "MockHTTPS":
            return self

        def __exit__(self, *_exc: object) -> None:
            pass

        def close(self) -> None:
            pass

    monkeypatch.setattr("ilp.push.transport.HTTPSConnection", MockHTTPS)
    assert transport.send(Subscription(endpoint, encode(point), encode(auth)), 60, name) == outcome
