from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency: one DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_tenant_context(db: Session, tenant_id: str) -> None:
    """
    Call this at the top of every authenticated request (after resolving the
    user's tenant) before touching any tenant-scoped table. Postgres RLS
    policies should read current_setting('app.tenant_id') to filter rows.

    Example RLS policy (add in your migration):
        ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation ON parties
            USING (tenant_id = current_setting('app.tenant_id')::uuid);
    """
    db.execute(text("SET LOCAL app.tenant_id = :tenant_id"), {"tenant_id": tenant_id})
