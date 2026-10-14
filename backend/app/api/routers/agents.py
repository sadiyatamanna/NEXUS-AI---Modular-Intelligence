import json
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import AgentExecution, User
from app.schemas import AgentTaskRequest, AgentTaskResponse, AgentStep
from app.api.deps import get_current_user
from app.tools.registry import tool_registry
from app.services.agent_service import agent_orchestrator

router = APIRouter(prefix="/agents", tags=["Agent Execution Engine"])

@router.get("/tools")
def list_available_tools():
    """List all registered agent tools and their input parameter schemas."""
    return tool_registry.list_tools()

@router.post("/execute", response_model=AgentTaskResponse)
async def execute_agent_task(
    payload: AgentTaskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Launch a bounded multi-step autonomous agent execution with sandboxed tool calls and full trace logging.
    """
    execution_record = AgentExecution(
        user_id=current_user.id,
        agent_name=payload.agent_name,
        task=payload.task,
        status="running"
    )
    db.add(execution_record)
    db.commit()
    db.refresh(execution_record)

    # Run orchestrator
    exec_result = await agent_orchestrator.execute_task(
        task_id=execution_record.id,
        user_id=current_user.id,
        agent_name=payload.agent_name,
        task=payload.task,
        model_id=payload.model_id or "gemini-2.5-flash",
        max_steps=payload.max_steps
    )

    execution_record.status = exec_result["status"]
    execution_record.steps_json = json.dumps([step.model_dump() for step in exec_result["steps"]])
    execution_record.result = exec_result["result"]
    db.commit()
    db.refresh(execution_record)

    return AgentTaskResponse(
        id=execution_record.id,
        agent_name=execution_record.agent_name,
        task=execution_record.task,
        status=execution_record.status,
        steps=exec_result["steps"],
        result=execution_record.result,
        created_at=execution_record.created_at
    )

@router.get("/history", response_model=List[AgentTaskResponse])
def get_agent_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List recent agent execution runs for current user."""
    records = (
        db.query(AgentExecution)
        .filter(AgentExecution.user_id == current_user.id)
        .order_by(AgentExecution.created_at.desc())
        .limit(20)
        .all()
    )
    results = []
    for r in records:
        try:
            steps_data = json.loads(r.steps_json)
            steps = [AgentStep(**s) for s in steps_data]
        except Exception:
            steps = []

        results.append(AgentTaskResponse(
            id=r.id,
            agent_name=r.agent_name,
            task=r.task,
            status=r.status,
            steps=steps,
            result=r.result,
            created_at=r.created_at
        ))
    return results
