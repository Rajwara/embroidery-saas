import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Machine, User
from app.schemas.machine import MachineCreateRequest, MachineOut, MachineUpdateRequest

router = APIRouter()


@router.get("", response_model=list[MachineOut], operation_id="listMachines")
def list_machines(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    code: str | None = None,
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> list[Machine]:
    query = db.query(Machine).filter(Machine.is_active == is_active)
    if code:
        query = query.filter(Machine.code.ilike(f"%{code}%"))
    if branch_id:
        query = query.filter(Machine.branch_id == branch_id)
    return query.order_by(Machine.code).offset(skip).limit(limit).all()


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=MachineOut, operation_id="createMachine"
)
def create_machine(
    payload: MachineCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("machines.create")),
) -> Machine:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    machine = Machine(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(machine)
    db.flush()  # populate machine.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="machine",
        entity_id=machine.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(machine)
    return machine


@router.get("/{machine_id}", response_model=MachineOut, operation_id="getMachine")
def get_machine(
    machine_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("machines.view")),
) -> Machine:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")
    return machine


@router.patch("/{machine_id}", response_model=MachineOut, operation_id="updateMachine")
def update_machine(
    machine_id: uuid.UUID,
    payload: MachineUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("machines.edit")),
) -> Machine:
    machine = db.get(Machine, machine_id)
    if machine is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(machine, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(machine, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="machine",
            entity_id=machine.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(machine)
    return machine
