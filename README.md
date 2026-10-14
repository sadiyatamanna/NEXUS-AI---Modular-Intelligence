# NEXUS AI — Production Modular Multimodal AI Platform

**NEXUS AI** is a production-oriented, modular, multimodal AI workspace and autonomous agent platform.

---

## 🌟 Key Subsystems & Architecture

1. **Multi-Provider AI Engine & Registry**:
   - Authoritative capability registry (`text`, `vision`, `audio_tts`, `streaming`, `tool_calling`).
   - Integrated NavigateLabs API (`https://nexusapi.navigatelabs.ai/v1`) with `gemini-2.5-flash`, `gpt-4.1-nano`, and `gpt-4o-mini-tts`.
   - Real-time Server-Sent Events (SSE) streaming and audio speech synthesis.

2. **Persistence & Tenant Isolation**:
   - PostgreSQL engine with connection pooling and automated fallback SQLite.
   - Versioned Alembic migrations (`001_initial_schema`).
   - Full conversation lifecycle (create, retrieve, delete, message ordering, token accounting).
   - Strict server-side user ownership boundaries (`403 Forbidden` on cross-tenant access).

3. **Document Intelligence & Knowledge Base (RAG)**:
   - High-throughput parser for PDF, DOCX, Markdown, and TXT files.
   - Overlapping semantic text chunking with metadata preservation.
   - Vector indexing with Qdrant client and embedded vector search fallback.
   - Grounded context synthesis with verifiable source citations.

4. **Autonomous Agent Execution Loop**:
   - Sandboxed tool registry (`web_search`, AST `calculator`, `system_diagnostics`).
   - Bounded execution step limits and loop termination safety.
   - Step-by-step reasoning and execution traces logged to database.

5. **Modern Glassmorphic Frontend**:
   - Built with React, Vite, TypeScript, and rich Vanilla CSS design system.
   - Zero-dependency styling with responsive layouts, dark mode, and micro-animations.

---

## 🚀 Quickstart & Running on Any PC

### Option A: One-Click Launch (Windows)
Double-click [run.bat](file:///c:/Users/gunas/OneDrive/Desktop/1/run.bat) in the project folder.

### Option B: Command Line Launch
```bash
python start_nexus.py
```
- **Frontend Workspace (Dev)**: [http://localhost:5173](http://localhost:5173)
- **Standalone Web App / API**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive API Docs (Swagger)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Verification**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

*Note: The platform is self-healing. If you run it on another PC, `start_nexus.py` automatically detects and installs missing dependencies and runs standalone even if Node.js is not installed!*

---

## 📦 How to Send This Project to Another PC (ZIP Export)

Do **NOT** manually zip `.venv` or `node_modules` (they contain machine-specific hardcoded paths and break on other computers).

Instead, run:
```bash
python export_zip.py
```
This automatically compiles the frontend and creates a clean, lightweight, 100% portable `nexus-ai-portable.zip` ready to send to anyone!

---

### 🧪 Acceptance Test Suite
```bash
cd backend
python -m pytest tests -v
```

---

## ⚙️ Environment Configuration (`.env`)

```ini
# Core
PROJECT_NAME="NEXUS AI"
ENVIRONMENT="development"
SECRET_KEY="your-production-secret-key"

# Database (PostgreSQL or SQLite fallback)
DATABASE_URL="sqlite:///./nexus.db"
# DATABASE_URL="postgresql://user:password@localhost:5432/nexus"

# AI Integrations
NEXUS_API_BASE_URL="https://nexusapi.navigatelabs.ai/v1"
NEXUS_API_KEY=""

# Vector Store (Qdrant)
QDRANT_URL=""
QDRANT_API_KEY=""
```
