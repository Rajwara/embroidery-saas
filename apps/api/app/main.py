from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    auth,
    branches,
    delivery_challans,
    designs,
    employees,
    expenses,
    factory,
    inventory,
    invoices,
    lots,
    machines,
    parties,
    payments,
    production_entries,
    production_jobs,
    purchases,
    roles,
    suppliers,
)

settings = get_settings()

app = FastAPI(title="Embroidery Factory Management SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "environment": settings.environment}


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(roles.router, tags=["roles"])
app.include_router(factory.router, prefix="/factory", tags=["factory"])
app.include_router(branches.router, prefix="/branches", tags=["branches"])
app.include_router(machines.router, prefix="/machines", tags=["machines"])
app.include_router(employees.router, prefix="/employees", tags=["employees"])
app.include_router(parties.router, prefix="/parties", tags=["parties"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
app.include_router(lots.router, prefix="/lots", tags=["lots"])
app.include_router(designs.router, prefix="/designs", tags=["designs"])
app.include_router(production_jobs.router, prefix="/production-jobs", tags=["production-jobs"])
app.include_router(production_entries.router, prefix="/production-entries", tags=["production-entries"])
app.include_router(delivery_challans.router, prefix="/delivery-challans", tags=["delivery-challans"])
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])
app.include_router(purchases.router, prefix="/purchases", tags=["purchases"])
app.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
app.include_router(inventory.router, prefix="/inventory-items", tags=["inventory"])
