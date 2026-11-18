import subprocess
from unittest.mock import patch

import pytest
from docker_loopback import loopback_arguments
from local_services import manage, verify_loopback_ports


def project_create(*ports: str) -> list[str]:
    return [
        "create",
        "--name",
        "supabase_db_i-love-people",
        "--network",
        "ilp-local",
        *[argument for port in ports for argument in ("-p", port)],
        "postgres:synthetic",
        "-p",
        "5432",
    ]


def test_bind_before_container_creation_and_preserve_container_command() -> None:
    result = loopback_arguments(project_create("54322:5432", "54324:8025/tcp"))
    assert result[-3:] == ["postgres:synthetic", "-p", "5432"]
    assert "127.0.0.1:54322:5432" in result
    assert "127.0.0.1:54324:8025/tcp" in result


def test_existing_loopback_binding_is_idempotent() -> None:
    args = project_create("127.0.0.1:54322:5432")
    assert loopback_arguments(args) == args


@pytest.mark.parametrize("mapping", ["0.0.0.0:54322:5432", "[::]:54322:5432", "5432", "bad"])
def test_unsupported_or_public_bindings_fail_closed(mapping: str) -> None:
    with pytest.raises(RuntimeError):
        loopback_arguments(project_create(mapping))


@pytest.mark.parametrize("change", ["name", "network", "publish-all", "unknown"])
def test_unrelated_project_or_changed_cli_options_are_rejected(change: str) -> None:
    args = project_create("54322:5432")
    if change == "name":
        args[2] = "supabase_db_other-project"
    elif change == "network":
        args[4] = "other-network"
    else:
        args.insert(1, "--publish-all" if change == "publish-all" else "--future-option")
    with pytest.raises(RuntimeError):
        loopback_arguments(args)


def test_option_values_and_non_creation_commands_are_not_interpreted_as_flags() -> None:
    args = ["exec", "supabase_db_i-love-people", "psql", "-p", "5432"]
    assert loopback_arguments(args) == args
    args = project_create("54322:5432")
    args[1:1] = ["--env", "-p", "--health-cmd", "pg_isready -p 5432"]
    result = loopback_arguments(args)
    assert result[1:5] == args[1:5]


def test_start_stops_stack_when_inspection_finds_public_port() -> None:
    with (
        patch("local_services.ensure_loopback_network"),
        patch("local_services.verify_loopback_ports", side_effect=RuntimeError("bad binding")),
        patch("local_services.capture", return_value=subprocess.CompletedProcess([], 0)) as capture,
        pytest.raises(RuntimeError, match="Stack stopped"),
    ):
        manage("start")
    assert capture.call_args_list[-1].args == ("stop",)


@pytest.mark.parametrize("host", ["0.0.0.0", "::", "", "192.0.2.10"])
def test_measured_public_or_missing_bind_address_is_rejected(host: str) -> None:
    import json

    with (
        patch("local_services.shutil.which", return_value="docker"),
        patch(
            "local_services.subprocess.run",
            side_effect=[
                subprocess.CompletedProcess([], 0, stdout="synthetic-container\n"),
                subprocess.CompletedProcess(
                    [],
                    0,
                    stdout=json.dumps(
                        {
                            "5432/tcp": [{"HostIp": host, "HostPort": "54322"}],
                        }
                    ),
                ),
            ],
        ),
        pytest.raises(RuntimeError, match="outside IPv4 loopback"),
    ):
        verify_loopback_ports()


def test_missing_service_port_is_rejected_even_if_present_ports_are_loopback() -> None:
    with (
        patch("local_services.shutil.which", return_value="docker"),
        patch(
            "local_services.subprocess.run",
            side_effect=[
                subprocess.CompletedProcess([], 0, stdout="synthetic-container\n"),
                subprocess.CompletedProcess(
                    [], 0, stdout='{"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"54322"}]}'
                ),
            ],
        ),
        pytest.raises(RuntimeError, match="do not match"),
    ):
        verify_loopback_ports()
