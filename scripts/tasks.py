"""Repository tasks. Run from any directory with the project's Python 3.12+ environment."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def node() -> str:
    portable = ROOT / ".tools/js/node_modules/node/bin/node.exe"
    executable = str(portable) if portable.exists() else shutil.which("node")
    if not executable:
        raise RuntimeError("Install Node 24 or run scripts/bootstrap.ps1 first.")
    return executable


def run(*command: str, capture: bool = False) -> str:
    environment = dict(os.environ)
    environment["PATH"] = str(Path(node()).parent) + os.pathsep + environment.get("PATH", "")
    result = subprocess.run(
        command,
        cwd=ROOT,
        env=environment,
        check=True,
        text=True,
        stdout=subprocess.PIPE if capture else None,
    )
    return result.stdout if capture else ""


def local_services(action: str) -> None:
    from local_services import manage

    manage(action)


def pnpm(*arguments: str, capture: bool = False) -> str:
    portable = ROOT / ".tools/js/node_modules/pnpm/bin/pnpm.cjs"
    if portable.exists():
        return run(node(), str(portable), *arguments, capture=capture)
    executable = shutil.which("pnpm")
    if not executable:
        raise RuntimeError("Install pnpm 11.19.0 or run scripts/bootstrap.ps1 first.")
    return run(executable, *arguments, capture=capture)


def verify_tools() -> None:
    if sys.version_info < (3, 12):  # noqa: UP036 - give the system Python a useful error.
        raise RuntimeError("Use Python 3.12+: .venv/Scripts/python.exe scripts/tasks.py <task>.")
    if not run(node(), "--version", capture=True).strip().startswith("v24."):
        raise RuntimeError("This project requires Node 24.")
    if pnpm("--version", capture=True).strip() != "11.19.0":
        raise RuntimeError("This project requires pnpm 11.19.0.")


def contracts(check: bool) -> None:
    from ilp.main import create_app

    serialized = json.dumps(create_app().openapi(), indent=2, sort_keys=True) + "\n"
    json_path = ROOT / "contracts/openapi.json"
    types_path = ROOT / "frontend/src/api/schema.d.ts"
    with tempfile.TemporaryDirectory(prefix="ilp-contract-") as directory:
        schema = Path(directory) / "openapi.json"
        generated = Path(directory) / "schema.d.ts"
        schema.write_text(serialized, encoding="utf-8")
        pnpm("exec", "openapi-typescript", str(schema), "-o", str(generated))
        types = generated.read_text(encoding="utf-8")
    if check:
        for path, expected in [(json_path, serialized), (types_path, types)]:
            if not path.exists() or path.read_text(encoding="utf-8") != expected:
                raise RuntimeError("API contract drift. Run: python scripts/tasks.py contracts")
        print("OpenAPI and TypeScript contracts match.")
    else:
        json_path.parent.mkdir(parents=True, exist_ok=True)
        types_path.parent.mkdir(parents=True, exist_ok=True)
        json_path.write_text(serialized, encoding="utf-8")
        types_path.write_text(types, encoding="utf-8")


def check() -> None:
    verify_tools()
    run(sys.executable, "-m", "ruff", "check", "backend", "scripts")
    run(sys.executable, "-m", "ruff", "format", "--check", "backend", "scripts")
    run(sys.executable, "-m", "mypy")
    run(sys.executable, "-m", "pytest")
    run(sys.executable, "scripts/check_design.py")
    contracts(check=True)
    for task in ["format:check", "lint", "typecheck", "test", "build"]:
        pnpm("run", task)
    print("Local checks passed. Hosted, database integration, and device gates are separate.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "task",
        choices=[
            "check",
            "api",
            "api-local",
            "web",
            "contracts",
            "contracts-check",
            "browser",
            "browser-auth",
            "db-start",
            "db-check",
            "db-stop",
            "migrate",
            "hosted-smoke",
        ],
    )
    args = parser.parse_args()
    if sys.version_info < (3, 12):  # noqa: UP036 - bootstrap may start with Python 3.11.
        parser.error("Use the project's Python 3.12+ interpreter.")
    try:
        match args.task:
            case "check":
                check()
            case "api" | "api-local":
                if args.task == "api-local":
                    from local_services import status

                    local = status()
                    os.environ["ILP_DATABASE_URL"] = local["DB_URL"].replace(
                        "postgresql://", "postgresql+psycopg://", 1
                    )
                    os.environ["ILP_SUPABASE_URL"] = "http://127.0.0.1:54321"
                    os.environ["ILP_SUPABASE_PUBLISHABLE_KEY"] = local["ANON_KEY"]
                run(
                    sys.executable,
                    "-m",
                    "uvicorn",
                    "ilp.main:app",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                    "--no-access-log",
                )
            case "web":
                verify_tools()
                pnpm("run", "dev")
            case "contracts" | "contracts-check":
                contracts(check=args.task == "contracts-check")
            case "browser":
                pnpm("run", "test:browser")
            case "browser-auth":
                run(sys.executable, "scripts/local_browser_auth.py")
            case "db-start":
                local_services("start")
            case "db-stop":
                local_services("stop")
            case "db-check":
                run(sys.executable, "scripts/local_database_smoke.py")
            case "migrate":
                run(sys.executable, "-m", "alembic", "upgrade", "head")
            case "hosted-smoke":
                run(sys.executable, "scripts/hosted_smoke.py")
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
