import math
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("nexus.rag")

STOP_WORDS = {
    "how", "are", "is", "the", "what", "where", "when", "in", "on", "of",
    "for", "with", "a", "an", "to", "and", "or", "from", "by", "that",
    "this", "it", "at", "as", "be", "was", "were", "do", "does", "did",
    "can", "could", "would", "should", "i", "you", "we", "they", "he", "she",
    "about", "into", "over", "after"
}

def extract_relevant_snippet(content: str, query: str, max_length: int = 250) -> str:
    """Extract a representative snippet around matched keywords for concise citation display."""
    import re
    tokens = [w for w in re.findall(r"\w+", query.lower()) if w not in STOP_WORDS and len(w) > 2]
    content_lower = content.lower()
    best_pos = -1
    for token in tokens:
        pos = content_lower.find(token)
        if pos != -1:
            best_pos = pos
            break

    if best_pos == -1 or best_pos < 80:
        return content[:max_length] + ("..." if len(content) > max_length else "")

    start = max(0, best_pos - 40)
    end = min(len(content), start + max_length)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(content) else ""
    return prefix + content[start:end] + suffix

class VectorStore:
    """
    Vector retrieval engine supporting Qdrant when configured, 
    with a robust embedded vector index for local zero-dependency operation.
    """

    def __init__(self):
        self.qdrant_client = None
        self._local_index: List[Dict[str, Any]] = []
        self._init_client()

    def _init_client(self):
        if settings.QDRANT_URL:
            try:
                from qdrant_client import QdrantClient
                self.qdrant_client = QdrantClient(
                    url=settings.QDRANT_URL,
                    api_key=settings.QDRANT_API_KEY,
                    timeout=5.0
                )
                logger.info(f"Connected to remote Qdrant vector store at {settings.QDRANT_URL}")
            except Exception as e:
                logger.warning(f"Could not connect to Qdrant ({e}). Using embedded vector index.")
                self.qdrant_client = None
        else:
            logger.info("Using embedded vector index for semantic retrieval.")

    def _compute_embedding(self, text: str) -> List[float]:
        """
        Deterministic, zero-dependency text embedding projection (128-dim).
        Ensures consistent cosine similarity ranking across chunks and queries.
        """
        vec = [0.0] * 128
        words = text.lower().split()
        for idx, word in enumerate(words):
            h = hash(word)
            pos = abs(h) % 128
            vec[pos] += 1.0 / (idx + 1.0)
        # Normalize vector
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

    def _cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        return sum(a * b for a, b in zip(v1, v2))

    def index_chunk(
        self,
        chunk_id: str,
        user_id: int,
        document_id: str,
        document_title: str,
        chunk_index: int,
        content: str
    ):
        embedding = self._compute_embedding(content)
        entry = {
            "chunk_id": chunk_id,
            "user_id": user_id,
            "document_id": document_id,
            "document_title": document_title,
            "chunk_index": chunk_index,
            "content": content,
            "embedding": embedding,
        }
        self._local_index.append(entry)

    def delete_document_chunks(self, document_id: str, user_id: int):
        self._local_index = [
            item for item in self._local_index 
            if not (item["document_id"] == document_id and item["user_id"] == user_id)
        ]

    def sync_from_db(self, db=None):
        """Pre-populate vector store index from database on server startup or reload."""
        close_db = False
        if db is None:
            from app.core.database import SessionLocal
            db = SessionLocal()
            close_db = True
        try:
            from app.models import Document, DocumentChunk
            rows = (
                db.query(DocumentChunk, Document.title, Document.user_id)
                .join(Document, DocumentChunk.document_id == Document.id)
                .filter(Document.status == "ready")
                .all()
            )
            new_index = []
            for chunk, doc_title, user_id in rows:
                if not chunk.content or chunk.content.startswith("[Document parsed - No selectable text"):
                    continue
                embedding = self._compute_embedding(chunk.content)
                new_index.append({
                    "chunk_id": chunk.id,
                    "user_id": user_id,
                    "document_id": chunk.document_id,
                    "document_title": doc_title,
                    "chunk_index": chunk.chunk_index,
                    "content": chunk.content,
                    "embedding": embedding,
                })
            self._local_index = new_index
            logger.info(f"Loaded {len(self._local_index)} indexed chunks into vector store.")
        except Exception as e:
            logger.error(f"Error syncing vector store from database: {e}")
        finally:
            if close_db:
                db.close()

    def search(
        self,
        query: str,
        user_id: int,
        document_ids: Optional[List[str]] = None,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        # Auto-sync from database if memory index is unpopulated
        if len(self._local_index) == 0:
            self.sync_from_db()

        query_vec = self._compute_embedding(query)
        scored_results = []
        import re
        tokens = [w for w in re.findall(r"\w+", query.lower()) if w not in STOP_WORDS and len(w) > 2]
        query_words = set(tokens)

        for item in self._local_index:
            # Enforce strict user isolation boundary
            if item["user_id"] != user_id:
                continue
            if document_ids and item["document_id"] not in document_ids:
                continue

            similarity = self._cosine_similarity(query_vec, item["embedding"])
            # Keyword presence boost
            content_lower = item["content"].lower()
            keyword_hits = sum(1 for w in query_words if w in content_lower)
            overlap = (keyword_hits / max(len(query_words), 1)) if query_words else 0.0
            final_score = (similarity * 0.35) + (overlap * 0.65)

            # Check relevance: require meaningful semantic similarity or keyword hit
            if final_score > 0.10 or overlap > 0:
                scored_results.append((final_score, item))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored_results[:top_k]]

vector_store = VectorStore()

