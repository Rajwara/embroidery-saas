import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Design, DesignVariant, User
from app.models.design_variant import COMPONENT_LETTERS
from app.schemas.design import (
    DesignCreateRequest,
    DesignDetailOut,
    DesignOut,
    DesignUpdateRequest,
    DesignVariantCreateRequest,
    DesignVariantOut,
    DesignVariantUpdateRequest,
)

router = APIRouter()


def _build_design_detail(db: Session, design: Design) -> DesignDetailOut:
    variants = (
        db.query(DesignVariant)
        .filter(DesignVariant.design_id == design.id)
        .order_by(DesignVariant.variant_code)
        .all()
    )
    return DesignDetailOut(
        **DesignOut.model_validate(design).model_dump(),
        variants=[DesignVariantOut.model_validate(v) for v in variants],
    )


@router.get("", response_model=list[DesignOut], operation_id="listDesigns")
def list_designs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    master_number: str | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("designs.view")),
) -> list[Design]:
    query = db.query(Design)
    if master_number:
        query = query.filter(Design.master_number.ilike(f"%{master_number}%"))
    return query.order_by(Design.master_number).offset(skip).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=DesignOut, operation_id="createDesign")
def create_design(
    payload: DesignCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs.create")),
) -> Design:
    # Design.master_number carries a real unique constraint -- pre-check for
    # a clean 409 instead of letting a raw IntegrityError surface as a 500;
    # the DB constraint remains the actual backstop for the race-condition
    # case (same pattern as branches.py's code check).
    existing = db.query(Design).filter_by(master_number=payload.master_number).first()
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="master_number_already_exists")

    design = Design(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(design)
    db.flush()  # populate design.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="design",
        entity_id=design.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(design)
    return design


@router.get("/{design_id}", response_model=DesignDetailOut, operation_id="getDesign")
def get_design(
    design_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("designs.view")),
) -> DesignDetailOut:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")
    return _build_design_detail(db, design)


@router.patch("/{design_id}", response_model=DesignOut, operation_id="updateDesign")
def update_design(
    design_id: uuid.UUID,
    payload: DesignUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs.edit")),
) -> Design:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in payload.model_dump(exclude_none=True).items():
        current = getattr(design, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(design, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="design",
            entity_id=design.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(design)
    return design


@router.post(
    "/{design_id}/variants",
    status_code=status.HTTP_201_CREATED,
    response_model=DesignVariantOut,
    operation_id="addDesignVariant",
)
def add_design_variant(
    design_id: uuid.UUID,
    payload: DesignVariantCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs.edit")),
) -> DesignVariant:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")

    existing = (
        db.query(DesignVariant)
        .filter_by(
            design_id=design.id,
            component_type=payload.component_type,
            colour_variant_code=payload.colour_variant_code,
        )
        .first()
    )
    if existing is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="duplicate_variant")

    component_letter = COMPONENT_LETTERS[payload.component_type]
    variant_code = f"{design.master_number}{component_letter}-{payload.colour_variant_code}"

    variant = DesignVariant(
        tenant_id=user.tenant_id,
        design_id=design.id,
        component_type=payload.component_type,
        component_letter=component_letter,
        colour_variant_code=payload.colour_variant_code,
        variant_code=variant_code,
        stitch_count=payload.stitch_count,
    )
    db.add(variant)
    db.flush()  # populate variant.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="add_variant",
        entity_type="design",
        entity_id=design.id,
        new_values={"variant_code": variant_code, "component_type": payload.component_type},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(variant)
    return variant


@router.patch(
    "/{design_id}/variants/{variant_id}",
    response_model=DesignVariantOut,
    operation_id="updateDesignVariant",
)
def update_design_variant(
    design_id: uuid.UUID,
    variant_id: uuid.UUID,
    payload: DesignVariantUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs.edit")),
) -> DesignVariant:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")

    variant = db.get(DesignVariant, variant_id)
    if variant is None or variant.design_id != design.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="variant_not_found")

    old_stitch_count = variant.stitch_count
    variant.stitch_count = payload.stitch_count

    if old_stitch_count != payload.stitch_count:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update_variant",
            entity_type="design",
            entity_id=design.id,
            old_values={"stitch_count": old_stitch_count},
            new_values={"stitch_count": payload.stitch_count},
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(variant)
    return variant


@router.delete(
    "/{design_id}/variants/{variant_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="removeDesignVariant",
)
def remove_design_variant(
    design_id: uuid.UUID,
    variant_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("designs.edit")),
) -> None:
    design = db.get(Design, design_id)
    if design is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="design_not_found")

    variant = db.get(DesignVariant, variant_id)
    if variant is None or variant.design_id != design.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="variant_not_found")

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="remove_variant",
        entity_type="design",
        entity_id=design.id,
        old_values={"variant_code": variant.variant_code},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.delete(variant)
    db.commit()
