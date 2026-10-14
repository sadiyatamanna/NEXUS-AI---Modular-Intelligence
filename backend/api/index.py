import os
import sys

# Ensure backend root directory is in sys.path for serverless imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

# ASGI entrypoint for Vercel
__all__ = ["app"]
