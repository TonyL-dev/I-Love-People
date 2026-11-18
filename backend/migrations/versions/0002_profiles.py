"""One owned account profile; managed Auth tables remain provider-owned."""

from alembic import op

revision: str = "0002_profiles"
down_revision: str | None = "0001_foundation"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute("""
        CREATE SCHEMA ilp_private;
        REVOKE ALL ON SCHEMA ilp_private FROM PUBLIC;
        GRANT USAGE ON SCHEMA ilp_private TO authenticated;
        CREATE FUNCTION ilp_private.session_active() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
            SELECT EXISTS (
                SELECT 1 FROM auth.sessions s JOIN auth.users u ON u.id = s.user_id
                WHERE s.id = (auth.jwt()->>'session_id')::uuid AND s.user_id = auth.uid()
                AND (s.not_after IS NULL OR s.not_after > now())
                AND u.deleted_at IS NULL
                AND (u.banned_until IS NULL OR u.banned_until <= now())
            )
        $$;
        REVOKE ALL ON FUNCTION ilp_private.session_active() FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION ilp_private.session_active() TO authenticated;
        CREATE TABLE public.profiles (
            owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            timezone text NOT NULL DEFAULT 'UTC' CHECK (length(timezone) BETWEEN 1 AND 64)
        );
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
        REVOKE ALL ON public.profiles FROM PUBLIC, anon;
        GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
        CREATE POLICY profiles_read ON public.profiles FOR SELECT TO authenticated
            USING ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
        CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
            WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
        NOTIFY pgrst, 'reload schema';
        CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
            USING ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()))
            WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
    """)


def downgrade() -> None:
    op.execute("DROP TABLE public.profiles")
    op.execute("DROP FUNCTION ilp_private.session_active()")
    op.execute("DROP SCHEMA ilp_private")
