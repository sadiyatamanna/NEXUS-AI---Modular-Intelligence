import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models import User, Conversation, Message
from app.main import app

# In-memory test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_nexus.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    import os
    try:
        if os.path.exists("./test_nexus.db"):
            os.remove("./test_nexus.db")
    except Exception:
        pass

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def test_user_headers(db_session):
    user = db_session.query(User).filter(User.email == "alice@nexus.ai").first()
    if not user:
        user = User(
            email="alice@nexus.ai",
            hashed_password=get_password_hash("Password123!"),
            full_name="Alice Architect",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}, user

@pytest.fixture
def second_user_headers(db_session):
    user = db_session.query(User).filter(User.email == "bob@nexus.ai").first()
    if not user:
        user = User(
            email="bob@nexus.ai",
            hashed_password=get_password_hash("Password456!"),
            full_name="Bob Operator",
            is_active=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}, user
