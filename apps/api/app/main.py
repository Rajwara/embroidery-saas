from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, parties, roles, suppliers

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
app.include_router(parties.router, prefix="/parties", tags=["parties"])
app.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
