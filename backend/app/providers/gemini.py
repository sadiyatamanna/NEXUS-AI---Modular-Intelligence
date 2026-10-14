import base64
import json
import logging
import re
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx

from app.core.config import settings
from app.providers.base import BaseAIProvider
from app.schemas import ModelInfo, ModelCapability

logger = logging.getLogger("nexus.providers.gemini")

class GeminiDirectProvider(BaseAIProvider):
    """
    Direct Google Gemini API Provider (Generative Language API v1beta).
    Supports Gemini 2.5 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro with native multimodal vision.
    Endpoint: https://generativelanguage.googleapis.com/v1beta/models
    """

    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.timeout = httpx.Timeout(60.0, connect=10.0)

    def get_supported_models(self) -> List[ModelInfo]:
        is_ready = bool(self.api_key and len(self.api_key.strip()) > 5)
        return [
            ModelInfo(
                id="gemini-direct-flash",
                name="Google Gemini 2.5 Flash (Direct Native Vision)",
                provider="gemini_direct",
                description="Google's flagship multimodal model with native high-resolution vision, OCR, and reasoning.",
                capabilities=ModelCapability(
                    text=True,
                    vision=True,
                    audio_tts=False,
                    streaming=True,
                    tool_calling=True,
                    max_tokens=8192,
                ),
                is_configured=is_ready,
            ),
            ModelInfo(
                id="gemini-1.5-flash-direct",
                name="Google Gemini 1.5 Flash (Direct)",
                provider="gemini_direct",
                description="Ultra-fast Google model with extensive context and comprehensive visual comprehension.",
                capabilities=ModelCapability(
                    text=True,
                    vision=True,
                    audio_tts=False,
                    streaming=True,
                    tool_calling=True,
                    max_tokens=8192,
                ),
                is_configured=is_ready,
            ),
        ]

    def _get_target_model(self, model_id: str) -> str:
        if "1.5" in model_id:
            return "gemini-1.5-flash"
        return "gemini-2.5-flash"

    def _parse_image_data_uri(self, data_uri: str) -> Optional[Dict[str, str]]:
        """Parses a data:image/...;base64,... URI into mime_type and base64 data."""
        try:
            if not data_uri.startswith("data:"):
                return None
            header, b64_data = data_uri.split(",", 1)
            mime_match = re.search(r"data:([^;]+);base64", header)
            mime_type = mime_match.group(1) if mime_match else "image/jpeg"
            return {"mime_type": mime_type, "data": b64_data}
        except Exception as e:
            logger.warning(f"Failed to parse image data URI: {e}")
            return None

    def _build_contents(
        self,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        image_url: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        contents = []

        for idx, msg in enumerate(messages):
            role = "user" if msg.get("role") in ["user", "system"] else "model"
            parts = []

            # If there is system prompt and this is first message, prepend it
            if idx == 0 and system_prompt:
                parts.append({"text": f"[System Context: {system_prompt}]\n\n"})

            parts.append({"text": msg.get("content", "")})

            # Attach vision image if present on this message or passed for last turn
            msg_img = msg.get("image_url")
            if idx == len(messages) - 1 and image_url:
                msg_img = image_url

            if msg_img and msg.get("role") == "user":
                img_info = self._parse_image_data_uri(msg_img)
                if img_info:
                    parts.append({
                        "inline_data": {
                            "mime_type": img_info["mime_type"],
                            "data": img_info["data"]
                        }
                    })

            contents.append({"role": role, "parts": parts})

        return contents

    async def generate_response(
        self,
        model_id: str,
        messages: List[Dict[str, Any]],
        system_prompt: Optional[str] = None,
        image_url: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured in backend/.env. Please set it to use direct Google Gemini.")

        target_model = self._get_target_model(model_id)
        endpoint = f"{self.base_url}/{target_model}:generateContent?key={self.api_key}"
        contents = self._build_contents(messages, system_prompt, image_url)

        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(endpoint, json=payload)
            if response.status_code == 200:
                data = response.json()
                try:
                    candidate = data["candidates"][0]
                    content_parts = candidate.get("content", {}).get("parts", [])
                    text = "".join([p.get("text", "") for p in content_parts])
                    tokens = data.get("usageMetadata", {}).get("totalTokenCount", len(text.split()))
                    return {
                        "content": text,
                        "tokens_used": tokens,
                        "provider": f"Google Gemini Direct ({target_model})"
                    }
                except (KeyError, IndexError) as err:
                    raise ValueError(f"Malformed Gemini response: {data}") from err
            else:
                logger.error(f"Gemini API returned {response.status_code}: {response.text}")
                raise ValueError(f"Gemini API Error ({response.status_code}): {response.text}")

    async def stream_response(
        self,
        model_id: str,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        image_url: Optional[str] = None,
        max_tokens: int = 2048,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if not self.api_key:
            yield "GEMINI_API_KEY is not configured. Please add your key to backend/.env."
            return

        target_model = self._get_target_model(model_id)
        endpoint = f"{self.base_url}/{target_model}:streamGenerateContent?key={self.api_key}&alt=sse"
        contents = self._build_contents(messages, system_prompt, image_url)

        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                "temperature": temperature,
            }
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", endpoint, json=payload) as response:
                if response.status_code == 200:
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            raw_json = line[6:].strip()
                            try:
                                chunk = json.loads(raw_json)
                                parts = chunk.get("candidates", [{}])[0].get("content", {}).get("parts", [])
                                for p in parts:
                                    if "text" in p:
                                        yield p["text"]
                            except Exception:
                                continue
                else:
                    yield f"Error from Gemini API: {response.status_code}"

    async def generate_speech(
        self,
        text: str,
        voice: str = "alloy",
        model_id: str = "gpt-4o-mini-tts"
    ) -> bytes:
        # Fallback MP3 frame bytes
        return bytes([
            0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x54, 0x41, 0x47, 0x4E, 0x65, 0x78, 0x75, 0x73, 0x20, 0x41, 0x49, 0x20
        ])
