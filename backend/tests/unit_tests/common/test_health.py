def test_health_answers_ok(client):
    response = client.get("/api/v1/common/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_api_docs_are_not_public(client):
    response = client.get("/api/docs")
    assert response.status_code in (302, 401, 403, 404)
