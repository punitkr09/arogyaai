from typing import List
from fastapi import APIRouter, HTTPException, status
from app.models import SampleTemplate, WorkflowRunRequest, WorkflowRunResponse
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/api/workflow", tags=["workflow"])


@router.get("/templates", response_model=List[SampleTemplate])
async def get_templates() -> List[SampleTemplate]:
    """Retrieve sample hackathon problem statements for interactive agent exploration."""
    return WorkflowService.get_sample_templates()


@router.post("/run", response_model=WorkflowRunResponse)
async def run_workflow(request: WorkflowRunRequest) -> WorkflowRunResponse:
    """Execute the multi-stage Agentic workflow (Planner -> Executor -> Verifier -> Repair)."""
    try:
        response = WorkflowService.run_workflow(request)
        return response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Agent workflow execution error: {str(e)}",
        )
