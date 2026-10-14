import pytest

def test_conversation_lifecycle_and_ownership(client, test_user_headers, second_user_headers):
    alice_headers, alice_user = test_user_headers
    bob_headers, bob_user = second_user_headers

    # 1. A conversation can be created
    create_resp = client.post(
        "/api/conversations",
        headers=alice_headers,
        json={"title": "Architecture Discussion", "model_id": "gemini-2.5-flash"}
    )
    assert create_resp.status_code == 201
    conv = create_resp.json()
    conv_id = conv["id"]
    assert conv["title"] == "Architecture Discussion"
    assert conv["user_id"] == alice_user.id

    # 2. A message can be persisted
    msg_resp1 = client.post(
        f"/api/conversations/{conv_id}/messages",
        headers=alice_headers,
        json={"role": "user", "content": "How do we structure the RAG pipeline?"}
    )
    assert msg_resp1.status_code == 201
    msg1 = msg_resp1.json()
    assert msg1["content"] == "How do we structure the RAG pipeline?"

    msg_resp2 = client.post(
        f"/api/conversations/{conv_id}/messages",
        headers=alice_headers,
        json={"role": "assistant", "content": "We extract text, chunk semantically, and index in Qdrant."}
    )
    assert msg_resp2.status_code == 201
    msg2 = msg_resp2.json()

    # 3. The conversation can be retrieved
    get_resp = client.get(f"/api/conversations/{conv_id}", headers=alice_headers)
    assert get_resp.status_code == 200
    retrieved = get_resp.json()

    # 4. Its messages appear in the correct order
    assert len(retrieved["messages"]) == 2
    assert retrieved["messages"][0]["id"] == msg1["id"]
    assert retrieved["messages"][1]["id"] == msg2["id"]
    assert retrieved["messages"][0]["role"] == "user"
    assert retrieved["messages"][1]["role"] == "assistant"

    # 5. List conversations includes the newly created one
    list_resp = client.get("/api/conversations", headers=alice_headers)
    assert list_resp.status_code == 200
    conv_list = list_resp.json()
    assert any(c["id"] == conv_id for c in conv_list)

    # 6. A second user's request CANNOT access the first user's conversation (Strict 403 Forbidden)
    bob_get_resp = client.get(f"/api/conversations/{conv_id}", headers=bob_headers)
    assert bob_get_resp.status_code == 403

    bob_post_msg_resp = client.post(
        f"/api/conversations/{conv_id}/messages",
        headers=bob_headers,
        json={"role": "user", "content": "Injected message"}
    )
    assert bob_post_msg_resp.status_code == 403

    bob_delete_resp = client.delete(f"/api/conversations/{conv_id}", headers=bob_headers)
    assert bob_delete_resp.status_code == 403

    # 7. Missing resources return appropriate HTTP 404
    non_existent_resp = client.get("/api/conversations/non-existent-uuid-9999", headers=alice_headers)
    assert non_existent_resp.status_code == 404

    # 8. Update conversation title
    update_resp = client.put(
        f"/api/conversations/{conv_id}",
        headers=alice_headers,
        json={"title": "Updated Architecture Title"}
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["title"] == "Updated Architecture Title"

    # 9. Clean deletion by owner
    del_resp = client.delete(f"/api/conversations/{conv_id}", headers=alice_headers)
    assert del_resp.status_code == 204

    # Verification of deletion
    verify_resp = client.get(f"/api/conversations/{conv_id}", headers=alice_headers)
    assert verify_resp.status_code == 404
