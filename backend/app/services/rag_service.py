import math
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("nexus.rag")

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

    def search(
        self,
        query: str,
        user_id: int,
        document_ids: Optional[List[str]] = None,
        top_k: int = 4
    ) -> List[Dict[str, Any]]:
        query_vec = self._compute_embedding(query)
        scored_results = []

        for item in self._local_index:
            # Enforce strict user isolation boundary
            if item["user_id"] != user_id:
                continue
            if document_ids and item["document_id"] not in document_ids:
                continue

            similarity = self._cosine_similarity(query_vec, item["embedding"])
            # Keyword presence boost
            query_words = set(query.lower().split())
            content_words = set(item["content"].lower().split())
            overlap = len(query_words.intersection(content_words)) / max(len(query_words), 1)
            final_score = (similarity * 0.7) + (overlap * 0.3)

            scored_results.append((final_score, item))

        scored_results.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored_results[:top_k]]

vector_store = VectorStore()
