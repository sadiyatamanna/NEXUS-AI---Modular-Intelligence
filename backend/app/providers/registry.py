from typing import Dict, List, Optional
from app.providers.base import BaseAIProvider
from app.providers.navigatelabs import NavigateLabsProvider
from app.providers.gemini import GeminiDirectProvider
from app.schemas import ModelInfo

class ProviderRegistry:
    """Authoritative registry for AI models, capabilities, and provider adapters."""

    def __init__(self):
        self._providers: Dict[str, BaseAIProvider] = {}
        self._model_to_provider: Dict[str, str] = {}
        self._initialize_defaults()

    def _initialize_defaults(self):
        # Register NavigateLabs provider
        navigatelabs_provider = NavigateLabsProvider()
        self.register_provider("navigatelabs", navigatelabs_provider)

        # Register Google Gemini direct provider
        gemini_provider = GeminiDirectProvider()
        self.register_provider("gemini_direct", gemini_provider)

    def register_provider(self, provider_id: str, provider: BaseAIProvider):
        self._providers[provider_id] = provider
        for model in provider.get_supported_models():
            self._model_to_provider[model.id] = provider_id

    def list_all_models(self) -> List[ModelInfo]:
        """Return all models across all registered providers."""
        all_models: List[ModelInfo] = []
        for provider in self._providers.values():
            all_models.extend(provider.get_supported_models())
        return all_models

    def get_model_info(self, model_id: str) -> Optional[ModelInfo]:
        """Look up metadata and capabilities for a specific model."""
        for model in self.list_all_models():
            if model.id == model_id:
                return model
        return None

    def get_provider_for_model(self, model_id: str) -> BaseAIProvider:
        """Resolve the provider adapter for a requested model ID."""
        from app.core.config import settings
        if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY.strip()) > 5:
            if "gemini" in model_id.lower() and "gemini_direct" in self._providers:
                return self._providers["gemini_direct"]

        provider_id = self._model_to_provider.get(model_id)
        if not provider_id or provider_id not in self._providers:
            # Default to navigatelabs provider if unknown model requested
            return self._providers["navigatelabs"]
        return self._providers[provider_id]

provider_registry = ProviderRegistry()
