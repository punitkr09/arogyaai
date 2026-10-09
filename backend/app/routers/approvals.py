import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.db_models import (
    ActionProposal,
    ApprovalDecision,
    BatchInventory,
    PurchaseOrder,
    Supplier,
    Product,
)
from app.schemas import ActionProposalSchema, ApprovalDecisionRequest
from app.tools.registry import ToolRegistry

router = APIRouter(prefix="/api/approvals", tags=["Approvals"])


@router.get("", response_model=List[ActionProposalSchema])
def list_proposals(
    status: Optional[str] = Query(None, description="Filter by status (pending_review, approved, rejected)"),
    db: Session = Depends(get_db),
):
    query = db.query(ActionProposal)
    if status:
        query = query.filter_by(status=status)
    proposals = query.order_by(ActionProposal.created_at.desc()).all()

    results = []
    for p in proposals:
        results.append(
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
        )
    return results


@router.post("/{proposal_id}/action", response_model=ActionProposalSchema)
def act_on_proposal(
    proposal_id: int,
    payload: ApprovalDecisionRequest,
    db: Session = Depends(get_db),
):
    prop = db.query(ActionProposal).filter_by(id=proposal_id).first()
    if not prop:
        raise HTTPException(status_code=404, detail=f"Proposal {proposal_id} not found.")

    if prop.status != "pending_review":
        raise HTTPException(status_code=400, detail=f"Proposal is already {prop.status}.")

    now = datetime.now(timezone.utc)
    decision = payload.decision.lower().strip()
    if decision not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Decision must be 'approved' or 'rejected'.")

    # If approving, validate targets, constraints, and current DB state before mutating
    if decision == "approved":
        try:
            ToolRegistry.validate_and_execute_proposal(
                db=db,
                proposal=prop,
                approver_name=payload.approver_name,
                approver_role=payload.approver_role,
            )
        except ValueError as ve:
            db.rollback()
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to execute approved action: {str(e)}")

    # Record decision audit
    audit = ApprovalDecision(
        proposal_id=prop.id,
        decision=decision,
        approver_role=payload.approver_role,
        approver_name=payload.approver_name,
        notes=payload.notes,
        timestamp=now,
    )
    db.add(audit)

    prop.status = decision
    prop.approved_by = f"{payload.approver_name} ({payload.approver_role})"
    prop.approved_at = now
    if decision == "rejected":
        prop.rejection_reason = payload.notes or "Rejected by authorized reviewer."

    db.commit()
    db.refresh(prop)

    return ActionProposalSchema(
        id=prop.id,
        run_id=prop.run_id,
        incident_id=prop.incident_id,
        action_type=prop.action_type,
        title=prop.title,
        description=prop.description,
        rationale=prop.rationale,
        supporting_evidence=json.loads(prop.supporting_evidence) if prop.supporting_evidence else None,
        target_entity=prop.target_entity,
        expected_impact=prop.expected_impact,
        status=prop.status,
        created_at=prop.created_at.isoformat(),
        approved_by=prop.approved_by,
        approved_at=prop.approved_at.isoformat() if prop.approved_at else None,
        rejection_reason=prop.rejection_reason,
    )
