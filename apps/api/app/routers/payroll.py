import html as html_escape
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    Advance,
    AdvanceInstallment,
    Bonus,
    Branch,
    Deduction,
    Employee,
    EmployeeSalaryProfile,
    PayrollEntry,
    PayrollRun,
    User,
)
from app.pdf import html_to_pdf
from app.schemas.payroll import (
    AdvanceCreateRequest,
    AdvanceDetailOut,
    AdvanceInstallmentCreateRequest,
    AdvanceInstallmentOut,
    AdvanceOut,
    BonusCreateRequest,
    BonusOut,
    DeductionCreateRequest,
    DeductionOut,
    EmployeePayrollHistoryOut,
    EmployeeSalaryProfileCreateRequest,
    EmployeeSalaryProfileOut,
    EmployeeSalaryProfileUpdateRequest,
    PayrollEntryOut,
    PayrollRunCreateRequest,
    PayrollRunDetailOut,
    PayrollRunOut,
)

router = APIRouter()

SALARY_SLIP_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: sans-serif; font-size: 12px; color: #111; }}
  h1 {{ font-size: 20px; margin: 0 0 4px 0; }}
  .meta {{ margin-bottom: 24px; color: #444; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 8px; text-align: left; }}
  th {{ background: #f3f3f3; }}
  td.num, th.num {{ text-align: right; }}
  .totals {{ margin-top: 12px; font-weight: bold; text-align: right; font-size: 14px; }}
</style>
</head>
<body>
  <h1>Salary Slip -- {month}/{year}</h1>
  <div class="meta">
    <div><strong>Employee:</strong> {employee_name}</div>
    <div><strong>Pay period:</strong> {month}/{year}</div>
  </div>
  <table>
    <tbody>
      <tr><td>Basic salary</td><td class="num">{basic_salary}</td></tr>
      <tr><td>Bonuses</td><td class="num">{total_bonus}</td></tr>
      <tr><td>Deductions</td><td class="num">-{total_deduction}</td></tr>
      <tr><td>Advance recovery</td><td class="num">-{total_advance_recovery}</td></tr>
    </tbody>
  </table>
  <div class="totals">Net pay: {net_pay}</div>
</body>
</html>"""


# ---------------------------------------------------------------------------
# Employee Salary Profiles
# ---------------------------------------------------------------------------


def _to_salary_profile_out(profile: EmployeeSalaryProfile, employee: Employee) -> EmployeeSalaryProfileOut:
    return EmployeeSalaryProfileOut(
        id=profile.id,
        employee_id=profile.employee_id,
        basic_salary=float(profile.basic_salary),
        notes=profile.notes,
        employee_name=employee.full_name,
    )


@router.get(
    "/salary-profiles", response_model=list[EmployeeSalaryProfileOut], operation_id="listSalaryProfiles"
)
def list_salary_profiles(
    employee_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> list[EmployeeSalaryProfileOut]:
    query = db.query(EmployeeSalaryProfile)
    if employee_id:
        query = query.filter(EmployeeSalaryProfile.employee_id == employee_id)
    profiles = query.all()
    return [_to_salary_profile_out(p, db.get(Employee, p.employee_id)) for p in profiles]


@router.post(
    "/salary-profiles",
    status_code=status.HTTP_201_CREATED,
    response_model=EmployeeSalaryProfileOut,
    operation_id="createSalaryProfile",
)
def create_salary_profile(
    payload: EmployeeSalaryProfileCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> EmployeeSalaryProfileOut:
    employee = db.get(Employee, payload.employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="employee_not_found")
    existing = db.query(EmployeeSalaryProfile).filter_by(employee_id=payload.employee_id).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="salary_profile_already_exists")
    if payload.basic_salary <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="basic_salary_must_be_positive")

    profile = EmployeeSalaryProfile(
        tenant_id=user.tenant_id,
        employee_id=payload.employee_id,
        basic_salary=payload.basic_salary,
        notes=payload.notes,
    )
    db.add(profile)
    db.flush()  # populate profile.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="employee_salary_profile",
        entity_id=profile.id,
        new_values={"employee_id": str(payload.employee_id), "basic_salary": payload.basic_salary},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(profile)
    return _to_salary_profile_out(profile, employee)


@router.patch(
    "/salary-profiles/{profile_id}", response_model=EmployeeSalaryProfileOut, operation_id="updateSalaryProfile"
)
def update_salary_profile(
    profile_id: uuid.UUID,
    payload: EmployeeSalaryProfileUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> EmployeeSalaryProfileOut:
    profile = db.get(EmployeeSalaryProfile, profile_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="salary_profile_not_found")

    updates = payload.model_dump(exclude_none=True)
    if "basic_salary" in updates and updates["basic_salary"] <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="basic_salary_must_be_positive")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in updates.items():
        current = getattr(profile, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(profile, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="employee_salary_profile",
            entity_id=profile.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(profile)
    return _to_salary_profile_out(profile, db.get(Employee, profile.employee_id))


# ---------------------------------------------------------------------------
# Advances
# ---------------------------------------------------------------------------


def _advance_recovered_amount(db: Session, advance_id: uuid.UUID) -> float:
    """Sum of installments recovered so far -- NOT the remaining balance;
    callers must subtract this from Advance.amount themselves (see
    list_advances/get_advance below). Named for what it actually returns
    after a bug where create_advance passed a hardcoded 0.0 as a fresh
    advance's "remaining_balance" instead of its full amount, caused by
    this function's previous misleading name (_advance_remaining_balance,
    which actually computed recovered-so-far)."""
    recovered = (
        db.query(func.coalesce(func.sum(AdvanceInstallment.amount), 0))
        .filter(AdvanceInstallment.advance_id == advance_id)
        .scalar()
    )
    return float(recovered)


def _to_advance_out(advance: Advance, employee: Employee, remaining_balance: float) -> AdvanceOut:
    return AdvanceOut(
        id=advance.id,
        employee_id=advance.employee_id,
        advance_date=advance.advance_date,
        amount=float(advance.amount),
        reason=advance.reason,
        employee_name=employee.full_name,
        remaining_balance=remaining_balance,
    )


@router.get("/advances", response_model=list[AdvanceOut], operation_id="listAdvances")
def list_advances(
    employee_id: uuid.UUID | None = None,
    open_only: bool = False,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> list[AdvanceOut]:
    query = db.query(Advance)
    if employee_id:
        query = query.filter(Advance.employee_id == employee_id)
    advances = query.order_by(Advance.advance_date.desc()).all()

    results = []
    for advance in advances:
        recovered = _advance_recovered_amount(db, advance.id)
        remaining = round(float(advance.amount) - recovered, 2)
        if open_only and remaining <= 0:
            continue
        results.append(_to_advance_out(advance, db.get(Employee, advance.employee_id), remaining))
    return results


@router.post(
    "/advances", status_code=status.HTTP_201_CREATED, response_model=AdvanceOut, operation_id="createAdvance"
)
def create_advance(
    payload: AdvanceCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> AdvanceOut:
    employee = db.get(Employee, payload.employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="employee_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")

    advance = Advance(
        tenant_id=user.tenant_id,
        employee_id=payload.employee_id,
        advance_date=payload.advance_date,
        amount=payload.amount,
        reason=payload.reason,
    )
    db.add(advance)
    db.flush()  # populate advance.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="advance",
        entity_id=advance.id,
        new_values={"employee_id": str(payload.employee_id), "amount": payload.amount},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(advance)
    # No installments can exist yet for a brand-new advance, so the
    # remaining balance is simply its full amount.
    return _to_advance_out(advance, employee, float(advance.amount))


@router.get("/advances/{advance_id}", response_model=AdvanceDetailOut, operation_id="getAdvance")
def get_advance(
    advance_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> AdvanceDetailOut:
    advance = db.get(Advance, advance_id)
    if advance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="advance_not_found")
    employee = db.get(Employee, advance.employee_id)
    installments = (
        db.query(AdvanceInstallment)
        .filter(AdvanceInstallment.advance_id == advance_id)
        .order_by(AdvanceInstallment.installment_date)
        .all()
    )
    recovered = sum(float(i.amount) for i in installments)
    remaining = round(float(advance.amount) - recovered, 2)
    return AdvanceDetailOut(
        **_to_advance_out(advance, employee, remaining).model_dump(),
        installments=[AdvanceInstallmentOut.model_validate(i) for i in installments],
    )


# ---------------------------------------------------------------------------
# Payroll Runs
# ---------------------------------------------------------------------------


def _entry_totals(db: Session, employee_id: uuid.UUID, payroll_run_id: uuid.UUID) -> tuple[float, float, float]:
    total_bonus = (
        db.query(func.coalesce(func.sum(Bonus.amount), 0))
        .filter(Bonus.employee_id == employee_id, Bonus.payroll_run_id == payroll_run_id)
        .scalar()
    )
    total_deduction = (
        db.query(func.coalesce(func.sum(Deduction.amount), 0))
        .filter(Deduction.employee_id == employee_id, Deduction.payroll_run_id == payroll_run_id)
        .scalar()
    )
    total_advance_recovery = (
        db.query(func.coalesce(func.sum(AdvanceInstallment.amount), 0))
        .join(Advance, AdvanceInstallment.advance_id == Advance.id)
        .filter(Advance.employee_id == employee_id, AdvanceInstallment.payroll_run_id == payroll_run_id)
        .scalar()
    )
    return float(total_bonus), float(total_deduction), float(total_advance_recovery)


def _to_entry_out(db: Session, entry: PayrollEntry, employee: Employee) -> PayrollEntryOut:
    total_bonus, total_deduction, total_advance_recovery = _entry_totals(db, entry.employee_id, entry.payroll_run_id)
    basic_salary = float(entry.basic_salary)
    net_pay = round(basic_salary + total_bonus - total_deduction - total_advance_recovery, 2)
    return PayrollEntryOut(
        id=entry.id,
        payroll_run_id=entry.payroll_run_id,
        employee_id=entry.employee_id,
        employee_name=employee.full_name,
        basic_salary=basic_salary,
        total_bonus=total_bonus,
        total_deduction=total_deduction,
        total_advance_recovery=total_advance_recovery,
        net_pay=net_pay,
    )


def _build_run_detail(db: Session, run: PayrollRun) -> PayrollRunDetailOut:
    entries = db.query(PayrollEntry).filter(PayrollEntry.payroll_run_id == run.id).all()
    entry_outs = [_to_entry_out(db, e, db.get(Employee, e.employee_id)) for e in entries]
    entry_outs.sort(key=lambda e: e.employee_name)
    return PayrollRunDetailOut(
        id=run.id,
        branch_id=run.branch_id,
        year=run.year,
        month=run.month,
        run_date=run.run_date,
        status=run.status,
        entries=entry_outs,
    )


def _require_draft_run(db: Session, run_id: uuid.UUID) -> PayrollRun:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_run_not_found")
    if run.status != "draft":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="payroll_run_not_draft")
    return run


@router.get(
    "/payroll-entries", response_model=list[EmployeePayrollHistoryOut], operation_id="listEmployeePayrollHistory"
)
def list_employee_payroll_history(
    employee_id: uuid.UUID = Query(...),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> list[EmployeePayrollHistoryOut]:
    """One employee's PayrollEntry across every PayrollRun -- the
    across-all-runs counterpart to PayrollRunDetailOut.entries, which is
    scoped to a single run instead (see EmployeePayrollHistoryOut)."""
    employee = db.get(Employee, employee_id)
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="employee_not_found")

    rows = (
        db.query(PayrollEntry, PayrollRun)
        .join(PayrollRun, PayrollEntry.payroll_run_id == PayrollRun.id)
        .filter(PayrollEntry.employee_id == employee_id)
        .order_by(PayrollRun.year.desc(), PayrollRun.month.desc())
        .all()
    )
    return [
        EmployeePayrollHistoryOut(
            **_to_entry_out(db, entry, employee).model_dump(),
            year=run.year,
            month=run.month,
            run_date=run.run_date,
            run_status=run.status,
        )
        for entry, run in rows
    ]


@router.get("/payroll-runs", response_model=list[PayrollRunOut], operation_id="listPayrollRuns")
def list_payroll_runs(
    branch_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> list[PayrollRun]:
    query = db.query(PayrollRun)
    if branch_id:
        query = query.filter(PayrollRun.branch_id == branch_id)
    return query.order_by(PayrollRun.year.desc(), PayrollRun.month.desc()).all()


@router.post(
    "/payroll-runs",
    status_code=status.HTTP_201_CREATED,
    response_model=PayrollRunDetailOut,
    operation_id="createPayrollRun",
)
def create_payroll_run(
    payload: PayrollRunCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> PayrollRunDetailOut:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    if not (1 <= payload.month <= 12):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="invalid_month")
    existing = (
        db.query(PayrollRun)
        .filter(
            PayrollRun.branch_id == branch.id,
            PayrollRun.year == payload.year,
            PayrollRun.month == payload.month,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="payroll_run_already_exists_for_period")

    run = PayrollRun(
        tenant_id=user.tenant_id,
        branch_id=branch.id,
        year=payload.year,
        month=payload.month,
        run_date=payload.run_date,
        status="draft",
    )
    db.add(run)
    db.flush()  # populate run.id -- Python-side default, not set until flush

    # One entry per active employee at this branch who has a salary
    # profile -- employees without one are skipped (not blocking), a
    # profile has to exist for their basic_salary to be known at all.
    employees = (
        db.query(Employee)
        .filter(Employee.branch_id == branch.id, Employee.is_active.is_(True))
        .all()
    )
    created_count = 0
    for employee in employees:
        profile = db.query(EmployeeSalaryProfile).filter_by(employee_id=employee.id).first()
        if profile is None:
            continue
        db.add(
            PayrollEntry(
                tenant_id=user.tenant_id,
                payroll_run_id=run.id,
                employee_id=employee.id,
                basic_salary=profile.basic_salary,
            )
        )
        created_count += 1

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="payroll_run",
        entity_id=run.id,
        new_values={"year": payload.year, "month": payload.month, "entries_created": created_count},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(run)
    return _build_run_detail(db, run)


@router.get("/payroll-runs/{run_id}", response_model=PayrollRunDetailOut, operation_id="getPayrollRun")
def get_payroll_run(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> PayrollRunDetailOut:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_run_not_found")
    return _build_run_detail(db, run)


@router.post(
    "/payroll-runs/{run_id}/bonuses", status_code=status.HTTP_201_CREATED, response_model=BonusOut,
    operation_id="addBonus",
)
def add_bonus(
    run_id: uuid.UUID,
    payload: BonusCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> Bonus:
    run = _require_draft_run(db, run_id)
    entry = db.query(PayrollEntry).filter_by(payroll_run_id=run.id, employee_id=payload.employee_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_entry_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")

    bonus = Bonus(
        tenant_id=user.tenant_id,
        employee_id=payload.employee_id,
        payroll_run_id=run.id,
        amount=payload.amount,
        reason=payload.reason,
    )
    db.add(bonus)
    db.flush()

    ip_address, user_agent = client_meta(request)
    record_audit(
        db, tenant_id=user.tenant_id, actor_user_id=user.id, action="create", entity_type="bonus",
        entity_id=bonus.id, new_values={"employee_id": str(payload.employee_id), "amount": payload.amount},
        ip_address=ip_address, user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(bonus)
    return bonus


@router.post(
    "/payroll-runs/{run_id}/deductions", status_code=status.HTTP_201_CREATED, response_model=DeductionOut,
    operation_id="addDeduction",
)
def add_deduction(
    run_id: uuid.UUID,
    payload: DeductionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> Deduction:
    run = _require_draft_run(db, run_id)
    entry = db.query(PayrollEntry).filter_by(payroll_run_id=run.id, employee_id=payload.employee_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_entry_not_found")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")

    deduction = Deduction(
        tenant_id=user.tenant_id,
        employee_id=payload.employee_id,
        payroll_run_id=run.id,
        amount=payload.amount,
        reason=payload.reason,
    )
    db.add(deduction)
    db.flush()

    ip_address, user_agent = client_meta(request)
    record_audit(
        db, tenant_id=user.tenant_id, actor_user_id=user.id, action="create", entity_type="deduction",
        entity_id=deduction.id, new_values={"employee_id": str(payload.employee_id), "amount": payload.amount},
        ip_address=ip_address, user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(deduction)
    return deduction


@router.post(
    "/payroll-runs/{run_id}/advance-installments",
    status_code=status.HTTP_201_CREATED,
    response_model=AdvanceInstallmentOut,
    operation_id="addAdvanceInstallment",
)
def add_advance_installment(
    run_id: uuid.UUID,
    payload: AdvanceInstallmentCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.create")),
) -> AdvanceInstallment:
    run = _require_draft_run(db, run_id)
    entry = db.query(PayrollEntry).filter_by(payroll_run_id=run.id, employee_id=payload.employee_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_entry_not_found")

    advance = db.get(Advance, payload.advance_id)
    if advance is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="advance_not_found")
    if advance.employee_id != payload.employee_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="advance_employee_mismatch")
    if payload.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_must_be_positive")

    remaining = float(advance.amount) - _advance_recovered_amount(db, advance.id)
    if payload.amount > remaining:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="amount_exceeds_advance_balance")

    installment = AdvanceInstallment(
        tenant_id=user.tenant_id,
        advance_id=payload.advance_id,
        payroll_run_id=run.id,
        amount=payload.amount,
        installment_date=payload.installment_date,
    )
    db.add(installment)
    db.flush()

    ip_address, user_agent = client_meta(request)
    record_audit(
        db, tenant_id=user.tenant_id, actor_user_id=user.id, action="create", entity_type="advance_installment",
        entity_id=installment.id,
        new_values={"advance_id": str(payload.advance_id), "amount": payload.amount},
        ip_address=ip_address, user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(installment)
    return installment


@router.post("/payroll-runs/{run_id}/approve", response_model=PayrollRunDetailOut, operation_id="approvePayrollRun")
def approve_payroll_run(
    run_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("payroll.approve")),
) -> PayrollRunDetailOut:
    run = _require_draft_run(db, run_id)
    run.status = "approved"

    ip_address, user_agent = client_meta(request)
    record_audit(
        db, tenant_id=user.tenant_id, actor_user_id=user.id, action="approve", entity_type="payroll_run",
        entity_id=run.id, new_values={"status": "approved"}, ip_address=ip_address, user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(run)
    return _build_run_detail(db, run)


@router.get("/payroll-runs/{run_id}/entries/{employee_id}/pdf", operation_id="getSalarySlipPdf")
def get_salary_slip_pdf(
    run_id: uuid.UUID,
    employee_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("payroll.view")),
) -> Response:
    run = db.get(PayrollRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_run_not_found")
    entry = db.query(PayrollEntry).filter_by(payroll_run_id=run_id, employee_id=employee_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="payroll_entry_not_found")
    employee = db.get(Employee, employee_id)
    entry_out = _to_entry_out(db, entry, employee)

    html_doc = SALARY_SLIP_TEMPLATE.format(
        month=run.month,
        year=run.year,
        employee_name=html_escape.escape(employee.full_name),
        basic_salary=f"{entry_out.basic_salary:,.2f}",
        total_bonus=f"{entry_out.total_bonus:,.2f}",
        total_deduction=f"{entry_out.total_deduction:,.2f}",
        total_advance_recovery=f"{entry_out.total_advance_recovery:,.2f}",
        net_pay=f"{entry_out.net_pay:,.2f}",
    )
    pdf_bytes = html_to_pdf(html_doc)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="salary-slip-{employee.full_name}-{run.month}-{run.year}.pdf"'
        },
    )
