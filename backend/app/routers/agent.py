import asyncio
import json
from typing import Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db, SessionLocal
from app.db_models import AgentRun, AgentEvent, ActionProposal
from app.agent.orchestrator import AgentOrchestrator
from app.schemas import (
    AgentTaskRequest,
    AgentRunDetailSchema,
    AgentEventSchema,
    ActionProposalSchema,
)

router = APIRouter(prefix="/api/agent", tags=["Agent"])


@router.get("/templates")
def get_task_templates():
    return [
        {
            "id": "tpl-recall",
            "title": "Investigate Recall: Batch B2231",
            "category": "Recall Containment",
            "prompt": "Investigate recall Batch B2231.",
            "description": "Trace 640 outward units, isolate 180 warehouse units, verify 25 recipients, check Batch B2240 replacement feasibility, and stage containment proposals.",
        },
        {
            "id": "tpl-expiry",
            "title": "Expiry & Return Window Audit",
            "category": "Loss Prevention",
            "prompt": "Find batches likely to expire before they can be sold.",
            "description": "Scan 90-day expiry horizon, calculate sell-through velocity, and file supplier RMA before credit window closes.",
        },
        {
            "id": "tpl-cold",
            "title": "Cold-Chain Thermal Excursion",
            "category": "Good Distribution Practice",
            "prompt": "Investigate a cold-chain temperature excursion.",
            "description": "Examine Unit 2 thermal log spikes (12.8°C for 4.5h), isolate 500 biological units, and mandate QA protein stability audit.",
        },
        {
            "id": "tpl-shortage",
            "title": "Critical ICU Medicine Shortage",
            "category": "Supply Continuity",
            "prompt": "Identify critical medicine shortage risks.",
            "description": "Identify Meropenem ICU reserve depletion (45 units left, 3.75-day stockout), and formulate emergency PO respecting MOQ.",
        },
    ]


@router.post("/run", response_model=AgentRunDetailSchema)
def run_agent_task(payload: AgentTaskRequest, db: Session = Depends(get_db)):
    orchestrator = AgentOrchestrator(db)
    run = orchestrator.run_task(
        prompt=payload.prompt,
        mode=payload.mode,
        incident_id=payload.incident_id,
    )
    return _build_run_detail(db, run)


@router.get("/runs/{run_id}", response_model=AgentRunDetailSchema)
def get_run_details(run_id: str, db: Session = Depends(get_db)):
    run = db.query(AgentRun).filter_by(id=run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return _build_run_detail(db, run)


@router.get("/stream/{run_id}")
async def stream_run_events(run_id: str):
    """Server-Sent Events (SSE) streaming endpoint for live agent execution events."""
    async def event_generator():
        last_event_id = 0
        is_completed = False

        while not is_completed:
            db = SessionLocal()
            try:
                run = db.query(AgentRun).filter_by(id=run_id).first()
                if not run:
                    yield f"event: error\ndata: {json.dumps({'error': 'Run not found'})}\n\n"
                    break

                events = (
                    db.query(AgentEvent)
                    .filter(AgentEvent.run_id == run_id, AgentEvent.id > last_event_id)
                    .order_by(AgentEvent.id.asc())
                    .all()
                )

                for ev in events:
                    last_event_id = ev.id
                    payload = {
                        "id": ev.id,
                        "step_number": ev.step_number,
                        "stage": ev.stage,
                        "event_type": ev.event_type,
                        "tool_name": ev.tool_name,
                        "message": ev.message,
                        "data": json.loads(ev.data_json) if ev.data_json else None,
                        "timestamp": ev.timestamp.isoformat(),
                    }
                    yield f"event: agent_event\ndata: {json.dumps(payload)}\n\n"

                if run.state in ["awaiting_approval", "completed", "failed"]:
                    # Final event
                    run_detail = _build_run_detail(db, run)
                    yield f"event: run_finished\ndata: {json.dumps(run_detail.model_dump())}\n\n"
                    is_completed = True
                    break

            finally:
                db.close()

            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _build_run_detail(db: Session, run: AgentRun) -> AgentRunDetailSchema:
    events = (
        db.query(AgentEvent)
        .filter_by(run_id=run.id)
        .order_by(AgentEvent.id.asc())
        .all()
    )
    event_schemas = [
        AgentEventSchema(
            step_number=e.step_number,
            stage=e.stage,
            event_type=e.event_type,
            tool_name=e.tool_name,
            message=e.message,
            data=json.loads(e.data_json) if e.data_json else None,
            timestamp=e.timestamp.isoformat(),
        )
        for e in events
    ]

    proposals = (
        db.query(ActionProposal)
        .filter_by(run_id=run.id)
        .order_by(ActionProposal.id.asc())
        .all()
    )
    proposal_schemas = [
        ActionProposalSchema(
            id=p.id,
            run_id=p.run_id,
            incident_id=p.incident_id,
            action_type=p.action_type,
            title=p.title,
            description=p.description,
            rationale=p.rationale,
            supporting_evidence=json.loads(p.supporting_evidence) if p.supporting_evidence else None,
            target_entity=p.target_entity,
            expected_impact=p.expected_impact,
            status=p.status,
            created_at=p.created_at.isoformat(),
            approved_by=p.approved_by,
            approved_at=p.approved_at.isoformat() if p.approved_at else None,
            rejection_reason=p.rejection_reason,
        )
        for p in proposals
    ]

    return AgentRunDetailSchema(
        run_id=run.id,
        prompt=run.prompt,
        state=run.state,
        current_step=run.current_step,
        created_at=run.created_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        events=event_schemas,
        plan=json.loads(run.plan_json) if run.plan_json else None,
        evidence=json.loads(run.evidence_json) if run.evidence_json else None,
        verification=json.loads(run.verification_json) if run.verification_json else None,
        final_report=json.loads(run.final_report_json) if run.final_report_json else None,
        proposals=proposal_schemas,
    )
