from datetime import date
from typing import Literal

from pydantic import BaseModel

SupplierLedgerEntryType = Literal["opening_balance", "purchase", "payment"]


class SupplierLedgerEntryOut(BaseModel):
    """One row of a Supplier's running ledger -- computed live from
    Purchase (debit) and SupplierPayment (credit) rows plus
    Supplier.opening_balance, never stored (same "computed, not a stored
    ledger" pattern as the Party ledger in schemas/party_ledger.py).
    Payment tracking was a real scope gap until this was closed -- see
    [[domain_supplier_payment_gap]] memory for the prior state."""

    entry_date: date
    entry_type: SupplierLedgerEntryType
    reference: str
    description: str
    debit: float
    credit: float
    balance: float
