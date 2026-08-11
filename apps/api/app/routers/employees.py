import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Employee, User
from app.schemas.employee import EmployeeCreateRequest, EmployeeOut, EmployeeUpdateRequest

router = APIRouter()


@router.get("", response_model=list[EmployeeOut], operation_id="listEmployees")
def list_employees(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    is_active: bool = True,
    full_name: str | None = None,
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("employees.view")),
) -> list[Employee]:
    query = db.query(Employee).filter(Employee.is_active == is_active)
    if full_name:
        query = query.filter(Employee.full_name.ilike(f"%{full_name}%"))
    if branch_id:
        query = query.filter(Employee.branch_id == branch_id)
    return query.order_by(Employee.full_name).offset(skip).limit(limit).all()


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=EmployeeOut, operation_id="createEmployee"
)
def create_employee(
    payload: EmployeeCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("employees.create")),
) -> Employee:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")

    if payload.user_id is not None:
        linked_user = db.get(User, payload.user_id)
        if linked_user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="user_not_found")
        # Employee.user_id carries a real unique constraint -- pre-check for
        # a clean 409 instead of letting a raw IntegrityError surface as a
        # 500; the DB constraint remains the actual backstop.
        already_linked = db.query(Employee).filter_by(user_id=payload.user_id).first()
        if already_linked is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="user_already_linked_to_employee")

    employee = Employee(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(employee)
    db.flush()  # populate employee.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="employee",
        entity_id=employee.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(employee)
    return employee


@router.get("/{employee_id}", response_model=EmployeeOut, operation_id="getEmployee")
def get_employee(
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("employees.view")),
) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="employee_not_found")
    return employee


@router.patch("/{employee_id}", response_model=EmployeeOut, operation_id="updateEmployee")
def update_employee(
    employee_id: uuid.UUID,
    payload: EmployeeUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("employees.edit")),
) -> Employee:
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="employee_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(employee, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(employee, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="employee",
            entity_id=employee.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(employee)
    return employee
