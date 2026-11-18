"""Validate direct Data API timezone writes as well as Python API input."""

from alembic import op

revision: str = "0003_profile_timezone"
down_revision: str | None = "0002_profiles"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("""
        CREATE FUNCTION ilp_private.valid_timezone(value text) RETURNS boolean
        LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
            SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = value)
        $$;
        REVOKE ALL ON FUNCTION ilp_private.valid_timezone(text) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION ilp_private.valid_timezone(text) TO authenticated;
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_valid_timezone
            CHECK (ilp_private.valid_timezone(timezone));
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE public.profiles DROP CONSTRAINT profiles_valid_timezone")
    op.execute("DROP FUNCTION ilp_private.valid_timezone(text)")
