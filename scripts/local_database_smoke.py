"""Verify the local database foundation without persisting or printing credentials."""

import asyncio
import os
import subprocess
import sys
from urllib.parse import urlsplit

import httpx
from ilp.infrastructure.settings import get_settings
from ilp.main import create_app
from local_auth_smoke import main as auth_smoke
from local_services import ROOT, status
from sqlalchemy import create_engine, text


async def check_readiness() -> None:
    transport = httpx.ASGITransport(app=create_app())
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/ready")
        if response.status_code != 200 or response.json() != {"status": "ready"}:
            raise RuntimeError("Readiness did not reflect the real local database")
        if response.headers.get("cache-control") != "no-store":
            raise RuntimeError("Readiness response was cacheable")


def check_migrations(database_url: str) -> None:
    # Repeat upgrade to verify a second invocation leaves the baseline intact.
    for _ in range(2):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode:
            raise RuntimeError("Local migration failed; connection output withheld")
    engine = create_engine(database_url, hide_parameters=True)
    try:
        with engine.connect() as connection:
            revision = connection.execute(
                text("SELECT version_num FROM ilp_migrations.alembic_version")
            ).scalar_one()
            if revision != "0001_foundation":
                raise RuntimeError("Unexpected foundation revision")
            for role in ["anon", "authenticated"]:
                permitted = connection.execute(
                    text("SELECT has_schema_privilege(:role, 'ilp_migrations', 'USAGE')"),
                    {"role": role},
                ).scalar_one()
                if permitted:
                    raise RuntimeError("Migration metadata is exposed to a browser role")
    finally:
        engine.dispose()


def check_data_api(public_key: str) -> None:
    with httpx.Client(timeout=10, trust_env=False) as client:
        response = client.get("http://127.0.0.1:54321/rest/v1/", headers={"apikey": public_key})
        response.raise_for_status()
        if response.json().get("paths", {}).get("/alembic_version"):
            raise RuntimeError("Migration metadata was exposed in the Data API")


def main() -> int:
    stage = "local status"
    try:
        local_status = status()
        database_url = local_status["DB_URL"]
        parsed = urlsplit(database_url)
        if parsed.hostname != "127.0.0.1" or parsed.port != 54322:
            raise RuntimeError("Only this project's loopback database is allowed")
        database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        os.environ["ILP_DATABASE_URL"] = database_url
        get_settings.cache_clear()
        stage = "database migration and metadata isolation"
        check_migrations(database_url)
        print(
            "Foundation migration applied twice; revision and metadata isolation passed.",
            flush=True,
        )
        stage = "database-backed API readiness"
        asyncio.run(check_readiness())
        print("API readiness passed against the real local PostgreSQL database.", flush=True)
        stage = "local Data API"
        check_data_api(local_status["ANON_KEY"])
        print("Local Data API responded without exposing migration metadata.", flush=True)
        stage = "synthetic Auth and captured email"
        if auth_smoke():
            return 1
    except Exception as error:
        print(f"Local database smoke failed at {stage} ({type(error).__name__}); details redacted.")
        return 1
    print("Local foundation integration checks passed. Hosted acceptance remains separate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
