import os
import re
import urllib.parse
import uuid
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("nexus.images")

class ImageService:
    """
    Production-grade AI image and visual diagram generation service.
    Synthesizes visual assets, caches them in local storage, and serves them with zero external key friction.
    """

    @staticmethod
    async def generate_image(prompt: str) -> str:
        clean_prompt = re.sub(r'["\';]', '', prompt).strip()
        encoded = urllib.parse.quote(clean_prompt)
        seed = uuid.uuid4().hex[:8]
        cdn_url = f"https://image.pollinations.ai/prompt/{encoded}?seed={seed}"

        # On serverless (Vercel/Lambda), return the direct CDN URL immediately to avoid request timeouts
        if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
            logger.info(f"Serving direct AI image CDN URL for prompt: '{clean_prompt[:50]}'")
            return cdn_url

        # Ensure upload directory exists for local persistence
        upload_dir = settings.effective_upload_dir
        os.makedirs(upload_dir, exist_ok=True)
        filename = f"gen_{uuid.uuid4().hex[:12]}.jpg"
        file_path = os.path.join(upload_dir, filename)

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(cdn_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    with open(file_path, "wb") as f:
                        f.write(resp.content)
                    logger.info(f"Generated and cached AI image: {filename} for prompt: '{clean_prompt[:50]}'")
                    return f"/api/uploads/{filename}"
        except Exception as e:
            logger.warning(f"Could not cache image locally ({e}). Using direct CDN URL.")

        return cdn_url

    @staticmethod
    async def resolve_images_in_content(user_prompt: str, assistant_content: str) -> str:
        """
        Detects hallucinated/broken image links (like imgur, placeholder, etc.) or explicit image generation
        requests, generates REAL visual assets, and injects the live image.
        """
        content = assistant_content

        # 1. Detect hallucinated fake image markdown (e.g. ![...](https://i.imgur.com/...) or example.com)
        fake_img_pattern = re.compile(
            r'!\[(.*?)\]\((https?://(?:i\.)?imgur\.com/[^\)]+|https?://example\.com/[^\)]+|https?://via\.placeholder[^\)]+|https?://dummyimage[^\)]+)\)',
            re.IGNORECASE
        )
        fake_matches = list(fake_img_pattern.finditer(content))

        for match in fake_matches:
            alt_text = match.group(1) or "Generated AI Visual Diagram"
            image_prompt = f"{alt_text} visual diagram high quality detailed"
            real_url = await ImageService.generate_image(image_prompt)
            # Replace fake link with real working image
            content = content.replace(match.group(0), f"![{alt_text}]({real_url})")

        # 2. Check if user explicitly asked to generate an image or visual artifact
        user_lower = user_prompt.lower()
        has_image_intent = bool(
            re.search(r'\b(image|picture|photo|illustration|drawing|diagram)\b.*\b(generat|creat|draw|paint|make|produce)\b', user_lower) or
            re.search(r'\b(generat|creat|draw|paint|make|show|produce)\b.*\b(image|picture|photo|illustration|diagram|visual)\b', user_lower) or
            re.search(r'\b(image\s*gener|generat.*image|generst.*image|draw\s*me|visualize)\b', user_lower) or
            user_lower.startswith("/image")
        )

        if has_image_intent and "![" not in content:
            # Extract clean prompt for image synthesis
            clean = user_prompt.strip()
            if clean.lower().startswith("/image"):
                clean = clean[6:].strip()

            extract_prompt = re.sub(
                r'^(please\s+)?(can\s+you\s+)?(generate|generste|create|draw|paint|make|show|produce)?\s*(an?|the)?\s*(image|picture|photo|illustration|diagram|visual)?\s*(generating|generation)?\s*(of|for|about|showing|with)?\s*',
                '',
                clean,
                flags=re.IGNORECASE
            ).strip()

            if not extract_prompt or len(extract_prompt) < 3:
                extract_prompt = clean

            real_url = await ImageService.generate_image(f"{extract_prompt} detailed high quality visual render")
            image_block = f"\n\n### 🎨 Generated Visual Artifact\n\n![{extract_prompt}]({real_url})\n\n*Prompt: \"{extract_prompt}\"*\n"
            content += image_block

        return content

image_service = ImageService()
