"""Docker CLI adapter used only by this project's Supabase subprocesses."""

import os
import re
import subprocess
import sys
from pathlib import Path

NETWORK = "ilp-local"
PROJECT = "i-love-people"

# The pinned Supabase CLI's create/run options. Stop at the image so container command
# arguments (including a literal '-p') never become Docker options accidentally.
VALUE_FLAGS = {
    "--name",
    "--hostname",
    "-e",
    "--env",
    "--env-file",
    "-v",
    "--volume",
    "--volumes-from",
    "--tmpfs",
    "-p",
    "--publish",
    "--expose",
    "--health-cmd",
    "--health-interval",
    "--health-timeout",
    "--health-retries",
    "--health-start-period",
    "--health-start-interval",
    "--restart",
    "--security-opt",
    "--add-host",
    "--network",
    "--network-alias",
    "--label",
    "--entrypoint",
    "-w",
    "--workdir",
    "-u",
    "--user",
    "--platform",
    "--memory",
    "--cpus",
    "--mount",
}
BOOLEAN_FLAGS = {"--rm", "-i", "--interactive", "-t", "--tty", "-d", "--detach", "--init"}


def loopback_arguments(arguments: list[str]) -> list[str]:
    if not arguments:
        return arguments
    offset = 2 if arguments[:2] in (["container", "create"], ["container", "run"]) else 1
    if arguments[offset - 1] not in ("create", "run"):
        return arguments
    result = arguments[:offset]
    options: dict[str, str] = {}
    publishes: list[tuple[int, str]] = []
    index = offset
    while index < len(arguments):
        argument = arguments[index]
        if not argument.startswith("-"):
            result.extend(arguments[index:])
            break
        flag, separator, inline = argument.partition("=")
        if flag in BOOLEAN_FLAGS:
            if separator:
                raise RuntimeError("Unsupported Docker boolean option.")
            result.append(argument)
            index += 1
            continue
        if flag not in VALUE_FLAGS:
            raise RuntimeError("Unsupported Docker creation option; review the pinned CLI adapter.")
        index += 1
        if separator:
            value = inline
        else:
            if index >= len(arguments):
                raise RuntimeError("Missing Docker option value.")
            value = arguments[index]
            index += 1
        options[flag] = value
        result.extend([flag, value])
        if flag in ("-p", "--publish"):
            publishes.append((len(result) - 1, value))
    if publishes:
        if (
            options.get("--network") != NETWORK
            or not options.get("--name", "").startswith("supabase_")
            or not options.get("--name", "").endswith("_" + PROJECT)
        ):
            raise RuntimeError("Refusing to publish ports outside this project's Supabase stack.")
        for position, value in publishes:
            mapping = value.removeprefix("127.0.0.1:")
            if not re.fullmatch(r"\d+:\d+(?:/(?:tcp|udp))?", mapping):
                raise RuntimeError(
                    "Unsupported Docker port mapping; explicit loopback is required."
                )
            result[position] = "127.0.0.1:" + mapping
    return result


def main() -> int:
    executable = os.environ.get("ILP_REAL_DOCKER")
    if not executable or not Path(executable).is_file():
        print("Project Docker adapter has no verified Docker executable.", file=sys.stderr)
        return 1
    try:
        arguments = loopback_arguments(sys.argv[1:])
        return subprocess.call([executable, *arguments])
    except Exception:
        # Arguments or provider exceptions can contain credentials. Never echo them.
        print(
            "Project Docker adapter failed; arguments and provider details withheld.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
