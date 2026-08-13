from datetime import date
from typing import Literal

from pydantic import BaseModel

SupplierLedgerEntryType = Literal["opening_balance", "purchase"]


class SupplierLedgerEntryOut(BaseModel):
    """One row of a Supplier's running ledger -- computed live from
    Purchase rows plus Supplier.opening_balance, never stored (same
    "computed, not a stored ledger" pattern as the Party ledger in
    schemas/party_ledger.py). Purchases increase
    the balance owed (debit); there is no symmetric "payment to supplier"
    tracking anywhere in ROADMAP.md's Phase 3 item list, so credit rows
    never appear here yet -- a real scope gap, not an oversight, flagged
    to the user when this was built."""

    entry_date: date
    entry_type: SupplierLedgerEntryType
    reference: str
    description: str
    debit: float
    credit: float
    balance: float
