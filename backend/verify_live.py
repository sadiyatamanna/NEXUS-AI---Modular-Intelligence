import httpx

def main():
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=10.0) as client:
        # 1. Health check
        h = client.get("/api/health")
        print(f"Health: {h.status_code} -> {h.json()['status']}")
        assert h.status_code == 200

        # 2. Models list
        models = client.get("/api/ai/models").json()
        print(f"Models: {len(models)} configured models")
        assert len(models) >= 3

        # 3. Create conversation
        c = client.post("/api/conversations", json={"title": "Live E2E Verification", "model_id": "gemini-2.5-flash"})
        print(f"Create Conversation: {c.status_code}")
        assert c.status_code == 201
        conv_id = c.json()["id"]

        # 4. Persist message
        m = client.post(f"/api/conversations/{conv_id}/messages", json={"role": "user", "content": "Live test message"})
        print(f"Persist Message: {m.status_code}")
        assert m.status_code == 201

        # 5. AI Chat completion
        chat = client.post("/api/ai/chat", json={
            "conversation_id": conv_id,
            "model_id": "gemini-2.5-flash",
            "message": "Verify system components."
        })
        print(f"Chat Completion: {chat.status_code}")
        assert chat.status_code == 200
        print("Assistant Reply:", chat.json()["assistant_message"]["content"][:90])

        # 6. Retrieve conversation history
        conv_full = client.get(f"/api/conversations/{conv_id}").json()
        print(f"Retrieved Messages: {len(conv_full['messages'])} ordered messages in conversation")
        assert len(conv_full["messages"]) >= 2

        print("\nALL LIVE E2E HTTP VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
