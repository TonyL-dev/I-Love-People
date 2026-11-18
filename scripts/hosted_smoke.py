"""Read-only Phase 0 preview checks. Set ILP_PREVIEW_URL to an HTTPS origin."""

import os
from html.parser import HTMLParser
from urllib.parse import urlsplit

import httpx


class SmokeFailure(RuntimeError):
    """A deliberately non-sensitive failure suitable for CI output."""


class Assets(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.paths: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        path = values.get("src") if tag == "script" else values.get("href")
        if path and (tag == "script" or (tag == "link" and values.get("rel") == "stylesheet")):
            self.paths.append(path)


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def check_preview(origin: str, transport: httpx.BaseTransport | None = None) -> list[str]:
    parsed = urlsplit(origin)
    require(
        parsed.scheme == "https"
        and bool(parsed.hostname)
        and parsed.username is None
        and parsed.password is None
        and parsed.path in ("", "/")
        and not parsed.query
        and not parsed.fragment,
        "Use a plain HTTPS preview origin without credentials, path, query, or fragment.",
    )
    passed: list[str] = []
    with httpx.Client(
        base_url=origin.rstrip("/"), transport=transport, timeout=30, follow_redirects=False
    ) as client:
        for path in ["/", "/design", "/design/people/maya", "/login"]:
            response = client.get(path)
            require(
                response.status_code == 200, f"Page failed: {path} (redirects are not followed)."
            )
            require("text/html" in response.headers.get("content-type", ""), f"Not HTML: {path}.")
            require('<div id="root">' in response.text, f"SPA entrypoint missing: {path}.")
            for header, value in {
                "x-content-type-options": "nosniff",
                "referrer-policy": "no-referrer",
                "permissions-policy": "camera=(), microphone=(), geolocation=()",
            }.items():
                require(response.headers.get(header) == value, f"Header missing: {header}.")
            policy = response.headers.get("content-security-policy", "")
            for directive in ["default-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]:
                require(directive in policy, "Expected CSP directive missing.")
            passed.append(f"HTTPS, SPA routing and headers: {path}")
            if path == "/":
                assets = Assets()
                assets.feed(response.text)
                require(bool(assets.paths), "No built assets found.")
                for asset in assets.paths:
                    require(
                        asset.startswith("/assets/") and not urlsplit(asset).netloc,
                        "Expected locally bundled production assets.",
                    )
                    built = client.get(asset)
                    require(built.status_code == 200, "Built asset unavailable.")
                    expected = "javascript" if asset.endswith(".js") else "text/css"
                    require(
                        expected in built.headers.get("content-type", ""),
                        "Built asset has wrong content type (possible SPA fallback).",
                    )
                passed.append("Production JavaScript and CSS delivery")
        for path, expected_body in [
            ("/api/health", {"status": "ok", "service": "i-love-people-api"}),
            ("/api/ready", {"status": "ready"}),
        ]:
            response = client.get(path)
            require(response.status_code == 200, f"API check failed: {path}.")
            require("application/json" in response.headers.get("content-type", ""), "API not JSON.")
            require(response.json() == expected_body, f"Unexpected API contract: {path}.")
            require(response.headers.get("cache-control") == "no-store", "API no-store missing.")
            passed.append(f"Python API: {path}")
        require(client.get("/api/phase-zero-missing").status_code == 404, "API 404 fell into SPA.")
        passed.append("Unknown API route returns 404")
    return passed


def main() -> int:
    try:
        for result in check_preview(os.environ.get("ILP_PREVIEW_URL", "")):
            print(f"PASS: {result}")
    except SmokeFailure as error:
        print(f"FAIL: {error}")
        return 1
    except Exception:
        # Transport/provider errors can embed URLs or credentials. Do not print them.
        print("FAIL: Preview request could not be verified; check deployment and connectivity.")
        return 1
    print("Hosted HTTP smoke passed. CI, browser and device evidence are separate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
