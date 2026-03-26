from fastapi.testclient import TestClient

from app import app

client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_latest_risk():
    response = client.post("/chat", json={"message": "What is the latest risk for AAPL?"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "latest_risk"
    assert "AAPL" in data["reply"]


def test_compare():
    response = client.post("/chat", json={"message": "Compare AAPL and BTC-USD"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "compare_assets"


def test_explain_term():
    response = client.post("/chat", json={"message": "Explain volatility"})
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "explain_term"
