-- Runs once, only on a fresh Postgres volume (docker-entrypoint-initdb.d semantics).
-- Creates the restricted role the API connects as, so Postgres RLS actually applies
-- to it (the table-owning "postgres" role would otherwise bypass RLS regardless of
-- FORCE ROW LEVEL SECURITY). See apps/api/app/db.py and the Phase 1 RLS migration.
CREATE ROLE app_user LOGIN PASSWORD 'app_user_local_dev' NOSUPERUSER NOBYPASSRLS;
GRANT CONNECT ON DATABASE embroidery_saas TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Tables don't exist yet at this point (this runs before any migration) — this makes
-- every table the owner role creates from now on auto-grant to app_user.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
