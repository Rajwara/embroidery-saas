import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.audit import client_meta, record_audit
from app.db import get_db, set_tenant_context
from app.dependencies import require_permission
from app.models import Branch, Factory, Lot, LotColour, LotComponent, Party, User
from app.models.lot_component import COMPONENTS_BY_SUIT_TYPE
from app.schemas.lot import (
    LotColourCreateRequest,
    LotColourOut,
    LotColourWithComponentsOut,
    LotComponentConfirmRequest,
    LotComponentOut,
    LotCreateRequest,
    LotDetailOut,
    LotOut,
    LotUpdateRequest,
)

router = APIRouter()


def _build_lot_detail(db: Session, lot: Lot) -> LotDetailOut:
    """Manually assembles the nested colours/components tree -- Lot/LotColour
    carry no ORM relationships (this codebase's models are FK-columns-only,
    same as Branch/Machine/Employee), so response_model can't derive this
    automatically from attribute access."""
    colours = db.query(LotColour).filter(LotColour.lot_id == lot.id).order_by(LotColour.colour_name).all()
    colour_outs = []
    for colour in colours:
        components = (
            db.query(LotComponent)
            .filter(LotComponent.lot_colour_id == colour.id)
            .order_by(LotComponent.component_type)
            .all()
        )
        colour_outs.append(
            LotColourWithComponentsOut(
                **LotColourOut.model_validate(colour).model_dump(),
                components=[LotComponentOut.model_validate(c) for c in components],
            )
        )
    return LotDetailOut(**LotOut.model_validate(lot).model_dump(), colours=colour_outs)


@router.get("", response_model=list[LotOut], operation_id="listLots")
def list_lots(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    party_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("lots.view")),
) -> list[Lot]:
    query = db.query(Lot)
    if party_id:
        query = query.filter(Lot.party_id == party_id)
    if status_filter:
        query = query.filter(Lot.status == status_filter)
    return query.order_by(Lot.lot_number.desc()).offset(skip).limit(limit).all()


@router.post("", status_code=status.HTTP_201_CREATED, response_model=LotOut, operation_id="createLot")
def create_lot(
    payload: LotCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.create")),
) -> Lot:
    branch = db.get(Branch, payload.branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    party = db.get(Party, payload.party_id)
    if party is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")

    # Locked for the rest of this transaction -- serializes concurrent
    # create_lot calls so two requests can never be assigned the same
    # lot_number.
    factory = db.query(Factory).with_for_update().first()
    if factory is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="factory_not_found")

    lot_number = f"LOT-{factory.next_lot_number:06d}"
    factory.next_lot_number += 1

    lot = Lot(
        tenant_id=user.tenant_id,
        lot_number=lot_number,
        status="pending_breakdown",
        **payload.model_dump(),
    )
    db.add(lot)
    db.flush()  # populate lot.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="create",
        entity_type="lot",
        entity_id=lot.id,
        new_values={**payload.model_dump(), "lot_number": lot_number},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(lot)
    return lot


@router.get("/{lot_id}", response_model=LotDetailOut, operation_id="getLot")
def get_lot(
    lot_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_permission("lots.view")),
) -> LotDetailOut:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    return _build_lot_detail(db, lot)


@router.patch("/{lot_id}", response_model=LotOut, operation_id="updateLot")
def update_lot(
    lot_id: uuid.UUID,
    payload: LotUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> Lot:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status == "confirmed":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_already_confirmed")

    updates = payload.model_dump(exclude_none=True)

    if "total_suit_count" in updates or "suit_type" in updates:
        has_colours = db.query(LotColour).filter(LotColour.lot_id == lot.id).first() is not None
        if has_colours:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="lot_has_colours")

    if "branch_id" in updates and db.get(Branch, updates["branch_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="branch_not_found")
    if "party_id" in updates and db.get(Party, updates["party_id"]) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="party_not_found")

    old_values: dict = {}
    new_values: dict = {}
    for field, value in updates.items():
        current = getattr(lot, field)
        if current != value:
            old_values[field] = current
            new_values[field] = value
        setattr(lot, field, value)

    if new_values:
        ip_address, user_agent = client_meta(request)
        record_audit(
            db,
            tenant_id=user.tenant_id,
            actor_user_id=user.id,
            action="update",
            entity_type="lot",
            entity_id=lot.id,
            old_values=old_values,
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(lot)
    return lot


@router.post(
    "/{lot_id}/colours",
    status_code=status.HTTP_201_CREATED,
    response_model=LotColourOut,
    operation_id="addLotColour",
)
def add_lot_colour(
    lot_id: uuid.UUID,
    payload: LotColourCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> LotColour:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status != "pending_breakdown":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_pending_breakdown")

    existing_sum = (
        db.query(func.coalesce(func.sum(LotColour.suit_count), 0)).filter(LotColour.lot_id == lot.id).scalar()
    )
    if existing_sum + payload.suit_count > lot.total_suit_count:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="colour_sum_exceeds_total")

    colour = LotColour(tenant_id=user.tenant_id, lot_id=lot.id, **payload.model_dump())
    db.add(colour)
    db.flush()  # populate colour.id -- Python-side default, not set until flush

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="add_colour",
        entity_type="lot",
        entity_id=lot.id,
        new_values=payload.model_dump(),
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(colour)
    return colour


@router.delete(
    "/{lot_id}/colours/{colour_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="removeLotColour"
)
def remove_lot_colour(
    lot_id: uuid.UUID,
    colour_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> None:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status != "pending_breakdown":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_pending_breakdown")

    colour = db.get(LotColour, colour_id)
    if colour is None or colour.lot_id != lot.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="colour_not_found")

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="remove_colour",
        entity_type="lot",
        entity_id=lot.id,
        old_values={"colour_name": colour.colour_name, "suit_count": colour.suit_count},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.delete(colour)
    db.commit()


@router.post(
    "/{lot_id}/generate-components",
    response_model=LotDetailOut,
    operation_id="generateLotComponents",
)
def generate_lot_components(
    lot_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> LotDetailOut:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status != "pending_breakdown":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_pending_breakdown")

    colours = db.query(LotColour).filter(LotColour.lot_id == lot.id).all()
    colour_sum = sum(c.suit_count for c in colours)
    if not colours or colour_sum != lot.total_suit_count:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="colour_sum_incomplete")

    component_types = COMPONENTS_BY_SUIT_TYPE[lot.suit_type]
    for colour in colours:
        for component_type in component_types:
            db.add(
                LotComponent(
                    tenant_id=user.tenant_id,
                    lot_colour_id=colour.id,
                    component_type=component_type,
                    expected_quantity=colour.suit_count,
                )
            )

    lot.status = "pending_confirmation"

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="generate_components",
        entity_type="lot",
        entity_id=lot.id,
        new_values={"component_types": list(component_types), "colour_count": len(colours)},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(lot)
    return _build_lot_detail(db, lot)


@router.patch(
    "/{lot_id}/components/{component_id}",
    response_model=LotComponentOut,
    operation_id="confirmLotComponent",
)
def confirm_lot_component(
    lot_id: uuid.UUID,
    component_id: uuid.UUID,
    payload: LotComponentConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> LotComponent:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status != "pending_confirmation":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_pending_confirmation")

    component = db.get(LotComponent, component_id)
    if component is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="component_not_found")
    colour = db.get(LotColour, component.lot_colour_id)
    if colour is None or colour.lot_id != lot.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="component_not_found")

    old_values = {"confirmed_quantity": component.confirmed_quantity, "is_confirmed": component.is_confirmed}
    component.confirmed_quantity = payload.confirmed_quantity
    component.is_confirmed = True

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="confirm_component",
        entity_type="lot",
        entity_id=lot.id,
        old_values=old_values,
        new_values={
            "component_type": component.component_type,
            "confirmed_quantity": payload.confirmed_quantity,
        },
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(component)
    return component


@router.post("/{lot_id}/confirm", response_model=LotDetailOut, operation_id="confirmLot")
def confirm_lot(
    lot_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("lots.edit")),
) -> LotDetailOut:
    lot = db.get(Lot, lot_id)
    if lot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="lot_not_found")
    if lot.status != "pending_confirmation":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="lot_not_pending_confirmation")

    unconfirmed = (
        db.query(LotComponent)
        .join(LotColour, LotComponent.lot_colour_id == LotColour.id)
        .filter(LotColour.lot_id == lot.id, LotComponent.is_confirmed.is_(False))
        .first()
    )
    if unconfirmed is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="components_not_confirmed")

    lot.status = "confirmed"

    ip_address, user_agent = client_meta(request)
    record_audit(
        db,
        tenant_id=user.tenant_id,
        actor_user_id=user.id,
        action="confirm_lot",
        entity_type="lot",
        entity_id=lot.id,
        new_values={"status": "confirmed"},
        ip_address=ip_address,
        user_agent=user_agent,
    )

    db.commit()
    set_tenant_context(db, str(user.tenant_id))
    db.refresh(lot)
    return _build_lot_detail(db, lot)
