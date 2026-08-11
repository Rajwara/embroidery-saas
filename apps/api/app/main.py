from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, branches, employees, factory, machines, parties, roles, suppliers

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
