from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/embroidery_saas"
    # Owner/migration-role connection used only by Alembic. Falls back to database_url
    # when unset (e.g. before the app_user role has been provisioned). See ROADMAP.md
    # Phase 1 RLS notes: the API must run as a non-owning role for RLS to apply at all.
    migrations_database_url: str | None = None
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 14

    resend_api_key: str = ""
    environment: str = "local"
    cors_origins: str = "http://localhost:3000"

    # Shared secret for apps/worker's internal-only /internal/* endpoints
    # (scheduled report delivery). Not a user JWT -- the Celery beat job has
    # no human session, so it authenticates with this header instead. Must
    # be overridden in every real environment, same as jwt_secret.
    internal_api_secret: str = "change-me-in-every-environment"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_production_secrets(self) -> None:
        """Fails startup loudly instead of silently serving with a
        known-public default secret. Added after finding INTERNAL_API_SECRET
        unset (and therefore defaulted) in production for an unknown period
        -- see project_railway_release_step_broken memory context. jwt_secret
        and internal_api_secret's defaults are both literal strings visible
        in this file in the public repo, so leaving either unset outside
        local dev is a real, exploitable gap, not just bad hygiene."""
        if self.environment == "local":
            return
        insecure_defaults = {
            "jwt_secret": "change-me",
            "internal_api_secret": "change-me-in-every-environment",
        }
        offending = [name for name, default in insecure_defaults.items() if getattr(self, name) == default]
        if offending:
            raise RuntimeError(
                f"Refusing to start with default value(s) for {', '.join(offending)} "
                f"in environment '{self.environment}'. Set real secrets via env vars."
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
