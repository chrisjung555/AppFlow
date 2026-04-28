from __future__ import annotations

import os
from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = "sqlite:///./appflow.sqlite3"
    cors_allow_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://www.linkedin.com",
    ]


def get_settings() -> Settings:
    # Keep it simple for MVP; switch to pydantic-settings when we add more config.
    cors_origins = os.getenv("CORS_ALLOW_ORIGINS")
    return Settings(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./appflow.sqlite3"),
        cors_allow_origins=[
            origin.strip() for origin in (cors_origins.split(",") if cors_origins else []) if origin.strip()
        ]
        or ["http://localhost:5173", "http://localhost:3000", "https://www.linkedin.com"],
    )

