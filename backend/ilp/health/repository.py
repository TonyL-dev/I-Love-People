from typing import Protocol

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool


class HealthRepository(Protocol):
    def can_connect(self) -> bool: ...


class DatabaseHealthRepository:
    """Only this adapter touches the database; no user data is read."""

    def __init__(self, database_url: str | None) -> None:
        self._database_url = database_url

    def can_connect(self) -> bool:
        if self._database_url is None:
            return False
        engine = create_engine(
            self._database_url,
            poolclass=NullPool,
            connect_args={"connect_timeout": 3},
            hide_parameters=True,
        )
        try:
            with engine.connect() as connection:
                return bool(connection.execute(text("SELECT 1")).scalar_one() == 1)
        finally:
            engine.dispose()
