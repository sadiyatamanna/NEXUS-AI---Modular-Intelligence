import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Conversation, Message, User
from app.schemas import (
    ModelInfo,
    ChatRequest,
    ChatResponse,
    MessageResponse,
    TTSRequest,
    TTSResponse
)
from app.api.deps import get_current_user
from app.providers.registry import provider_registry
from app.services.rag_service import vector_store

router = APIRouter(prefix="/ai", tags=["AI Engine"])

@router.get("/models", response_model=List[ModelInfo])
def list_models():
    """List all configured AI models with authoritative capability flags."""
    return provider_registry.list_all_models()

@router.post("/chat", response_model=ChatResponse)
async def generate_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Orchestrates full conversation turn:
    1. Validates model capabilities.
    2. Resolves or initializes conversation.
    3. Persists user message.
    4. Optionally grounds query with RAG context.
    5. Calls provider adapter.
    6. Persists assistant response with metadata and token usage.
    """
    model_info = provider_registry.get_model_info(payload.model_id)
    if not model_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{payload.model_id}' is not recognized in provider registry."
        )

    if not model_info.capabilities.text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{payload.model_id}' does not support conversational text."
        )

    # Resolve or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == payload.conversation_id).first()
        if not conv or conv.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or unauthorized.")
    else:
        title = payload.message[:30] + "..." if len(payload.message) > 30 else payload.message
        conv = Conversation(
            user_id=current_user.id,
            title=title or "New Conversation",
            model_id=payload.model_id,
            system_prompt=payload.system_prompt
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Persist user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
        modality="vision" if payload.image_url else "text",
        image_url=payload.image_url
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # Optional RAG context injection
    effective_system_prompt = payload.system_prompt or conv.system_prompt or ""
    if payload.use_rag:
        retrieved_chunks = vector_store.search(query=payload.message, user_id=current_user.id, top_k=3)
        if retrieved_chunks:
            rag_context = "\n\n".join([f"[Source: {c['document_title']}]\n{c['content']}" for c in retrieved_chunks])
            effective_system_prompt += (
                f"\n\nContext retrieved from user documents:\n{rag_context}\n"
                "Please ground your answers strictly on the retrieved context above where applicable."
            )

    # Load conversation history for adapter
    history_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at)
        .all()
    )
    formatted_history = [
        {"role": m.role, "content": m.content, "image_url": m.image_url}
        for m in history_messages
    ]

    # Invoke provider adapter
    adapter = provider_registry.get_provider_for_model(payload.model_id)
    provider_result = await adapter.generate_response(
        model_id=payload.model_id,
        messages=formatted_history,
        system_prompt=effective_system_prompt,
        image_url=payload.image_url
    )

    assistant_content = provider_result.get("content", "")
    tokens_used = provider_result.get("tokens_used", 0)

    # Resolve requested images or hallucinated links to real live visual artifacts
    from app.services.image_service import image_service
    assistant_content = await image_service.resolve_images_in_content(payload.message, assistant_content)

    # Generate audio TTS if requested
    audio_url = None
    if payload.generate_audio:
        audio_url = f"/api/ai/tts?text={assistant_content[:150]}"

    # Persist assistant message
    asst_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=assistant_content,
        modality="audio" if audio_url else "text",
        tokens_used=tokens_used,
        audio_url=audio_url,
        metadata_json=json.dumps({"provider": provider_result.get("provider", "navigatelabs")})
    )
    db.add(asst_msg)
    conv.updated_at = asst_msg.created_at
    db.commit()
    db.refresh(asst_msg)

    return ChatResponse(
        conversation_id=conv.id,
        user_message=MessageResponse.model_validate(user_msg),
        assistant_message=MessageResponse.model_validate(asst_msg),
        audio_url=audio_url,
        tokens_used=tokens_used,
        model_id=payload.model_id
    )

@router.post("/chat/stream")
async def stream_chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Server-Sent Events (SSE) streaming chat completion."""
    model_info = provider_registry.get_model_info(payload.model_id)
    if not model_info or not model_info.capabilities.streaming:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Model '{payload.model_id}' does not support streaming."
        )

    # Ensure conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == payload.conversation_id).first()
        if not conv or conv.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found or unauthorized.")
    else:
        conv = Conversation(
            user_id=current_user.id,
            title=payload.message[:30] + "..." if len(payload.message) > 30 else payload.message,
            model_id=payload.model_id
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Persist user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=payload.message,
        modality="vision" if payload.image_url else "text",
        image_url=payload.image_url
    )
    db.add(user_msg)
    db.commit()

    # Load conversation history for adapter
    history_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conv.id)
        .order_by(Message.created_at)
        .all()
    )
    formatted_history = [
        {"role": m.role, "content": m.content, "image_url": m.image_url}
        for m in history_messages
    ]

    adapter = provider_registry.get_provider_for_model(payload.model_id)

    async def event_generator():
        # First send conversation_id event
        yield f"data: {json.dumps({'type': 'init', 'conversation_id': conv.id})}\n\n"
        full_content = []
        async for token in adapter.stream_response(
            model_id=payload.model_id,
            messages=formatted_history,
            system_prompt=payload.system_prompt or conv.system_prompt,
            image_url=payload.image_url
        ):
            full_content.append(token)
            yield f"data: {json.dumps({'type': 'delta', 'content': token})}\n\n"

        # Persist complete response
        final_text = "".join(full_content)
        db_session = Session(bind=db.get_bind())
        try:
            saved_asst_msg = Message(
                conversation_id=conv.id,
                role="assistant",
                content=final_text,
                tokens_used=len(final_text.split())
            )
            db_session.add(saved_asst_msg)
            db_session.commit()
        finally:
            db_session.close()

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/tts")
async def text_to_speech(
    text: str,
    voice: str = "alloy",
    model_id: str = "gpt-4o-mini-tts"
):
    """Direct audio speech synthesis using GPT-4o mini TTS."""
    adapter = provider_registry.get_provider_for_model(model_id)
    audio_bytes = await adapter.generate_speech(text=text, voice=voice, model_id=model_id)
    return Response(content=audio_bytes, media_type="audio/mpeg")

from pydantic import BaseModel

class ImageGenerateRequest(BaseModel):
    prompt: str

@router.post("/image/generate")
async def generate_ai_image(payload: ImageGenerateRequest):
    """Generates an AI visual asset from a text prompt and returns the accessible URL."""
    from app.services.image_service import image_service
    image_url = await image_service.generate_image(payload.prompt)
    return {"prompt": payload.prompt, "image_url": image_url}

