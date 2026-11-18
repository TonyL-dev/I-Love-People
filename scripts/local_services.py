"""Run local Supabase without exposing its credential-bearing CLI output."""

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NETWORK = "ilp-local"


def local_environment() -> dict[str, str]:
    environment = dict(os.environ)
    directories = [ROOT / ".tools/js/node_modules/node/bin"]
    if os.name == "nt":
        directories.extend(
            [
                Path(os.environ.get("PROGRAMFILES", "C:/Program Files"))
                / "Docker/Docker/resources/bin",
                Path(os.environ.get("LOCALAPPDATA", "C:/Users/Default/AppData/Local"))
                / "Programs/DockerDesktop/resources/bin",
            ]
        )
    existing = [str(directory) for directory in directories if directory.is_dir()]
    environment["PATH"] = os.pathsep.join([*existing, environment.get("PATH", "")])
    return environment


def command(*arguments: str) -> list[str]:
    portable_node = ROOT / ".tools/js/node_modules/node/bin/node.exe"
    node = str(portable_node) if portable_node.exists() else shutil.which("node")
    if not node:
        raise RuntimeError("Install the project toolchain first; see README.md.")
    # Use the pinned project CLI directly, avoiding a global pnpm version or PATH dependency.
    return [node, str(ROOT / "node_modules/supabase/dist/supabase.js"), *arguments]


def capture(*arguments: str, timeout: int = 30) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command(*arguments),
        cwd=ROOT,
        env=local_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )


def manage(action: str) -> None:
    print(
        f"Supabase {action} requested. First startup may download local container images.",
        flush=True,
    )
    arguments = [action]
    if action == "start":
        ensure_loopback_network()
        arguments.extend(["--network-id", NETWORK])
    result = capture(*arguments, timeout=1200)
    if result.returncode:
        # Both streams can contain keys, connection strings, and recovery links.
        raise RuntimeError(
            f"Local Supabase {action} failed (exit {result.returncode}). "
            "Check Docker's engine and project containers. "
            "Credential-bearing CLI output was withheld."
        )
    print(f"Local Supabase {action} completed. Credentials were not logged.", flush=True)


def ensure_loopback_network() -> None:
    environment = local_environment()
    docker = shutil.which("docker", path=environment["PATH"])
    if not docker:
        raise RuntimeError("Install/start Docker Desktop before starting local Supabase.")
    inspected = subprocess.run(
        [docker, "network", "inspect", NETWORK, "--format", "{{json .Options}}"],
        env=environment,
        capture_output=True,
        text=True,
        timeout=15,
    )
    if inspected.returncode:
        created = subprocess.run(
            [
                docker,
                "network",
                "create",
                "--label",
                "com.ilp.project=i-love-people",
                "--opt",
                "com.docker.network.bridge.host_binding_ipv4=127.0.0.1",
                NETWORK,
            ],
            env=environment,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if created.returncode:
            raise RuntimeError("Could not create the project's loopback-only Docker network.")
    else:
        options = json.loads(inspected.stdout)
        if options.get("com.docker.network.bridge.host_binding_ipv4") != "127.0.0.1":
            raise RuntimeError("The existing ilp-local network does not bind ports to loopback.")


def status() -> dict[str, str]:
    result = capture("status", "--output", "json")
    if result.returncode:
        raise RuntimeError("Local Supabase status is unavailable; start the project stack first.")
    payload = json.loads(result.stdout)
    if not isinstance(payload, dict):
        raise RuntimeError("Local Supabase status returned an unexpected shape.")
    return {key: value for key, value in payload.items() if isinstance(value, str)}
