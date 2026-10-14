from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseTool(ABC):
    """Abstract base class for all agent tools."""

    name: str
    description: str
    parameters: Dict[str, Any]
    read_only: bool = True

    @abstractmethod
    async def execute(self, **kwargs) -> str:
        """Safely execute the tool with validated arguments."""
        pass

    def to_schema(self) -> Dict[str, Any]:
        """Export tool definition in OpenAPI / JSON Schema format."""
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "read_only": self.read_only
        }
