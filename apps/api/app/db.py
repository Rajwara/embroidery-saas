import uuid
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

    Only lasts for the current transaction (SET LOCAL semantics) -- if a
    request commits mid-flight and keeps issuing tenant-scoped queries on the
    same session, call this again after the commit; a fresh transaction
    auto-begins with no app.tenant_id set.

    Example RLS policy (add in your migration):
        ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
        CREATE POLICY tenant_isolation ON parties
            USING (tenant_id = current_setting('app.tenant_id')::uuid);
    """
    # Postgres's SET/SET LOCAL do not accept bind parameters -- only literals
    # -- so this must be a literal, not `text("...").bindparams(...)`. Safe to
    # interpolate directly because uuid.UUID(...) raises on anything that
    # isn't a well-formed UUID, so no injection surface reaches the SQL string.
    validated = uuid.UUID(str(tenant_id))
    db.execute(text(f"SET LOCAL app.tenant_id = '{validated}'"))
