import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    PROJECT_NAME: str = "NEXUS AI"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Environment
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    
    # Security & Auth
    SECRET_KEY: str = Field(default="nexus-ai-production-super-secret-key-change-in-prod-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    DATABASE_URL: str = Field(
        default=f"sqlite:///{os.path.join('/tmp' if os.environ.get('VERCEL') else '.', 'nexus.db')}",
        description="PostgreSQL connection string (e.g. postgresql://user:pass@localhost:5432/nexus) or SQLite fallback"
    )
    
    @property
    def effective_database_url(self) -> str:
        """Enforces writable /tmp directory for SQLite on serverless hosts (Vercel / Lambda)."""
        url = self.DATABASE_URL
        if (os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")) and url.startswith("sqlite"):
            return "sqlite:////tmp/nexus.db"
        return url
    
    # AI Providers & Integrations
    NEXUS_API_BASE_URL: str = Field(
        default="https://nexusapi.navigatelabs.ai/v1",
        description="NavigateLabs Nexus API base endpoint"
    )
    NEXUS_API_KEY: Optional[str] = Field(default=None)
    OPENAI_API_KEY: Optional[str] = Field(default=None)
    GEMINI_API_KEY: Optional[str] = Field(default=None)
    
    # Vector Database (Qdrant)
    QDRANT_URL: Optional[str] = Field(default=None)
    QDRANT_API_KEY: Optional[str] = Field(default=None)
    QDRANT_COLLECTION: str = "nexus_knowledge_base"
    
    # Storage & Uploads
    UPLOAD_DIR: str = Field(
        default="/tmp/uploads" if (os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")) else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
    )
    MAX_UPLOAD_SIZE_BYTES: int = 25 * 1024 * 1024  # 25 MB
    
    @property
    def effective_upload_dir(self) -> str:
        """Always guarantees a valid, writable uploads directory across local and serverless hosts."""
        if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            target = "/tmp/uploads"
        else:
            target = self.UPLOAD_DIR
        try:
            os.makedirs(target, exist_ok=True)
        except Exception:
            target = "/tmp/uploads"
            os.makedirs(target, exist_ok=True)
        return target
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"]
    
    class Config:
        env_file = (".env", "../.env")
        extra = "allow"

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
