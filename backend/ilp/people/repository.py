from typing import Any
from uuid import UUID

import httpx

from ilp.auth.models import Identity


class JournalFailure(Exception):
    def __init__(self, status: int) -> None:
        self.status = status


class PeopleRepository:
    def __init__(self, url: str, key: str) -> None:
        self.url, self.key = url, key

    def request(
        self,
        account: Identity,
        path: str,
        *,
        body: dict[str, Any] | None = None,
        params: dict[str, str] | None = None,
    ) -> Any:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.request(
                "GET" if body is None else "POST",
                self.url + "/rest/v1/" + path,
                headers={"apikey": self.key, "Authorization": "Bearer " + account.token},
                params=params,
                json=body,
            )
        if response.is_error:
            code = response.json().get("code", "")
            status = {
                "P0002": 404,
                "40001": 409,
                "PT409": 409,
                "23505": 409,
                "23514": 422,
                "22007": 422,
            }.get(code, 503)
            raise JournalFailure(status)
        return response.json()

    def rows(self, account: Identity, table: str, params: dict[str, str]) -> list[Any]:
        rows: list[Any] = []
        while True:
            page = self.request(
                account, table, params={**params, "limit": "500", "offset": str(len(rows))}
            )
            rows.extend(page)
            if len(page) < 500:
                return rows

    def people(self, account: Identity) -> Any:
        return self.rows(
            account,
            "people",
            {
                "select": "*,meetups(completed_on)",
                "owner_id": "eq." + str(account.owner_id),
                "order": "name,id",
                "meetups.order": "completed_on.desc",
                "meetups.limit": "1",
            },
        )

    def meetups(self, account: Identity, person: UUID) -> Any:
        return self.rows(
            account,
            "meetups",
            {
                "select": "*",
                "person_id": "eq." + str(person),
                "owner_id": "eq." + str(account.owner_id),
                "order": "completed_on.desc,id",
            },
        )

    def write(
        self, account: Identity, action: str, target: UUID, revision: int, payload: dict[str, Any]
    ) -> Any:
        return self.request(
            account,
            "rpc/nudge_write" if action == "nudge" else "rpc/journal_write",
            body={
                "action": action,
                "target": str(target),
                "expected": revision,
                "payload": payload,
            },
        )
