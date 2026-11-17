"""Body weight: one weigh-in per day."""

from fastapi.testclient import TestClient


def test_log_replace_list_and_delete(client: TestClient) -> None:
    assert client.get("/api/body").json() == []
    assert client.put("/api/body/2026-11-03", json={"weightLb": 159.4}).json() == {"date": "2026-11-03", "weightLb": 159.4}
    client.put("/api/body/2026-10-01", json={"weightLb": 161})
    client.put("/api/body/2026-11-03", json={"weightLb": 159.6})  # the same day again replaces it
    assert client.get("/api/body").json() == [{"date": "2026-10-01", "weightLb": 161}, {"date": "2026-11-03", "weightLb": 159.6}]
    assert client.delete("/api/body/2026-10-01").status_code == 204
    assert [w["date"] for w in client.get("/api/body").json()] == ["2026-11-03"]


def test_bad_dates_and_weights_are_rejected(client: TestClient) -> None:
    assert client.put("/api/body/yesterday", json={"weightLb": 160}).status_code == 422
    assert client.put("/api/body/2026-13-40", json={"weightLb": 160}).status_code == 422
    assert client.put("/api/body/2026-11-03", json={"weightLb": 5}).status_code == 422
