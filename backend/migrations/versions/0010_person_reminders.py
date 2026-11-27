"""Keep meetup plans and per-person delivery receipts."""

from alembic import op

revision = "0010_person_reminders"
down_revision = "0009_push_names"
branch_labels = None
depends_on = None

CHANGES = {
    "journal_write(text,uuid,integer,jsonb)": (
        ("cadence_unit,archived)", "cadence_unit,archived,next_scheduled_on)"),
        (
            "(payload->>'archived')::boolean) RETURNING",
            "(payload->>'archived')::boolean,(payload->>'next_scheduled_on')::date) RETURNING",
        ),
        (
            "archived=(payload->>'archived')::boolean, revision=revision+1",
            """archived=(payload->>'archived')::boolean,
     next_scheduled_on=CASE WHEN payload ? 'next_scheduled_on'
       THEN (payload->>'next_scheduled_on')::date ELSE p.next_scheduled_on END,
     revision=revision+1""",
        ),
    ),
    "backup_export_with_plans()": (
        ("snoozed_until, dismissed_on FROM", "snoozed_until, dismissed_on, next_scheduled_on FROM"),
    ),
    "backup_restore(jsonb,text)": (
        ("cadence_unit,archived)", "cadence_unit,archived,next_scheduled_on)"),
        ("p.cadence_unit, p.archived", "p.cadence_unit, p.archived, p.next_scheduled_on"),
        (
            "cadence_unit text, archived boolean",
            "cadence_unit text, archived boolean, next_scheduled_on date",
        ),
    ),
}


def update_functions(*, reverse: bool = False) -> None:
    for signature, replacements in CHANGES.items():
        for original, updated in replacements:
            before, after = (updated, original) if reverse else (original, updated)
            op.execute(f"""
DO $migration$
DECLARE definition text := pg_catalog.pg_get_functiondef('public.{signature}'::regprocedure);
BEGIN
 IF strpos(definition, $before${before}$before$) = 0 THEN
   RAISE EXCEPTION 'Unexpected definition of public.{signature}';
 END IF;
 EXECUTE replace(definition, $before${before}$before$, $after${after}$after$);
END $migration$;
""")


def upgrade() -> None:
    op.execute("""
ALTER TABLE public.people ADD COLUMN next_scheduled_on date
 CHECK (next_scheduled_on BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');

CREATE TABLE ilp_private.person_push_deliveries (
 device_id uuid NOT NULL REFERENCES ilp_private.push_devices(id) ON DELETE CASCADE,
 person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
 local_day date NOT NULL,
 attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 3),
 lease_token uuid NOT NULL,
 ready_after timestamptz NOT NULL,
 outcome text NOT NULL CHECK (outcome IN ('sending','retry','sent','revoked','failed')),
 PRIMARY KEY (device_id, person_id, local_day)
);
CREATE INDEX person_push_deliveries_person ON ilp_private.person_push_deliveries(person_id);
CREATE INDEX person_push_deliveries_retention ON ilp_private.person_push_deliveries(local_day);
ALTER TABLE ilp_private.person_push_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ilp_private.person_push_deliveries FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ilp_private.person_push_deliveries FROM PUBLIC,anon,authenticated,service_role;

DO $migration$ BEGIN
 EXECUTE replace(pg_catalog.pg_get_functiondef('public.backup_export()'::regprocedure),
   'public.backup_export()', 'public.backup_export_with_plans()');
END $migration$;
REVOKE ALL ON FUNCTION public.backup_export_with_plans() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.backup_export_with_plans() TO authenticated;
""")
    update_functions()


def downgrade() -> None:
    update_functions(reverse=True)
    op.execute("""
DROP FUNCTION public.backup_export_with_plans();
DROP TABLE ilp_private.person_push_deliveries;
ALTER TABLE public.people DROP COLUMN next_scheduled_on;
""")
