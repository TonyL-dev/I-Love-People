"""Verify disposable accounts and captured recovery links against loopback Supabase only."""

import os
import secrets
import time
import uuid
from html.parser import HTMLParser
from urllib.parse import parse_qs, urlsplit

import httpx
from local_services import status

AUTH_URL = "http://127.0.0.1:54321/auth/v1"
MAIL_URL = "http://127.0.0.1:54324"


class Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.values: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self.values.extend(value for key, value in attrs if key == "href" and value)


def recovery_link(mail: httpx.Client, email: str) -> str:
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        response = mail.get("/api/v1/messages", params={"limit": 1000})
        response.raise_for_status()
        for message in response.json()["messages"]:
            if not any(recipient["Address"] == email for recipient in message["To"]):
                continue
            detail = mail.get(f"/api/v1/message/{message['ID']}")
            detail.raise_for_status()
            parser = Links()
            parser.feed(detail.json()["HTML"])
            for link in parser.values:
                parsed = urlsplit(link)
                if (
                    parsed.scheme == "http"
                    and parsed.hostname == "127.0.0.1"
                    and parsed.port == 54321
                    and parsed.path == "/auth/v1/verify"
                    and parse_qs(parsed.query).get("type") == ["recovery"]
                ):
                    return link
        time.sleep(0.25)
    raise RuntimeError("Captured recovery email was not found")


def verify_recovery(
    client: httpx.Client,
    mail: httpx.Client,
    email: str,
    password: str,
    public_headers: dict[str, str],
) -> None:
    client.post("/recover", headers=public_headers, json={"email": email}).raise_for_status()
    link = recovery_link(mail, email)
    verification = client.get(link, follow_redirects=False)
    if verification.status_code not in {302, 303}:
        raise RuntimeError("Recovery link did not redirect")
    destination = urlsplit(verification.headers["location"])
    if (
        destination.scheme != "http"
        or destination.hostname != "127.0.0.1"
        or destination.port != 5173
    ):
        raise RuntimeError("Recovery redirected outside the configured local app")
    recovered = parse_qs(destination.fragment)
    recovery_token = recovered["access_token"][0]
    replacement = secrets.token_urlsafe(32) + "aA1"
    client.put(
        "/user",
        headers={**public_headers, "Authorization": f"Bearer {recovery_token}"},
        json={"password": replacement},
    ).raise_for_status()
    new_session = client.post(
        "/token?grant_type=password",
        headers=public_headers,
        json={"email": email, "password": replacement},
    )
    new_session.raise_for_status()
    old_session = client.post(
        "/token?grant_type=password",
        headers=public_headers,
        json={"email": email, "password": password},
    )
    if old_session.status_code != 400:
        raise RuntimeError("Old password was not rejected after reset")
    reused = client.get(link, follow_redirects=False)
    reused_destination = urlsplit(reused.headers.get("location", ""))
    reused_values = parse_qs(reused_destination.fragment) | parse_qs(reused_destination.query)
    if "access_token" in reused_values or not reused_values.get("error"):
        raise RuntimeError("Used recovery link was not rejected")
    client.post(
        "/logout",
        headers={**public_headers, "Authorization": f"Bearer {new_session.json()['access_token']}"},
    ).raise_for_status()


def cleanup_synthetic_data(
    ids: list[str],
    emails: set[str],
    admin_headers: dict[str, str],
) -> bool:
    success = True
    with httpx.Client(base_url=AUTH_URL, timeout=10, trust_env=False) as client:
        for user_id in ids:
            try:
                client.delete(f"/admin/users/{user_id}", headers=admin_headers).raise_for_status()
                if client.get(f"/admin/users/{user_id}", headers=admin_headers).status_code != 404:
                    success = False
            except Exception:
                success = False
    try:
        with httpx.Client(base_url=MAIL_URL, timeout=10, trust_env=False) as mail:
            response = mail.get("/api/v1/messages", params={"limit": 1000})
            response.raise_for_status()
            message_ids = sorted(
                {
                    message["ID"]
                    for message in response.json()["messages"]
                    if any(recipient["Address"] in emails for recipient in message["To"])
                }
            )
            if message_ids:
                mail.request(
                    "DELETE", "/api/v1/messages", json={"IDs": message_ids}
                ).raise_for_status()
    except Exception:
        success = False
    return success


def main() -> int:
    ids: list[str] = []
    emails: set[str] = set()
    admin_headers: dict[str, str] = {}
    result = 0
    stage = "local CLI credentials"
    try:
        local_status = status()
        admin_key = os.environ.get("ILP_LOCAL_AUTH_ADMIN_KEY") or local_status["SERVICE_ROLE_KEY"]
        public_key = os.environ.get("ILP_LOCAL_AUTH_PUBLIC_KEY") or local_status["ANON_KEY"]
        admin_headers = {"apikey": admin_key, "Authorization": f"Bearer {admin_key}"}
        public_headers = {"apikey": public_key}
        with (
            httpx.Client(base_url=AUTH_URL, timeout=10, trust_env=False) as client,
            httpx.Client(base_url=MAIL_URL, timeout=10, trust_env=False) as mail,
        ):
            for label in ["a", "b"]:
                stage = "synthetic account creation"
                email = f"ilp-synthetic-{label}-{uuid.uuid4().hex[:10]}@example.test"
                emails.add(email)
                password = secrets.token_urlsafe(32) + "aA1"
                created = client.post(
                    "/admin/users",
                    headers=admin_headers,
                    json={"email": email, "password": password, "email_confirm": True},
                )
                created.raise_for_status()
                user_id = str(created.json()["id"])
                ids.append(user_id)
                stage = "synthetic login"
                signed_in = client.post(
                    "/token?grant_type=password",
                    headers=public_headers,
                    json={"email": email, "password": password},
                )
                signed_in.raise_for_status()
                if signed_in.json()["user"]["id"] != user_id:
                    raise RuntimeError("Synthetic identity mismatch")
                stage = "captured email and password-reset journey"
                verify_recovery(client, mail, email, password, public_headers)
            if len(set(ids)) != 2:
                raise RuntimeError("Synthetic identities are not distinct")
            stage = "public signup blocking"
            signup = client.post(
                "/signup",
                headers=public_headers,
                json={"email": "not-permitted@example.test", "password": secrets.token_urlsafe(32)},
            )
            if (
                signup.status_code not in {400, 422}
                or signup.json().get("error_code") != "signup_disabled"
            ):
                raise RuntimeError("Public signup blocking was not confirmed")
        print(
            "Two synthetic identities: login, captured recovery email, password reset, "
            "old-password rejection, used-link rejection, logout, and blocked signup passed.",
            flush=True,
        )
    except Exception as error:
        # Never echo HTTP errors, credentials, passwords, or reset links.
        print(f"Local Auth smoke failed at {stage} ({type(error).__name__}); details redacted.")
        result = 1
    finally:
        if ids or emails:
            if cleanup_synthetic_data(ids, emails, admin_headers):
                print("Temporary accounts and their captured emails removed.", flush=True)
            else:
                print(
                    "Synthetic cleanup was incomplete; inspect local Studio/mail. Details redacted."
                )
                result = 1
    return result


if __name__ == "__main__":
    raise SystemExit(main())
