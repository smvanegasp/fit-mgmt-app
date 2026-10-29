import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_origin_secret_blocks_direct_calls() -> None:
    os.environ["ORIGIN_SECRET"] = "from-cloudfront"
    assert client.get("/api/health").status_code == 403
    ok = client.get("/api/health", headers={"X-Origin-Verify": "from-cloudfront"})
    assert ok.status_code == 200
