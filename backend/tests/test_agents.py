def test_list_agent_tools(client):
    response = client.get("/api/agents/tools")
    assert response.status_code == 200
    tools = response.json()
    tool_names = [t["name"] for t in tools]
    assert "calculator" in tool_names
    assert "web_search" in tool_names
    assert "system_diagnostics" in tool_names

def test_execute_agent_task_with_trace(client, test_user_headers):
    headers, _ = test_user_headers

    task_payload = {
        "agent_name": "NexusArchitect",
        "task": "Calculate 25 * (14.5 + 2.5) and check system status",
        "max_steps": 5
    }
    response = client.post("/api/agents/execute", headers=headers, json=task_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert len(data["steps"]) >= 2
    assert "Result" in data["result"]

    # Verify history persists the run
    hist_resp = client.get("/api/agents/history", headers=headers)
    assert hist_resp.status_code == 200
    history = hist_resp.json()
    assert any(h["id"] == data["id"] for h in history)
