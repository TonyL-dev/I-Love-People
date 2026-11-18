"""Run the real browser login/recovery journey with a disposable local user, without traces."""

import json
import secrets
import subprocess
import sys
import time
import uuid

import httpx
from local_auth_smoke import AUTH_URL, cleanup_synthetic_data
from local_services import ROOT, local_environment, status
from tasks import node


def wait_for(url: str) -> None:
    deadline = time.monotonic() + 45
    with httpx.Client(timeout=2, trust_env=False) as client:
        while time.monotonic() < deadline:
            try:
                if client.get(url).status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.25)
    raise RuntimeError("Local review server did not become ready")


def main() -> int:
    children: list[subprocess.Popen[bytes]] = []
    ids: list[str] = []
    emails: set[str] = set()
    admin: dict[str, str] = {}
    result = 0
    stage = "setup"
    try:
        local = status()
        environment = local_environment()
        environment.update(
            {
                "ILP_ENVIRONMENT": "development",
                "ILP_DATABASE_URL": local["DB_URL"].replace(
                    "postgresql://", "postgresql+psycopg://", 1
                ),
                "ILP_SUPABASE_URL": "http://127.0.0.1:54321",
                "ILP_SUPABASE_PUBLISHABLE_KEY": local["ANON_KEY"],
            }
        )
        for arguments, url in [
            (
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "ilp.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                    "--no-access-log",
                ],
                "http://127.0.0.1:8000/api/auth/config",
            ),
            (
                [node(), "node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"],
                "http://127.0.0.1:5173/",
            ),
        ]:
            with httpx.Client(timeout=2, trust_env=False) as client:
                try:
                    existing = client.get(url)
                except httpx.HTTPError:
                    existing = None
            if existing is None:
                children.append(
                    subprocess.Popen(
                        arguments,
                        cwd=ROOT,
                        env=environment,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                )
            wait_for(url)
        with httpx.Client(timeout=10, trust_env=False) as client:
            config = client.get("http://127.0.0.1:8000/api/auth/config").json()
            if (
                config["url"] != "http://127.0.0.1:54321"
                or config["publishable_key"] != local["ANON_KEY"]
            ):
                raise RuntimeError("Existing API is not this local synthetic environment")
            email = f"ilp-browser-{uuid.uuid4().hex[:12]}@example.test"
            password, replacement = (
                secrets.token_urlsafe(32) + "aA1",
                secrets.token_urlsafe(32) + "aA1",
            )
            emails.add(email)
            admin = {
                "apikey": local["ANON_KEY"],
                "Authorization": "Bearer " + local["SERVICE_ROLE_KEY"],
            }
            created = client.post(
                AUTH_URL + "/admin/users",
                headers=admin,
                json={"email": email, "password": password, "email_confirm": True},
            )
            created.raise_for_status()
            ids.append(created.json()["id"])
        completed = subprocess.run(
            [node(), "scripts/local_browser_auth.mjs"],
            cwd=ROOT,
            env=environment,
            input=json.dumps(
                {
                    "email": email,
                    "password": password,
                    "replacement": replacement,
                    "publicKey": local["ANON_KEY"],
                }
            ),
            capture_output=True,
            text=True,
            timeout=180,
        )
        report = json.loads(completed.stdout)
        allowed = {
            "navigation",
            "browser-start",
            "managed-login",
            "owned-preference",
            "reload-and-logout",
            "captured-recovery-email",
            "managed-password-reset",
            "replacement-password",
            "passed",
        }
        stage = report.get("stage") if report.get("stage") in allowed else "browser"
        if completed.returncode or stage != "passed":
            diagnostics = report.get("diagnostics", {})
            safe = {
                key: diagnostics.get(key)
                for key in ("navigation", "loginStatus", "profileStatus", "pageError")
            }
            print("Browser diagnostic flags: " + json.dumps(safe))
            raise RuntimeError("Live journey failed")
        print(
            "Live browser managed login, owned preference, reload/logout "
            "and captured-email password reset passed."
        )
    except Exception as error:
        print(f"Live browser check failed at {stage} ({type(error).__name__}); details withheld.")
        result = 1
    finally:
        if ids and not cleanup_synthetic_data(ids, emails, admin):
            print("Live browser synthetic cleanup was incomplete.")
            result = 1
        for process in children:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        print("Owned review servers stopped; temporary users/mail cleanup attempted.", flush=True)
    return result


if __name__ == "__main__":
    raise SystemExit(main())
