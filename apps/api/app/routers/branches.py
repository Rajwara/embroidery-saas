import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Factory, User
from app.schemas.branch import BranchCreateRequest, BranchOut, BranchUpdateRequest

router = APIRouter()


@router.get("", response_model=list[BranchOut], operation_id="listBranches")
def list_branches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    name: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("branches.view")),
) -> list[Branch]:
    query = db.query(Branch).filter(Branch.is_active == is_active)
    if name:
        query = query.filter(Branch.name.ilike(f"%{name}%"))
    return query.order_by(Branch.name).offset(skip).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=BranchOut, operation_id="createBranch")
def create_branch(
    payload: BranchCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("branches.create")),
) -> Branch:
    factory = db.query(Factory).first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")

    # Branch.factory_id/code carries a real composite unique constraint --
    # pre-check for a clean 409 instead of letting a raw IntegrityError
    # surface as a 500; the DB constraint remains the actual backstop for
    # the race-condition case.
    existing = db.query(Branch).filter_by(factory_id=factory.id, code=payload.code).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="branch_code_already_exists")

    branch = Branch(tenant_id=user.tenant_id, factory_id=factory.id, **payload.model_dump())
    db.add(branch)
    db.flush()  # populate branch.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="branch",
        entity_id=branch.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(branch)
    return branch


@router.get("/{branch_id}", response_model=BranchOut, operation_id="getBranch")
def get_branch(
    branch_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("branches.view")),
) -> Branch:
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    return branch


@router.patch("/{branch_id}", response_model=BranchOut, operation_id="updateBranch")
def update_branch(
    branch_id: uuid.UUID,
    payload: BranchUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("branches.edit")),
) -> Branch:
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(branch, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(branch, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="branch",
            entity_id=branch.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(branch)
    return branch
