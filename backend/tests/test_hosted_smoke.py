import httpx
import pytest
from hosted_smoke import SmokeFailure, check_preview


def preview(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/health":
        return httpx.Response(
            200,
            json={"status": "ok", "service": "i-love-people-api"},
            headers={"cache-control": "no-store"},
        )
    if path == "/api/ready":
        return httpx.Response(200, json={"status": "ready"}, headers={"cache-control": "no-store"})
    if path.startswith("/api/"):
        return httpx.Response(404)
    if path.startswith("/assets/"):
        return httpx.Response(
            200, text="/* synthetic */", headers={"content-type": "text/javascript"}
        )
    return httpx.Response(
        200,
        text='<div id="root"></div><script src="/assets/app.js"></script>',
        headers={
            "content-type": "text/html",
            "x-content-type-options": "nosniff",
            "referrer-policy": "no-referrer",
            "permissions-policy": "camera=(), microphone=(), geolocation=()",
            "content-security-policy": (
                "default-src 'self'; object-src 'none'; frame-ancestors 'none'"
            ),
        },
    )


def test_preview_checks_routing_assets_and_database_readiness() -> None:
    assert len(check_preview("https://preview.example", httpx.MockTransport(preview))) == 8


@pytest.mark.parametrize("broken", ["/api/health", "/api/ready", "/assets/app.js"])
def test_spa_fallback_or_unavailable_dependency_fails(broken: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == broken:
            return httpx.Response(200, text="<html>synthetic-secret</html>")
        return preview(request)

    with pytest.raises(SmokeFailure) as failure:
        check_preview("https://preview.example", httpx.MockTransport(handler))
    assert "synthetic-secret" not in str(failure.value)


@pytest.mark.parametrize(
    "origin",
    [
        "http://preview.example",
        "https://user:secret@preview.example",
        "https://preview.example/?key=x",
    ],
)
def test_preview_requires_clean_https_origin(origin: str) -> None:
    with pytest.raises(SmokeFailure):
        check_preview(origin)


@pytest.mark.parametrize("failure", ["redirect", "header", "readiness", "api-fallback"])
def test_preview_rejects_incomplete_deployments(failure: str) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if failure == "redirect":
            return httpx.Response(307, headers={"location": "https://login.example"})
        if failure == "readiness" and request.url.path == "/api/ready":
            return httpx.Response(503, json={"detail": "Service temporarily unavailable"})
        if failure == "api-fallback" and request.url.path == "/api/phase-zero-missing":
            return httpx.Response(200, text="<html>SPA</html>")
        response = preview(request)
        if failure == "header":
            response.headers.pop("content-security-policy", None)
        return response

    with pytest.raises(SmokeFailure):
        check_preview("https://preview.example", httpx.MockTransport(handler))
