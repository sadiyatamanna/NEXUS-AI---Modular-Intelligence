from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any, List, Optional
from app.schemas import ModelInfo

class BaseAIProvider(ABC):
    """Abstract base class for all AI provider adapters."""

    @abstractmethod
    def get_supported_models(self) -> List[ModelInfo]:
        """Return list of models supported by this provider."""
        pass

    @abstractmethod
    async def generate_response(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        image_url: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        """Generate a complete text/vision response from the model."""
        pass

    @abstractmethod
    async def stream_response(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        image_url: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """Stream response tokens as they arrive."""
        pass

    @abstractmethod
    async def generate_speech(
        self,
        text: str,
        voice: str = "alloy",
        model_id: str = "gpt-4o-mini-tts"
    ) -> bytes:
        """Generate audio speech (TTS) bytes."""
        pass
