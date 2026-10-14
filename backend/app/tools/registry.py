from typing import Dict, List, Any, Optional
from app.tools.base import BaseTool
from app.tools.calculator import SafeCalculatorTool
from app.tools.search import WebSearchTool, SystemDiagnosticsTool

class ToolRegistry:
    """Central registry and execution manager for agent tools."""

    def __init__(self):
        self._tools: Dict[str, BaseTool] = {}
        self._register_defaults()

    def _register_defaults(self):
        self.register(SafeCalculatorTool())
        self.register(WebSearchTool())
        self.register(SystemDiagnosticsTool())

    def register(self, tool: BaseTool):
        self._tools[tool.name] = tool

    def get_tool(self, name: str) -> Optional[BaseTool]:
        return self._tools.get(name)

    def list_tools(self) -> List[Dict[str, Any]]:
        return [tool.to_schema() for tool in self._tools.values()]

    async def execute_tool(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        tool = self.get_tool(tool_name)
        if not tool:
            return f"Error: Tool '{tool_name}' is not recognized or not permitted."

        try:
            return await tool.execute(**arguments)
        except Exception as e:
            return f"Execution error in tool '{tool_name}': {str(e)}"

tool_registry = ToolRegistry()
