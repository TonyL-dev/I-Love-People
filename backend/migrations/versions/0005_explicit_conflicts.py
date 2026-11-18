"""Return deliberate conflicts without triggering hosted serialization retries."""

from alembic import op

revision = "0005_explicit_conflicts"
down_revision = "0004_people_meetups"
branch_labels = None
depends_on = None


def replace_code(old: str, new: str) -> None:
    # These are migration-owned function identities and literal SQLSTATE codes.
    # Preserve their grants, triggers and complete definitions while changing only
    # the deliberate conflict signal; real serialization failures remain retryable.
    op.execute(f"""
        DO $migration$
        DECLARE function_name regprocedure; definition text;
        BEGIN
          FOREACH function_name IN ARRAY ARRAY[
            'ilp_private.journal_guard()'::regprocedure,
            'public.journal_write(text,uuid,integer,jsonb)'::regprocedure
          ] LOOP
            definition := pg_catalog.pg_get_functiondef(function_name);
            EXECUTE replace(definition, '{old}', '{new}');
          END LOOP;
        END $migration$;
    """)


def upgrade() -> None:
    replace_code("40001", "PT409")


def downgrade() -> None:
    replace_code("PT409", "40001")
