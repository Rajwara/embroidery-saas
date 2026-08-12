import uuid

from pydantic import BaseModel


class ProductionJobCreateRequest(BaseModel):
    lot_colour_id: uuid.UUID
    design_id: uuid.UUID
    # status excluded -- always starts "draft", lifecycle-controlled by the
    # allocate endpoint.


class ProductionJobOut(BaseModel):
    id: uuid.UUID
    lot_colour_id: uuid.UUID
    design_id: uuid.UUID
    status: str
    # Denormalized read-only convenience fields -- joined in by the router
    # (see routers/production_jobs.py's _to_job_out), not stored columns.
    # Saves the frontend from N+1 lookups since there's no standalone
    # "list lot colours" endpoint to resolve lot_colour_id into a label.
    lot_id: uuid.UUID
    lot_number: str
    colour_name: str
    design_master_number: str
    design_name: str

    model_config = {"from_attributes": True}


class MachineAllocationInput(BaseModel):
    machine_id: uuid.UUID
    # None -> this machine's share is filled in by the even auto-split.
    # Either every allocation in a request omits quantity (pure auto-split)
    # or every one supplies it (caller-supplied breakdown, must sum to the
    # component's target_quantity) -- mixing the two is rejected.
    quantity: int | None = None


class AllocateComponentRequest(BaseModel):
    allocations: list[MachineAllocationInput]


class ProductionJobMachineAllocationOut(BaseModel):
    id: uuid.UUID
    production_job_component_id: uuid.UUID
    machine_id: uuid.UUID
    allocated_quantity: int

    model_config = {"from_attributes": True}


class ProductionJobComponentOut(BaseModel):
    id: uuid.UUID
    production_job_id: uuid.UUID
    component_type: str
    target_quantity: int

    model_config = {"from_attributes": True}


class ProductionJobComponentWithAllocationsOut(ProductionJobComponentOut):
    allocations: list[ProductionJobMachineAllocationOut]


class ProductionJobDetailOut(ProductionJobOut):
    """Used by GET /production-jobs/{id} -- built manually by the router (no
    ORM relationships defined on ProductionJob/ProductionJobComponent),
    not derived automatically from response_model attribute access."""

    components: list[ProductionJobComponentWithAllocationsOut]
