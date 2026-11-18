"""Bounded synthetic Auth/RLS checks on the single authorized Preview project.

Runs current Python API source through ASGI against hosted Auth/PostgreSQL/Data API.
This does not establish a deployed Vercel API or real owner-email delivery.
"""

import argparse
import asyncio
import os
import secrets
import subprocess
import sys
import uuid
from urllib.parse import urlsplit

import httpx
from dotenv import dotenv_values
from ilp.infrastructure.settings import get_settings
from local_privacy_smoke import exercise
from local_services import ROOT
from sqlalchemy import create_engine, text

PROJECT = "efuixughigoyyyflyelm"
ORIGIN = f"https://{PROJECT}.supabase.co"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--migrate", action="store_true")
    args = parser.parse_args()
    ids: list[str] = []
    result, stage = 0, "configuration"
    admin: dict[str, str] = {}
    try:
        values = dotenv_values(ROOT / ".env.preview")
        database = values.get("ILP_DATABASE_URL") or ""
        parsed = urlsplit(database)
        assert parsed.scheme == "postgresql+psycopg"
        assert parsed.username == "postgres." + PROJECT
        assert parsed.hostname and parsed.hostname.endswith(".pooler.supabase.com")
        assert parsed.port == 5432 and "sslmode=require" in parsed.query
        secret = values.get("ILP_SUPABASE_ADMIN_KEY") or ""
        assert secret.startswith("sb_secret_")
        public_key = os.environ["ILP_SUPABASE_PUBLISHABLE_KEY"]
        assert public_key.startswith("sb_publishable_")
        admin = {"apikey": secret}
        public = {"apikey": public_key}
        os.environ.update(
            ILP_DATABASE_URL=database,
            ILP_SUPABASE_URL=ORIGIN,
            ILP_ENVIRONMENT="production",
        )
        get_settings.cache_clear()
        with httpx.Client(base_url=ORIGIN + "/auth/v1", timeout=20) as auth:
            stage = "provider-settings"
            settings = auth.get("/settings", headers=public)
            settings.raise_for_status()
            assert settings.json()["disable_signup"] is True
            assert settings.json()["external"]["anonymous_users"] is False
            assert settings.json()["external"]["email"] is True
            admin_probe = auth.get("/admin/users", headers=admin, params={"per_page": 1})
            admin_probe.raise_for_status()
            print("Preview identity, disabled signup/anonymous Auth and admin access verified.")
            stage = "schema-inspection"
            engine = create_engine(database, hide_parameters=True)
            try:
                with engine.connect() as connection:
                    revision = connection.execute(
                        text("SELECT version_num FROM ilp_migrations.alembic_version")
                    ).scalar_one()
                    assert revision in (
                        "0001_foundation",
                        "0002_profiles",
                        "0003_profile_timezone",
                        "0004_people_meetups",
                    )
                    print("Current hosted Alembic revision:", revision)
            finally:
                engine.dispose()
            if args.migrate:
                stage = "migration"
                for _ in range(2):
                    migration = subprocess.run(
                        [sys.executable, "-m", "alembic", "upgrade", "head"],
                        cwd=ROOT,
                        capture_output=True,
                        check=False,
                    )
                    assert migration.returncode == 0
                print("Preview Alembic upgrades completed twice; raw migration output withheld.")
            stage = "signup-denial"
            rejected = auth.post(
                "/signup",
                headers=public,
                json={
                    "email": f"ilp-signup-{uuid.uuid4().hex}@example.test",
                    "password": secrets.token_urlsafe(32) + "aA1",
                },
            )
            assert rejected.status_code in (400, 403, 422)
            assert rejected.json().get("error_code") == "signup_disabled"
        stage = "two-user-api-and-rls"
        asyncio.run(
            exercise(
                public_key,
                secret,
                ids,
                set(),
                auth_url=ORIGIN + "/auth/v1",
                data_url=ORIGIN + "/rest/v1",
                admin_headers=admin,
                check_password_policy=True,
            )
        )
        print(
            "Hosted Auth/Data API + local ASGI: two-user ownership, anonymous denial, "
            "password rules, invalid timezone, logout-token rejection and disabled-account "
            "checks passed."
        )
    except Exception as error:
        print(f"Preview Auth check failed at {stage} ({type(error).__name__}); details withheld.")
        trace = error.__traceback__
        while trace:
            if trace.tb_frame.f_code.co_filename.endswith("local_privacy_smoke.py"):
                print("Privacy check source line:", trace.tb_lineno)
            trace = trace.tb_next
        result = 1
    finally:
        if ids:
            cleaned = True
            try:
                with httpx.Client(base_url=ORIGIN + "/auth/v1", timeout=20) as auth:
                    for owner in ids:
                        deleted = auth.delete("/admin/users/" + owner, headers=admin)
                        if deleted.status_code not in (200, 204):
                            cleaned = False
                        absent = auth.get("/admin/users/" + owner, headers=admin)
                        if absent.status_code != 404:
                            cleaned = False
            except Exception:
                cleaned = False
            print("Disposable hosted users removed and absence verified:", cleaned)
            if not cleaned:
                result = 1
    return result


if __name__ == "__main__":
    raise SystemExit(main())
