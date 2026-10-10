from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class ExecutionMode(str, Enum):
    DEMO = "demo"
    LIVE = "live"


class StageName(str, Enum):
    PLANNER = "planner"
    EXECUTOR = "executor"
    VERIFIER = "verifier"
    REPAIR = "repair"


class StageStatus(str, Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    REPAIRED = "repaired"


class HealthResponse(BaseModel):
    status: str = Field(default="ok", description="Service status flag")
    app_name: str = Field(description="Name of the backend service")
    version: str = Field(description="Semantic version of the platform")
    environment: str = Field(description="Current deployment environment")
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(),
        description="ISO timestamp of health response",
    )
    mode: str = Field(default="operations", description="Active agent execution mode")
    available_stages: List[str] = Field(
        default_factory=lambda: [
            "intake",
            "planning",
            "execution",
            "analysis",
            "verification",
            "approval",
            "reporting",
            "planner",
            "executor",
            "verifier",
            "repair",
        ],
        description="Supported agent pipeline stages",
    )
    ai_provider: Optional[Dict[str, Any]] = Field(
        default=None, description="Detailed health of the AI inference provider"
    )
    database_status: Optional[str] = Field(
        default="connected", description="Database connection health"
    )


class TimelineEvent(BaseModel):
    id: str = Field(description="Unique event ID")
    timestamp: str = Field(description="ISO event timestamp")
    stage: str = Field(description="Associated workflow stage")
    level: str = Field(
        description="Log severity: info, success, warning, error",
        examples=["info", "success", "warning", "error"],
    )
    message: str = Field(description="Brief headline description")
    details: Optional[str] = Field(default=None, description="Detailed diagnostic or output data")


class StageResult(BaseModel):
    id: str = Field(description="Stage identifier")
    name: StageName = Field(description="Standardized stage key")
    title: str = Field(description="Display title for dashboard")
    status: StageStatus = Field(description="Status of the stage")
    duration_ms: int = Field(default=0, description="Execution time in milliseconds")
    summary: str = Field(description="Short synopsis of stage outcome")
    details: List[str] = Field(default_factory=list, description="Step-by-step breakdown")
    artifacts: Dict[str, Any] = Field(
        default_factory=dict,
        description="Structured outputs (plans, code snippets, test results, repairs)",
    )
    is_demo: bool = Field(
        default=True,
        description="Visible indicator if result was produced via demo simulator",
    )


class WorkflowOutput(BaseModel):
    final_status: str = Field(
        description="Final state of the solution: success, needs_review, or failed"
    )
    solution_title: str = Field(description="Summary title of the completed work")
    executive_summary: str = Field(description="Concise description of the synthesized solution")
    solution_artifacts: List[str] = Field(
        default_factory=list,
        description="Key output artifacts or actionable components produced",
    )
    verifications_passed: int = Field(default=0, description="Count of passed verification checks")
    verifications_total: int = Field(default=0, description="Total verification checks executed")
    repairs_applied: int = Field(default=0, description="Number of automated repairs executed")


class WorkflowRunRequest(BaseModel):
    problem_statement: str = Field(
        ...,
        min_length=3,
        max_length=3000,
        description="User problem statement or task prompt for the agentic team",
    )
    mode: ExecutionMode = Field(
        default=ExecutionMode.DEMO,
        description="Execution mode: demo generates simulated heuristic runs, live uses LLMs",
    )
    max_repair_iterations: int = Field(
        default=2,
        ge=1,
        le=5,
        description="Maximum retry/repair cycles allowed upon verification failure",
    )


class WorkflowRunResponse(BaseModel):
    run_id: str = Field(description="Unique execution run ID")
    problem_statement: str = Field(description="Echo of the input problem statement")
    mode: ExecutionMode = Field(description="Execution mode used")
    is_demo: bool = Field(
        default=True,
        description="Explicit flag confirming if operations were simulated",
    )
    demo_badge: str = Field(
        default="DEMO SIMULATION",
        description="UI badge string to render conspicuously",
    )
    disclaimer: str = Field(
        default="DEMO MODE: Results shown are generated via heuristic simulation to model Planner -> Executor -> Verifier -> Repair dynamics without requiring live cloud LLM credits.",
        description="Clear transparency notice",
    )
    total_duration_ms: int = Field(description="Total pipeline execution duration in milliseconds")
    stages: List[StageResult] = Field(description="Results for each agent stage")
    timeline: List[TimelineEvent] = Field(description="Sequential log of all agent activities")
    results: WorkflowOutput = Field(description="Final assembled solution and metrics")
    limitations: List[str] = Field(
        default_factory=list,
        description="Known technical limitations and sandbox safety constraints",
    )


class SampleTemplate(BaseModel):
    id: str
    title: str
    category: str
    problem_statement: str
