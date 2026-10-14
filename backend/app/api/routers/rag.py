from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas import RAGQueryRequest, RAGQueryResponse, Citation
from app.api.deps import get_current_user
from app.services.rag_service import vector_store, extract_relevant_snippet
from app.providers.registry import provider_registry

router = APIRouter(prefix="/rag", tags=["Retrieval-Augmented Generation"])

@router.post("/query", response_model=RAGQueryResponse)
async def query_rag(
    payload: RAGQueryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Perform semantic vector search against user documents and generate context-grounded response with citations.
    """
    matched_chunks = vector_store.search(
        query=payload.query,
        user_id=current_user.id,
        document_ids=payload.document_ids,
        top_k=payload.top_k
    )

    if not matched_chunks:
        return RAGQueryResponse(
            answer="No relevant documents or passages were found matching your query in the authorized knowledge base.",
            citations=[],
            context_used=False
        )

    citations = [
        Citation(
            document_id=c["document_id"],
            document_title=c["document_title"],
            chunk_index=c["chunk_index"],
            snippet=extract_relevant_snippet(c["content"], payload.query)
        )
        for c in matched_chunks
    ]

    context_text = "\n\n".join([
        f"[{c['document_title']} - Section {c['chunk_index']}]:\n{c['content']}"
        for c in matched_chunks
    ])
    system_prompt = (
        "You are NEXUS AI Document Assistant. "
        "Answer the question strictly using the provided reference passages. "
        "If the passages do not contain enough facts to answer, explicitly state that the evidence is insufficient."
    )

    user_prompt = f"Reference Context:\n{context_text}\n\nUser Question: {payload.query}"

    adapter = provider_registry.get_provider_for_model(payload.model_id or "gemini-2.5-flash")
    provider_result = await adapter.generate_response(
        model_id=payload.model_id or "gemini-2.5-flash",
        messages=[{"role": "user", "content": user_prompt}],
        system_prompt=system_prompt
    )

    return RAGQueryResponse(
        answer=provider_result.get("content", ""),
        citations=citations,
        context_used=True
    )
