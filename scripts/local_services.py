"""Run local Supabase without exposing its credential-bearing CLI output."""

import json
import os
import shutil
import subprocess
import sys
import tomllib
from pathlib import Path

from distlib.scripts import ScriptMaker, enquote_executable  # type: ignore[import-untyped]

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
        env=supabase_environment(),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )


def supabase_environment() -> dict[str, str]:
    environment = local_environment()
    docker = shutil.which("docker", path=environment["PATH"])
    if not docker:
        raise RuntimeError("Install/start Docker Desktop before using local Supabase.")
    directory = ROOT / ".tools/docker-loopback"
    directory.mkdir(parents=True, exist_ok=True)
    maker = ScriptMaker(None, str(directory))
    maker.executable = enquote_executable(sys.executable)
    maker.variants = {""}
    maker.clobber = True
    maker.set_mode = True
    maker.make("docker = docker_loopback:main")
    environment["ILP_REAL_DOCKER"] = docker
    environment["PATH"] = str(directory) + os.pathsep + environment["PATH"]
    environment["PYTHONPATH"] = (
        str(ROOT / "scripts") + os.pathsep + environment.get("PYTHONPATH", "")
    )
    return environment


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
    if action == "start":
        try:
            verify_loopback_ports()
        except Exception:
            stopped = capture("stop", timeout=120)
            suffix = (
                "Stack stopped." if stopped.returncode == 0 else "Stop the project stack manually."
            )
            raise RuntimeError("Local port isolation could not be verified. " + suffix) from None
    print(f"Local Supabase {action} completed. Credentials were not logged.", flush=True)


def verify_loopback_ports() -> None:
    environment = local_environment()
    docker = shutil.which("docker", path=environment["PATH"])
    if not docker:
        raise RuntimeError("Docker CLI is unavailable.")
    listed = subprocess.run(
        [docker, "ps", "-q", "--filter", "label=com.supabase.cli.project=i-love-people"],
        env=environment,
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    identifiers = listed.stdout.split()
    if not identifiers:
        raise RuntimeError("No project containers are running.")
    result = subprocess.run(
        [docker, "inspect", *identifiers, "--format", "{{json .NetworkSettings.Ports}}"],
        env=environment,
        capture_output=True,
        text=True,
        check=True,
        timeout=15,
    )
    published: set[int] = set()
    for line in result.stdout.splitlines():
        ports = json.loads(line)
        for bindings in ports.values():
            for binding in bindings or []:
                if binding["HostIp"] != "127.0.0.1":
                    raise RuntimeError("A project service is published outside IPv4 loopback.")
                published.add(int(binding["HostPort"]))
    config = tomllib.loads((ROOT / "supabase/config.toml").read_text(encoding="utf-8"))
    expected = {int(config[key]["port"]) for key in ("api", "db", "studio", "local_smtp")}
    if published != expected:
        raise RuntimeError("The running stack's ports do not match the project configuration.")
    print("Verified four published service ports are bound explicitly to 127.0.0.1.", flush=True)


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
    verify_loopback_ports()
    result = capture("status", "--output", "json")
    if result.returncode:
        raise RuntimeError("Local Supabase status is unavailable; start the project stack first.")
    payload = json.loads(result.stdout)
    if not isinstance(payload, dict):
        raise RuntimeError("Local Supabase status returned an unexpected shape.")
    return {key: value for key, value in payload.items() if isinstance(value, str)}
