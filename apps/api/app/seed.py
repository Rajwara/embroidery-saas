"""
Run with: python -m app.seed
Creates one demo tenant + one Factory Super Admin user so every screen has
data to render against from day one (Phase 0, step 6 in ROADMAP.md).

Runs through the owner/migration connection, not the app's restricted
app_user role -- inserting a tenant's very first User row would otherwise be
blocked by the RLS WITH CHECK on users (no tenant context can exist yet for a
tenant that doesn't exist yet). Same reasoning as Alembic migrations.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models import Tenant, User
from app.permissions_catalog import ROLE_TEMPLATES, create_role_templates_for_tenant
from app.security import hash_password

settings = get_settings()
_engine = create_engine(settings.migrations_database_url or settings.database_url)
SeedSessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def run() -> None:
    db = SeedSessionLocal()
    try:
        tenant = Tenant(name="Demo Embroidery Factory")
        db.add(tenant)
        db.flush()

        admin = User(
            tenant_id=tenant.id,
            email="admin@demo-factory.test",
            hashed_password=hash_password("changeme123"),
            full_name="Demo Super Admin",
            is_super_admin=True,
            # Local-dev-only convenience so the Platform Super Admin portal
            # (routers/platform.py) has an account to log into without a
            # separate seed script -- does not imply anything about which
            # account holds this flag in production.
            is_platform_admin=True,
        )
        db.add(admin)

        roles = create_role_templates_for_tenant(db, tenant.id)
        db.flush()

        manager_role = next(r for r in roles if r.name == "Factory Manager")
        manager = User(
            tenant_id=tenant.id,
            email="manager@demo-factory.test",
            hashed_password=hash_password("changeme123"),
            full_name="Demo Factory Manager",
        )
        manager.roles.append(manager_role)
        db.add(manager)

        db.commit()
        print(f"Seeded tenant {tenant.id} with admin user {admin.email} / changeme123")
        print(f"Seeded {len(roles)} role templates ({', '.join(t['name'] for t in ROLE_TEMPLATES)})")
        print(f"Seeded manager user {manager.email} / changeme123 with role '{manager_role.name}'")
    finally:
        db.close()


if __name__ == "__main__":
    run()
