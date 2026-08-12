import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import (
    Design,
    Lot,
    LotColour,
    LotComponent,
    Machine,
    ProductionJob,
    ProductionJobComponent,
    ProductionJobMachineAllocation,
    User,
)
from app.schemas.production_job import (
    AllocateComponentRequest,
    ProductionJobComponentOut,
    ProductionJobComponentWithAllocationsOut,
    ProductionJobCreateRequest,
    ProductionJobDetailOut,
    ProductionJobMachineAllocationOut,
    ProductionJobOut,
)

router = APIRouter()


def _split_evenly(target_quantity: int, count: int) -> list[int]:
    """Even split with the remainder going to the first `remainder` machines
    (list order = the order machine_ids were given in)."""
    base, remainder = divmod(target_quantity, count)
    return [base + 1 if i < remainder else base for i in range(count)]


def _component_with_allocations(db: Session, component: ProductionJobComponent) -> ProductionJobComponentWithAllocationsOut:
    allocations = (
        db.query(ProductionJobMachineAllocation)
        .filter(ProductionJobMachineAllocation.production_job_component_id == component.id)
        .order_by(ProductionJobMachineAllocation.created_at)
        .all()
    )
    return ProductionJobComponentWithAllocationsOut(
        **ProductionJobComponentOut.model_validate(component).model_dump(),
        allocations=[ProductionJobMachineAllocationOut.model_validate(a) for a in allocations],
    )


def _build_job_detail(db: Session, job: ProductionJob) -> ProductionJobDetailOut:
    """Manually assembles the nested components/allocations tree --
    ProductionJob/ProductionJobComponent carry no ORM relationships (same
    FK-columns-only convention as Lot/LotColour), so response_model can't
    derive this automatically from attribute access."""
    components = (
        db.query(ProductionJobComponent)
        .filter(ProductionJobComponent.production_job_id == job.id)
        .order_by(ProductionJobComponent.component_type)
        .all()
    )
    return ProductionJobDetailOut(
        **ProductionJobOut.model_validate(job).model_dump(),
        components=[_component_with_allocations(db, c) for c in components],
    )


@router.get("", response_model=list[ProductionJobOut], operation_id="listProductionJobs")
def list_production_jobs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    lot_colour_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_jobs.view")),
) -> list[ProductionJob]:
    query = db.query(ProductionJob)
    if lot_colour_id:
        query = query.filter(ProductionJob.lot_colour_id == lot_colour_id)
    if status_filter:
        query = query.filter(ProductionJob.status == status_filter)
    return query.order_by(ProductionJob.created_at.desc()).offset(skip).limit(limit).all()


@router.post(
    "", status_code=status.HTTP_201_CREATED, response_model=ProductionJobOut, operation_id="createProductionJob"
)
def create_production_job(
    payload: ProductionJobCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_jobs.create")),
) -> ProductionJob:
    lot_colour = db.get(LotColour, payload.lot_colour_id)
    if lot_colour is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_colour_not_found")

    lot = db.get(Lot, lot_colour.lot_id)
    if lot is None or lot.status != "confirmed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_confirmed")

    design = db.get(Design, payload.design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")

    existing = db.query(ProductionJob).filter_by(lot_colour_id=lot_colour.id).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="job_already_exists_for_colour")

    job = ProductionJob(
        tenant_id=user.tenant_id,
        lot_colour_id=lot_colour.id,
        design_id=design.id,
        status="draft",
    )
    db.add(job)
    db.flush()  # populate job.id -- Python-side default, not set until flush

    # Lot.status == "confirmed" guarantees every one of its LotComponents
    # has is_confirmed=True and a non-null confirmed_quantity (confirm_lot
    # checks this before allowing the transition), so target_quantity is
    # always a real int here.
    components = db.query(LotComponent).filter(LotComponent.lot_colour_id == lot_colour.id).all()
    for component in components:
        db.add(
            ProductionJobComponent(
                tenant_id=user.tenant_id,
                production_job_id=job.id,
                component_type=component.component_type,
                target_quantity=component.confirmed_quantity,
            )
        )

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="production_job",
        entity_id=job.id,
        new_values={"lot_colour_id": str(lot_colour.id), "design_id": str(design.id)},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(job)
    return job


@router.get("/{job_id}", response_model=ProductionJobDetailOut, operation_id="getProductionJob")
def get_production_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("production_jobs.view")),
) -> ProductionJobDetailOut:
    job = db.get(ProductionJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job_not_found")
    return _build_job_detail(db, job)


@router.post(
    "/{job_id}/components/{component_id}/allocate",
    response_model=ProductionJobComponentWithAllocationsOut,
    operation_id="allocateProductionJobComponent",
)
def allocate_production_job_component(
    job_id: uuid.UUID,
    component_id: uuid.UUID,
    payload: AllocateComponentRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("production_jobs.edit")),
) -> ProductionJobComponentWithAllocationsOut:
    job = db.get(ProductionJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="job_not_found")

    component = db.get(ProductionJobComponent, component_id)
    if component is None or component.production_job_id != job.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="component_not_found")

    if not payload.allocations:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="no_machines_selected")

    machine_ids = [a.machine_id for a in payload.allocations]
    if len(set(machine_ids)) != len(machine_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="duplicate_machine")

    machine_count = db.query(Machine).filter(Machine.id.in_(machine_ids)).count()
    if machine_count != len(machine_ids):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="machine_not_found")

    quantities_given = [a.quantity for a in payload.allocations]
    if all(q is None for q in quantities_given):
        quantities = _split_evenly(component.target_quantity, len(payload.allocations))
    elif any(q is None for q in quantities_given):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="mixed_explicit_and_auto_quantities")
    else:
        quantities = quantities_given  # type: ignore[assignment]  -- narrowed to list[int] by the branch above
        if sum(quantities) != component.target_quantity:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="allocation_sum_mismatch")

    # Full replace -- re-running this endpoint (different machines, or
    # switching from auto-split to a custom breakdown) always starts from a
    # clean slate rather than layering new rows on stale ones.
    db.query(ProductionJobMachineAllocation).filter(
        ProductionJobMachineAllocation.production_job_component_id == component.id
    ).delete()

    for machine_id, quantity in zip(machine_ids, quantities):
        db.add(
            ProductionJobMachineAllocation(
                tenant_id=user.tenant_id,
                production_job_component_id=component.id,
                machine_id=machine_id,
                allocated_quantity=quantity,
            )
        )
    db.flush()

    # Roll the job's own status up to "allocated" once every one of its
    # components is fully allocated (allocations summing to target_quantity);
    # back to "draft" the moment any component falls short again.
    all_components = (
        db.query(ProductionJobComponent).filter(ProductionJobComponent.production_job_id == job.id).all()
    )
    fully_allocated = True
    for c in all_components:
        allocated_sum = (
            db.query(func.coalesce(func.sum(ProductionJobMachineAllocation.allocated_quantity), 0))
            .filter(ProductionJobMachineAllocation.production_job_component_id == c.id)
            .scalar()
        )
        if allocated_sum != c.target_quantity:
            fully_allocated = False
            break
    job.status = "allocated" if fully_allocated else "draft"

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="allocate_component",
        entity_type="production_job",
        entity_id=job.id,
        new_values={
            "component_type": component.component_type,
            "allocations": [{"machine_id": str(m), "quantity": q} for m, q in zip(machine_ids, quantities)],
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(component)
    return _component_with_allocations(db, component)
