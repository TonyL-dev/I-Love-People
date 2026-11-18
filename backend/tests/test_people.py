from datetime import date
from unittest.mock import Mock
from uuid import uuid4

import pytest
from ilp.auth.models import AccountProfile, Identity
from ilp.people.models import PersonInput
from ilp.people.repository import JournalFailure
from ilp.people.service import PeopleService
from pydantic import ValidationError


@pytest.mark.parametrize(
    "values",
    [
        {"name": "   "},
        {"name": "Maya", "owner_id": str(uuid4())},
        {"name": "Maya", "cadence_count": 2},
        {"name": "Maya", "cadence_unit": "weeks"},
        {"name": "Maya", "cadence_count": 0, "cadence_unit": "months"},
    ],
)
def test_invalid_person_input(values: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        PersonInput.model_validate(values)


def test_future_date_rejected_before_repository_write() -> None:
    account = Identity(
        owner_id=uuid4(), session_id=uuid4(), email="synthetic@example.test", token="synthetic"
    )
    repository, profiles = Mock(), Mock()
    profiles.read.return_value = AccountProfile(
        owner_id=account.owner_id, timezone="Pacific/Kiritimati"
    )
    service = PeopleService(repository, profiles)
    with pytest.raises(JournalFailure) as failure:
        service.write(
            account,
            "meetup_create",
            uuid4(),
            0,
            {"completed_on": date(2999, 1, 1).isoformat(), "note": ""},
        )
    assert failure.value.status == 422
    repository.write.assert_not_called()


def test_explicit_provider_conflicts_map_to_http_409() -> None:
    from unittest.mock import patch

    import httpx
    from ilp.people.repository import PeopleRepository

    account = Identity(
        owner_id=uuid4(), session_id=uuid4(), email="synthetic@example.test", token="synthetic"
    )
    client = httpx.Client(
        transport=httpx.MockTransport(lambda request: httpx.Response(409, json={"code": "PT409"}))
    )
    with (
        patch("ilp.people.repository.httpx.Client", return_value=client),
        pytest.raises(JournalFailure) as failure,
    ):
        PeopleRepository("https://synthetic.example", "synthetic").write(
            account, "person_edit", uuid4(), 1, {}
        )
    assert failure.value.status == 409
