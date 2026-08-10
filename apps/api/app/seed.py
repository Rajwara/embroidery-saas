"""
Run with: python -m app.seed
Creates one demo tenant + one Factory Super Admin user so every screen has
data to render against from day one (Phase 0, step 6 in ROADMAP.md).
"""

from passlib.context import CryptContext

from app.db import SessionLocal
from app.models import Tenant, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def run() -> None:
    db = SessionLocal()
    try:
        tenant = Tenant(name="Demo Embroidery Factory")
        db.add(tenant)
        db.flush()

        admin = User(
            tenant_id=tenant.id,
            email="admin@demo-factory.test",
            hashed_password=pwd_context.hash("changeme123"),
            full_name="Demo Super Admin",
            is_super_admin=True,
        )
        db.add(admin)
        db.commit()
        print(f"Seeded tenant {tenant.id} with admin user {admin.email} / changeme123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
