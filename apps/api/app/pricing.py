"""
Pure invoice-pricing and payment-allocation arithmetic, split out of
routers/invoices.py and routers/payments.py so it has one implementation
each side of the ledger relies on, and so it's testable (tests/test_pricing_*)
without a DB session. See domain_invoice_pricing / domain_payment_allocation
memory for the formulas' origin -- this module is where they actually live
now, the router functions just call them.
"""


def per_suit_line_total(quantity: int, unit_price: float) -> float:
    return round(quantity * unit_price, 2)


def stitch_based_line_total(quantity: int, stitch_count: int, rate_per_thousand_stitches: float) -> float:
    return round(quantity * stitch_count * rate_per_thousand_stitches / 1000, 2)


def allocations_sum_matches_amount(allocation_amounts: list[float], amount: float) -> bool:
    return round(sum(allocation_amounts), 2) == round(amount, 2)


def allocation_within_invoice_balance(invoice_total: float, already_paid: float, allocation_amount: float) -> bool:
    """True if this allocation can be applied without pushing the invoice
    past fully paid. Equality (already_paid + allocation_amount == total) is
    allowed -- that's exactly paying off the balance.

    Compares in integer cents, not raw floats: e.g. 1.76 + 1.77 evaluates to
    3.5300000000000002 in IEEE754 doubles, which is > 3.53 -- a customer
    paying off their balance to the cent would otherwise get rejected with
    allocation_exceeds_invoice_balance. Found by the hypothesis property
    tests in tests/test_pricing_properties.py, not a hypothetical.
    """
    total_cents = round(invoice_total * 100)
    paid_cents = round(already_paid * 100)
    allocation_cents = round(allocation_amount * 100)
    return paid_cents + allocation_cents <= total_cents
