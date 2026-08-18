"""
Property-based (hypothesis) tests for app/pricing.py -- Phase 5 item 9
("load-test the ledger and stitch-billing calculations... where trust is
won or lost"). These check the pure arithmetic against thousands of
randomized inputs for the class of bug that erodes trust in a billing
system: cent-level drift, sign errors, and off-by-one boundary handling at
the "exactly pays off the balance" edge -- not raw throughput, which would
need a DB-backed load harness this repo doesn't have yet.
"""

from decimal import ROUND_HALF_UP, Decimal

from hypothesis import given
from hypothesis import strategies as st

from app.pricing import (
    allocation_within_invoice_balance,
    allocations_sum_matches_amount,
    per_suit_line_total,
    stitch_based_line_total,
)

# All money inputs are generated as integer cents and divided down, so every
# generated float is an exact 2-decimal-place value -- matching how the UI
# actually collects money, not fuzzing into floating-point inputs the app
# would never see.
CENTS = st.integers(min_value=1, max_value=10_000_000_00)  # up to 10,000,000.00
QUANTITY = st.integers(min_value=1, max_value=100_000)
STITCH_COUNT = st.integers(min_value=1, max_value=500_000)


def money(cents: int) -> float:
    return cents / 100


def exact_decimal(*factors: int, divisor: int = 1) -> Decimal:
    """Ground-truth product computed in exact decimal arithmetic, for
    comparison against the float-based implementation."""
    result = Decimal(1)
    for f in factors:
        result *= Decimal(f)
    return (result / Decimal(divisor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


@given(quantity=QUANTITY, unit_price_cents=CENTS)
def test_per_suit_line_total_within_a_cent_of_exact_decimal(quantity, unit_price_cents):
    unit_price = money(unit_price_cents)
    result = per_suit_line_total(quantity, unit_price)
    expected = exact_decimal(quantity, unit_price_cents, divisor=100)
    assert abs(Decimal(str(result)) - expected) <= Decimal("0.01")


@given(quantity=QUANTITY, unit_price_cents=CENTS)
def test_per_suit_line_total_is_never_negative_for_positive_inputs(quantity, unit_price_cents):
    assert per_suit_line_total(quantity, money(unit_price_cents)) > 0


@given(
    q1=st.integers(min_value=1, max_value=50_000),
    q2=st.integers(min_value=1, max_value=50_000),
    unit_price_cents=CENTS,
)
def test_per_suit_line_total_is_additive_across_split_quantities(q1, q2, unit_price_cents):
    """Splitting one line into two (e.g. a partial delivery invoiced
    separately) must not silently gain or lose money versus billing the
    combined quantity in one line."""
    unit_price = money(unit_price_cents)
    combined = per_suit_line_total(q1 + q2, unit_price)
    split = per_suit_line_total(q1, unit_price) + per_suit_line_total(q2, unit_price)
    assert abs(combined - split) <= 0.01


@given(quantity=QUANTITY, stitch_count=STITCH_COUNT, rate_cents=CENTS)
def test_stitch_based_line_total_within_a_cent_of_exact_decimal(quantity, stitch_count, rate_cents):
    rate = money(rate_cents)
    result = stitch_based_line_total(quantity, stitch_count, rate)
    expected = exact_decimal(quantity, stitch_count, rate_cents, divisor=100_000)
    assert abs(Decimal(str(result)) - expected) <= Decimal("0.01")


@given(quantity=QUANTITY, stitch_count=STITCH_COUNT, rate_cents=CENTS)
def test_stitch_based_line_total_is_never_negative_for_positive_inputs(quantity, stitch_count, rate_cents):
    # >= 0, not > 0: a tiny-enough product (e.g. quantity=1, stitch_count=1,
    # rate=$0.01/1000) legitimately rounds down to $0.00 -- that's correct
    # rounding, not a sign error. What must never happen is negative.
    assert stitch_based_line_total(quantity, stitch_count, money(rate_cents)) >= 0


@given(allocation_cents=st.lists(st.integers(min_value=1, max_value=1_000_000_00), min_size=1, max_size=50))
def test_allocations_summing_exactly_are_always_accepted(allocation_cents):
    """Guards against float-accumulation drift as allocation count grows --
    a payment legitimately split across many invoices/on-account amounts
    must never get spuriously rejected just because summing N floats isn't
    bit-exact."""
    amounts = [money(c) for c in allocation_cents]
    total = money(sum(allocation_cents))
    assert allocations_sum_matches_amount(amounts, total) is True


@given(
    allocation_cents=st.lists(st.integers(min_value=1, max_value=1_000_000_00), min_size=1, max_size=50),
    drift_cents=st.integers(min_value=1, max_value=1000),
)
def test_allocations_off_by_at_least_a_cent_are_always_rejected(allocation_cents, drift_cents):
    amounts = [money(c) for c in allocation_cents]
    mismatched_total = money(sum(allocation_cents) + drift_cents)
    assert allocations_sum_matches_amount(amounts, mismatched_total) is False


@given(invoice_total_cents=CENTS, already_paid_fraction=st.floats(min_value=0, max_value=1, allow_nan=False))
def test_allocation_that_exactly_pays_off_the_balance_is_allowed(invoice_total_cents, already_paid_fraction):
    already_paid_cents = int(invoice_total_cents * already_paid_fraction)
    remaining_cents = invoice_total_cents - already_paid_cents
    if remaining_cents <= 0:
        return
    assert allocation_within_invoice_balance(
        money(invoice_total_cents), money(already_paid_cents), money(remaining_cents)
    )


@given(invoice_total_cents=CENTS, overage_cents=st.integers(min_value=1, max_value=1_000_000))
def test_allocation_that_exceeds_the_balance_is_always_rejected(invoice_total_cents, overage_cents):
    assert not allocation_within_invoice_balance(
        money(invoice_total_cents), 0.0, money(invoice_total_cents + overage_cents)
    )
