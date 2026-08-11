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

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
