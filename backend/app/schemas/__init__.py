from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field

# --- User & Auth Schemas ---
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# --- Message & Conversation Schemas ---
class MessageCreate(BaseModel):
    role: str = "user"
    content: str
    modality: Optional[str] = "text"
    image_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    modality: str
    tokens_used: int
    audio_url: Optional[str] = None
    image_url: Optional[str] = None
    metadata_json: Optional[str] = "{}"
    created_at: datetime

    class Config:
        from_attributes = True

class ConversationCreate(BaseModel):
    title: Optional[str] = "New Conversation"
    model_id: Optional[str] = "gemini-2.5-flash"
    system_prompt: Optional[str] = None

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    system_prompt: Optional[str] = None

class ConversationResponse(BaseModel):
    id: str
    user_id: int
    title: str
    model_id: str
    system_prompt: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []


# --- AI Models & Chat Schemas ---
class ModelCapability(BaseModel):
    text: bool = True
    vision: bool = False
    audio_tts: bool = False
    streaming: bool = True
    tool_calling: bool = False
    max_tokens: int = 4096

class ModelInfo(BaseModel):
    id: str
    name: str
    provider: str
    description: str
    capabilities: ModelCapability
    is_configured: bool = True

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    model_id: str = "gemini-2.5-flash"
    message: str
    system_prompt: Optional[str] = None
    image_url: Optional[str] = None
    generate_audio: bool = False
    use_rag: bool = False
    use_agent: bool = False
    generate_image: bool = False

class ChatResponse(BaseModel):
    conversation_id: str
    user_message: MessageResponse
    assistant_message: MessageResponse
    audio_url: Optional[str] = None
    tokens_used: int = 0
    model_id: str


# --- Document & RAG Schemas ---
class DocumentResponse(BaseModel):
    id: str
    title: str
    filename: str
    file_size: int
    mime_type: str
    status: str
    error_message: Optional[str] = None
    chunk_count: int
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentChunkResponse(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class RAGQueryRequest(BaseModel):
    query: str
    document_ids: Optional[List[str]] = None
    top_k: int = 4
    model_id: Optional[str] = "gemini-2.5-flash"

class Citation(BaseModel):
    document_id: str
    document_title: str
    chunk_index: int
    snippet: str

class RAGQueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []
    context_used: bool = True


# --- Agent Schemas ---
class AgentStep(BaseModel):
    step_number: int
    action: str
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    tool_output: Optional[str] = None
    thought: Optional[str] = None

class AgentTaskRequest(BaseModel):
    agent_name: str = "NexusArchitect"
    task: str
    model_id: Optional[str] = "gemini-2.5-flash"
    max_steps: int = 5

class AgentTaskResponse(BaseModel):
    id: str
    agent_name: str
    task: str
    status: str
    steps: List[AgentStep] = []
    result: Optional[str] = None
    created_at: datetime

# --- Multimodal Schemas ---
class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "alloy"
    model_id: Optional[str] = "gpt-4o-mini-tts"

class TTSResponse(BaseModel):
    audio_url: str
    format: str = "mp3"
