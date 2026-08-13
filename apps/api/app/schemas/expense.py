import uuid
from datetime import date

from pydantic import BaseModel


class ExpenseCreateRequest(BaseModel):
    branch_id: uuid.UUID
    category: str
    expense_date: date
    amount: float
    description: str
    notes: str | None = None
    # expense_number excluded -- server-assigned, same pattern as Lot.lot_number.


class ExpenseOut(BaseModel):
    id: uuid.UUID
    branch_id: uuid.UUID
    expense_number: str
    category: str
    expense_date: date
    amount: float
    description: str
    notes: str | None

    model_config = {"from_attributes": True}
