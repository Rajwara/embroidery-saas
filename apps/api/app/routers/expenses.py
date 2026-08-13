import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Expense, Factory, User
from app.schemas.expense import ExpenseCreateRequest, ExpenseOut

router = APIRouter()


@router.get("", response_model=list[ExpenseOut], operation_id="listExpenses")
def list_expenses(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    branch_id: uuid.UUID | None = None,
    category: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("expenses.view")),
) -> list[Expense]:
    query = db.query(Expense)
    if branch_id:
        query = query.filter(Expense.branch_id == branch_id)
    if category:
        query = query.filter(Expense.category.ilike(f"%{category}%"))
    return query.order_by(Expense.expense_number.desc()).offset(skip).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=ExpenseOut, operation_id="createExpense")
def create_expense(
    payload: ExpenseCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("expenses.create")),
) -> Expense:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")

    # Locked for the rest of this transaction -- serializes concurrent
    # create_expense calls so two requests can never be assigned the same
    # expense_number (same pattern as create_lot).
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")
    expense_number = f"EXP-{factory.next_expense_number:06d}"
    factory.next_expense_number += 1

    expense = Expense(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        expense_number=expense_number,
        category=payload.category,
        expense_date=payload.expense_date,
        amount=payload.amount,
        description=payload.description,
        notes=payload.notes,
    )
    db.add(expense)
    db.flush()  # populate expense.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="expense",
        entity_id=expense.id,
        new_values={"expense_number": expense_number, "category": payload.category, "amount": str(payload.amount)},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(expense)
    return expense
