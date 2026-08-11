"""rls policies and app_user grants

Revision ID: e650e40e66c3
Revises: 3e43f74d90be
Create Date: 2026-08-11 11:53:02.681352

Enforces tenant isolation at the database layer. Must run as the table-owning
role (MIGRATIONS_DATABASE_URL) -- the "app_user" role this migration grants to
must already exist in the target database before this runs (created by
docker-compose/init/01-app-role.sql locally; created manually via the Neon
console / neonctl in every other environment). See apps/api/app/db.py and
ROADMAP.md Phase 1 for the two-role design this implements.

Policy shapes used:
  - "strict" tables: USING and WITH CHECK both require an exact tenant_id
    match against current_setting('app.tenant_id') (the *required*, not
    missing-ok, form) -- a request that never called set_tenant_context()
    hard-errors instead of silently seeing zero/all rows.
  - "users" / "password_reset_tokens": reads are permitted pre-tenant-context
    (login-by-email and reset-by-token both happen before a tenant is known),
    but writes always require a matching tenant context -- the auth router
    calls set_tenant_context() immediately after resolving the user/token,
    before any INSERT/UPDATE on these tables.
  - "login_history": reads follow the same permissive pattern; writes are
    unconditionally allowed (WITH CHECK true) because this table is only ever
    written by the trusted auth router itself with a tenant_id it already
    derived server-side (or genuinely NULL, for a failed attempt against an
    unknown email) -- a strict WITH CHECK would reject those NULL-tenant rows.

Permissive policies wrap every current_setting('app.tenant_id', true) call in
NULLIF(..., '') -- both the "is there a context" check AND the value that
gets cast to ::uuid, not just the check. Two reasons, both required:
  1. Once a custom GUC has been SET LOCAL at least once on a given physical
     connection, Postgres reverts it to an empty string (not NULL) once that
     transaction ends -- not "unset". Since connections are pooled and reused
     across unrelated requests, a brand new request/session can inherit that
     '' leftover from a completely different prior request on the same
     pooled connection.
  2. Postgres does not guarantee left-to-right short-circuit evaluation of
     AND/OR (see docs section "Expression Evaluation Rules") -- so even with
     the IS NULL branch true, the ::uuid cast in the other branch can still
     run and error on ''. Wrapping the cast's own argument in NULLIF makes it
     produce SQL NULL instead of erroring, regardless of evaluation order.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'e650e40e66c3'
down_revision: Union[str, None] = '3e43f74d90be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Tables with a plain, always-required tenant_id column: strict policy both ways.
STRICT_TABLES = [
    "roles",
    "factories",
    "branches",
    "parties",
    "suppliers",
    "machines",
    "employees",
    "audit_log",
]

STRICT_POLICY = """
    ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
    ALTER TABLE {table} FORCE ROW LEVEL SECURITY;
    CREATE POLICY tenant_isolation ON {table}
        USING (tenant_id = current_setting('app.tenant_id')::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
"""

DROP_STRICT_POLICY = """
    DROP POLICY IF EXISTS tenant_isolation ON {table};
    ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;
"""


def upgrade() -> None:
    # --- app_user grants (role itself must already exist) ---
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;")
    # Portable across environments (works for Neon too, not just the local
    # docker-compose init script): default-grants future tables to whichever
    # role runs migrations, i.e. the role executing this statement.
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;"
    )
    op.execute(
        "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
        "GRANT USAGE, SELECT ON SEQUENCES TO app_user;"
    )

    # --- retrofit missing tenant_id indexes on Phase 0 tables ---
    op.create_index(op.f("ix_users_tenant_id"), "users", ["tenant_id"])
    op.create_index(op.f("ix_roles_tenant_id"), "roles", ["tenant_id"])

    # --- strict policy tables ---
    for table in STRICT_TABLES:
        op.execute(STRICT_POLICY.format(table=table))

    # --- users: permissive read (pre-tenant login lookup), strict write ---
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON users
            USING (
                NULLIF(current_setting('app.tenant_id', true), '') IS NULL
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
            )
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
        """
    )

    # --- password_reset_tokens: same shape as users, same reason (lookup by
    # token happens before the tenant is known) ---
    op.execute("ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE password_reset_tokens FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON password_reset_tokens
            USING (
                NULLIF(current_setting('app.tenant_id', true), '') IS NULL
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
            )
            WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
        """
    )

    # --- login_history: permissive read, unconditional write (see module docstring) ---
    op.execute("ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE login_history FORCE ROW LEVEL SECURITY;")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON login_history
            USING (
                NULLIF(current_setting('app.tenant_id', true), '') IS NULL
                OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid
                OR tenant_id IS NULL
            )
            WITH CHECK (true);
        """
    )

    # tenants (the boundary itself, no tenant_id column) and permissions /
    # role_permissions / user_roles (global or junction tables with no
    # tenant_id column) intentionally get no tenant policy.


def downgrade() -> None:
    op.execute(DROP_STRICT_POLICY.format(table="login_history"))
    op.execute(DROP_STRICT_POLICY.format(table="password_reset_tokens"))
    op.execute(DROP_STRICT_POLICY.format(table="users"))

    for table in reversed(STRICT_TABLES):
        op.execute(DROP_STRICT_POLICY.format(table=table))

    op.drop_index(op.f("ix_roles_tenant_id"), table_name="roles")
    op.drop_index(op.f("ix_users_tenant_id"), table_name="users")

    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_user;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM app_user;")
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_user;")
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM app_user;")
