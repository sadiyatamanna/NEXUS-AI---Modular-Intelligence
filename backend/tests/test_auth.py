def test_user_registration_and_login(client):
    email = "newuser@nexus.ai"
    password = "SecurePassword123!"

    # Registration
    reg_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "full_name": "New Platform User"}
    )
    assert reg_resp.status_code == 200
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == email

    # Duplicate registration rejection
    dup_resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password}
    )
    assert dup_resp.status_code == 400

    # Successful login
    login_resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": password}
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # Profile lookup with token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == email

    # Invalid password rejection
    bad_login = client.post(
        "/api/auth/login",
        json={"email": email, "password": "WrongPassword!"}
    )
    assert bad_login.status_code == 401
