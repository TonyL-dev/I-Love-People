import subprocess
from unittest.mock import patch

import pytest
from local_services import manage


def test_start_never_prints_supabase_credentials(capsys: pytest.CaptureFixture[str]) -> None:
    with (
        patch("local_services.ensure_loopback_network"),
        patch(
            "local_services.capture",
            return_value=subprocess.CompletedProcess(
                args=[],
                returncode=0,
                stdout="synthetic-sensitive-key",
                stderr="synthetic-reset-link",
            ),
        ),
    ):
        manage("start")
    output = capsys.readouterr()
    assert "completed" in output.out
    assert "synthetic-sensitive-key" not in output.out + output.err
    assert "synthetic-reset-link" not in output.out + output.err


def test_failed_start_keeps_provider_output_out_of_errors() -> None:
    with (
        patch("local_services.ensure_loopback_network"),
        patch(
            "local_services.capture",
            return_value=subprocess.CompletedProcess(
                args=[],
                returncode=1,
                stdout="synthetic-sensitive-key",
                stderr="synthetic-reset-link",
            ),
        ),
        pytest.raises(RuntimeError) as error,
    ):
        manage("start")
    assert "failed" in str(error.value)
    assert "synthetic-sensitive-key" not in str(error.value)
    assert "synthetic-reset-link" not in str(error.value)
