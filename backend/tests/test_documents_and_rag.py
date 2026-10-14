import io

def test_document_upload_and_rag_query(client, test_user_headers):
    headers, _ = test_user_headers

    # Upload test document
    doc_content = (
        "Nexus AI Platform Security Specifications.\n"
        "All conversations enforce strict tenant isolation and user ownership filters.\n"
        "Database connections utilize connection pooling and parameterized queries.\n"
        "Vector search matches payloads using cosine similarity rankings."
    )
    file_tuple = ("security_policy.txt", io.BytesIO(doc_content.encode("utf-8")), "text/plain")

    upload_resp = client.post(
        "/api/documents/upload",
        headers=headers,
        files={"file": file_tuple}
    )
    assert upload_resp.status_code == 201
    doc_data = upload_resp.json()
    assert doc_data["status"] == "ready"
    assert doc_data["chunk_count"] > 0
    doc_id = doc_data["id"]

    # Query RAG
    rag_resp = client.post(
        "/api/rag/query",
        headers=headers,
        json={"query": "How are database connections handled?"}
    )
    assert rag_resp.status_code == 200
    rag_data = rag_resp.json()
    assert rag_data["context_used"] is True
    assert len(rag_data["citations"]) > 0
    assert any("database" in c["snippet"].lower() for c in rag_data["citations"])

    # Clean delete
    del_resp = client.delete(f"/api/documents/{doc_id}", headers=headers)
    assert del_resp.status_code == 204
