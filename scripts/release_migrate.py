"""Run a trusted release migration for an explicitly identified hosted project."""

import os
import re
import subprocess
import sys
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, make_url, text

ROOT = Path(__file__).resolve().parents[1]
PREVIEW_REF = "efuixughigoyyyflyelm"


def main() -> int:
    stage = "target validation"
    try:
        project = os.environ["ILP_EXPECTED_SUPABASE_REF"]
        if not re.fullmatch(r"[a-z]{20}", project) or project == PREVIEW_REF:
            raise ValueError("Expected an isolated production project")
        url = make_url(os.environ["ILP_DATABASE_URL"])
        direct = url.host == f"db.{project}.supabase.co" and url.username == "postgres"
        pooler = (
            bool(url.host and url.host.endswith(".pooler.supabase.com"))
            and url.username == f"postgres.{project}"
        )
        if (
            url.drivername != "postgresql+psycopg"
            or not (direct or pooler)
            or url.port not in (None, 5432)
            or url.database != "postgres"
            or set(url.query) - {"sslmode", "sslrootcert"}
            or url.query.get("sslmode") not in ("require", "verify-ca", "verify-full")
        ):
            raise ValueError("Database connection does not match the expected release project")
        stage = "Alembic upgrade"
        subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=ROOT,
            capture_output=True,
            timeout=180,
            check=True,
        )
        stage = "revision verification"
        expected = ScriptDirectory.from_config(Config(str(ROOT / "alembic.ini"))).get_current_head()
        engine = create_engine(url, hide_parameters=True, connect_args={"connect_timeout": 8})
        try:
            with engine.connect() as connection:
                actual = connection.execute(
                    text("SELECT version_num FROM ilp_migrations.alembic_version")
                ).scalar_one()
                if actual != expected:
                    raise ValueError("Unexpected release revision")
        finally:
            engine.dispose()
        print(f"Production schema verified at {expected}.")
        return 0
    except Exception as error:
        print(f"Production migration failed at {stage} ({type(error).__name__}). Details withheld.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
