from alembic import context
from ilp.data.base import Base
from ilp.infrastructure.settings import get_settings
from sqlalchemy import Connection, create_engine, text


def run_migrations() -> None:
    url = get_settings().database_url
    if url is None:
        raise RuntimeError("Set ILP_DATABASE_URL in a server-only environment before migrating.")
    if context.is_offline_mode():
        raise RuntimeError("Use online migrations so the isolated version schema is initialized.")
    engine = create_engine(url.get_secret_value(), hide_parameters=True)
    try:
        with engine.connect() as connection:
            acquire_migration_lock(connection)
            prepare_version_schema(connection)
            context.configure(
                connection=connection,
                target_metadata=Base.metadata,
                version_table_schema="ilp_migrations",
            )
            with context.begin_transaction():
                context.run_migrations()
    finally:
        engine.dispose()


def acquire_migration_lock(connection: Connection) -> None:
    # Session-scoped so it also covers version-schema initialization and its commit.
    acquired = connection.execute(
        text("SELECT pg_try_advisory_lock(hashtextextended('i-love-people:alembic', 0))")
    ).scalar_one()
    if not acquired:
        raise RuntimeError("An I Love People migration is already running.")


def prepare_version_schema(connection: Connection) -> None:
    connection.execute(text("CREATE SCHEMA IF NOT EXISTS ilp_migrations"))
    connection.execute(text("REVOKE ALL ON SCHEMA ilp_migrations FROM PUBLIC"))
    connection.commit()


run_migrations()
