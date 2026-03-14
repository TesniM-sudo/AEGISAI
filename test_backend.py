from fastapi.testclient import TestClient
from backend import app

client = TestClient(app)

def test_get_data():
    response = client.get("/get-data?symbol=BTC-USD")
    assert response.status_code == 200

def test_risk_latest():
    response = client.get("/risk/latest?symbol=BTC-USD")
    assert response.status_code == 200