from typing import Any

import httpx


class PrivacyFailure(Exception):
    def __init__(self, status: int) -> None:
        self.status = status


class PrivacyRepository:
    def __init__(self, url: str, public_key: str) -> None:
        self.url, self.public_key = url, public_key

    def rpc(self, token: str, action: str, **params: Any) -> Any:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.post(
                self.url + "/rest/v1/rpc/" + action,
                headers={"apikey": self.public_key, "Authorization": "Bearer " + token},
                json=params,
            )
        if not response.is_success:
            raise PrivacyFailure(
                response.status_code if response.status_code in (403, 409, 413, 422) else 503
            )
        return response.json()

    def password_session(self, email: str, password: str) -> str:
        with httpx.Client(timeout=8, follow_redirects=False) as client:
            response = client.post(
                self.url + "/auth/v1/token",
                params={"grant_type": "password"},
                headers={"apikey": self.public_key},
                json={"email": email, "password": password},
            )
        if response.status_code in (400, 401, 403, 422):
            raise PrivacyFailure(403)
        if response.status_code == 429:
            raise PrivacyFailure(429)
        response.raise_for_status()
        return str(response.json()["access_token"])

    def revoke_password_session(self, token: str) -> None:
        with httpx.Client(timeout=4, follow_redirects=False) as client:
            client.post(
                self.url + "/auth/v1/logout",
                params={"scope": "local"},
                headers={"apikey": self.public_key, "Authorization": "Bearer " + token},
            ).raise_for_status()
