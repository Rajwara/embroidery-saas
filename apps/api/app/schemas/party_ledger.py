from datetime import date
from typing import Literal

from pydantic import BaseModel

LedgerEntryType = Literal["opening_balance", "invoice", "payment"]


class LedgerEntryOut(BaseModel):
    """One row of a Party's running ledger -- computed live from Invoice
    (debit) and Payment (credit) rows plus Party.opening_balance, never
    stored (same "computed, not a stored ledger" pattern as
    InvoiceOut.total_amount). Append-only / reversal-only by construction:
    there's no edit endpoint on Invoice or Payment, so a correction can
    only ever be a new offsetting entry, never a row mutation."""

    entry_date: date
    entry_type: LedgerEntryType
    reference: str
    description: str
    debit: float
    credit: float
    balance: float
