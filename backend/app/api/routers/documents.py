import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models import Document, DocumentChunk, User
from app.schemas import DocumentResponse
from app.api.deps import get_current_user
from app.services.document_service import DocumentParser
from app.services.rag_service import vector_store

router = APIRouter(prefix="/documents", tags=["Document Intelligence"])

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all documents owned by current user."""
    docs = db.query(Document).filter(Document.user_id == current_user.id).order_by(Document.created_at.desc()).all()
    return docs

@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Secure file upload with validation, text extraction, semantic chunking, and vector indexing.
    """
    filename = os.path.basename(file.filename or "uploaded_doc")
    ext = os.path.splitext(filename)[1].lower()
    allowed_exts = [
        ".pdf", ".docx", ".txt", ".md", ".csv", ".json", ".xml",
        ".html", ".py", ".js", ".ts", ".jsx", ".tsx", ".css",
        ".sql", ".log", ".yaml", ".yml", ".png", ".jpg", ".jpeg", ".webp"
    ]

    if ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(allowed_exts)}"
        )

    # Secure unique file path
    upload_dir = settings.effective_upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    save_filename = f"{current_user.id}_{os.urandom(8).hex()}_{filename}"
    file_path = os.path.join(upload_dir, save_filename)

    file_size = 0
    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            file_size += len(chunk)
            if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
                buffer.close()
                if os.path.exists(file_path):
                    os.remove(file_path)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=f"File exceeds maximum permitted size of {settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)}MB."
                )
            buffer.write(chunk)

    doc = Document(
        user_id=current_user.id,
        title=filename,
        filename=filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=file.content_type or "application/octet-stream",
        status="processing"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    try:
        pages = DocumentParser.extract_text(file_path, doc.mime_type)
        if not pages:
            doc.status = "empty"
            doc.chunk_count = 0
            doc.error_message = "No readable text found in document. Please upload a file containing selectable text."
            db.commit()
            db.refresh(doc)
            return doc

        total_chunks = 0
        for page_num, page_text in pages:
            chunks = DocumentParser.chunk_text(page_text)
            for idx, chunk_content in enumerate(chunks):
                chunk_obj = DocumentChunk(
                    document_id=doc.id,
                    chunk_index=total_chunks,
                    content=chunk_content,
                    page_number=page_num
                )
                db.add(chunk_obj)
                db.flush()

                # Add to vector store with user isolation
                vector_store.index_chunk(
                    chunk_id=chunk_obj.id,
                    user_id=current_user.id,
                    document_id=doc.id,
                    document_title=doc.title,
                    chunk_index=total_chunks,
                    content=chunk_content
                )
                total_chunks += 1

        doc.chunk_count = total_chunks
        doc.status = "ready"
        db.commit()
        db.refresh(doc)
    except Exception as e:
        doc.status = "failed"
        doc.error_message = str(e)
        db.commit()
        db.refresh(doc)

    return doc

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete document, clean file from disk, and remove from vector index."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    if doc.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized access to document.")

    # Remove from vector index
    vector_store.delete_document_chunks(doc.id, current_user.id)

    # Remove from disk
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception:
            pass

    db.delete(doc)
    db.commit()
    return None
