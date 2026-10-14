import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.core.database import init_db
from app.api.routers import health, auth, conversations, ai, documents, rag, agents

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(name)s - %(message)s"
)
logger = logging.getLogger("nexus.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure database schema is initialized
    logger.info("Initializing NEXUS AI database schema...")
    init_db()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    logger.info("NEXUS AI backend initialized successfully.")
    yield
    logger.info("Shutting down NEXUS AI backend.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Production-Oriented, Modular, Multimodal AI Workspace and Agent Platform",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Centralized safe exception handler (prevents traceback leaks)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please contact system administrator."}
    )

from fastapi.responses import JSONResponse, FileResponse

# Frontend distribution path (if pre-built with `npm run build`)
FRONTEND_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.isdir(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="frontend-assets")

# Static file serving for uploads & generated visual assets
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount(f"{settings.API_V1_PREFIX}/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API Routers
app.include_router(health.router, prefix=settings.API_V1_PREFIX)
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(conversations.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents.router, prefix=settings.API_V1_PREFIX)
app.include_router(rag.router, prefix=settings.API_V1_PREFIX)
app.include_router(agents.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
def root(request: Request):
    accept = request.headers.get("accept", "")
    frontend_dist_index = os.path.join(FRONTEND_DIST, "index.html")
    # Serve SPA index to browsers requesting HTML directly at root
    if "text/html" in accept and os.path.isfile(frontend_dist_index):
        return FileResponse(frontend_dist_index)
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs_url": "/docs",
        "api_health": f"{settings.API_V1_PREFIX}/health"
    }

@app.get("/{full_path:path}")
async def serve_spa_fallback(request: Request, full_path: str):
    if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    
    candidate_file = os.path.join(FRONTEND_DIST, full_path)
    if os.path.isfile(candidate_file):
        return FileResponse(candidate_file)
        
    frontend_dist_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(frontend_dist_index):
        return FileResponse(frontend_dist_index)
        
    return JSONResponse(status_code=404, content={"detail": f"Path /{full_path} not found"})

