import ast
import operator
from typing import Dict, Any
from app.tools.base import BaseTool

class SafeCalculatorTool(BaseTool):
    """Safely evaluates arithmetic expressions using AST without eval/exec."""

    name = "calculator"
    description = "Perform precise arithmetic calculations. Input must be a valid mathematical expression."
    read_only = True
    parameters = {
        "type": "object",
        "properties": {
            "expression": {
                "type": "string",
                "description": "Mathematical expression, e.g. '25 * (14.5 + 2.5) / 2'"
            }
        },
        "required": ["expression"]
    }

    _operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
        ast.Mod: operator.mod,
        ast.FloorDiv: operator.floordiv,
    }

    def _eval_node(self, node):
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        elif isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type in self._operators:
                left = self._eval_node(node.left)
                right = self._eval_node(node.right)
                return self._operators[op_type](left, right)
        elif isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type in self._operators:
                return self._operators[op_type](self._eval_node(node.operand))
        raise ValueError(f"Unsupported or unsafe AST expression node: {type(node).__name__}")

    async def execute(self, expression: str = "", **kwargs) -> str:
        try:
            tree = ast.parse(expression, mode='eval')
            result = self._eval_node(tree.body)
            return f"Result: {result}"
        except Exception as e:
            return f"Calculation Error: {str(e)}"
