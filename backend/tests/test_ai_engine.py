def test_ai_models_and_capabilities(client):
    response = client.get("/api/ai/models")
    assert response.status_code == 200
    models = response.json()
    assert len(models) >= 3

    model_ids = [m["id"] for m in models]
    assert "gemini-2.5-flash" in model_ids
    assert "gpt-4.1-nano" in model_ids
    assert "gpt-4o-mini-tts" in model_ids

    # Verify TTS capability is flagged strictly for audio, not text
    tts_model = next(m for m in models if m["id"] == "gpt-4o-mini-tts")
    assert tts_model["capabilities"]["audio_tts"] is True
    assert tts_model["capabilities"]["text"] is False

def test_ai_chat_completion(client, test_user_headers):
    headers, _ = test_user_headers

    chat_payload = {
        "model_id": "gemini-2.5-flash",
        "message": "Hello Nexus AI! Please explain system architecture."
    }
    response = client.post("/api/ai/chat", headers=headers, json=chat_payload)
    assert response.status_code == 200
    data = response.json()
    assert "conversation_id" in data
    assert data["assistant_message"]["content"] != ""
    assert data["user_message"]["content"] == chat_payload["message"]
    assert data["model_id"] == "gemini-2.5-flash"

def test_reject_chat_on_pure_tts_model(client, test_user_headers):
    headers, _ = test_user_headers

    # Attempting text chat with TTS model must be rejected with 400
    chat_payload = {
        "model_id": "gpt-4o-mini-tts",
        "message": "Can you chat with me?"
    }
    response = client.post("/api/ai/chat", headers=headers, json=chat_payload)
    assert response.status_code == 400

def test_tts_audio_generation(client):
    response = client.get("/api/ai/tts?text=Welcome+to+Nexus+AI")
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert len(response.content) > 0
