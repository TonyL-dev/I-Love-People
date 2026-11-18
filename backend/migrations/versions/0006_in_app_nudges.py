"""Durable caller-owned nudge preferences and atomic meetup cycle resets."""

from alembic import op

revision = "0006_in_app_nudges"
down_revision = "0005_explicit_conflicts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
ALTER TABLE public.people ADD COLUMN paused boolean NOT NULL DEFAULT false,
 ADD COLUMN snoozed_until date, ADD COLUMN dismissed_on date;

-- Lock parents before child changes; concurrent creates must not upgrade shared locks.
DO $migration$
DECLARE definition text;
BEGIN
 definition := pg_catalog.pg_get_functiondef(
   'public.journal_write(text,uuid,integer,jsonb)'::regprocedure);
 definition := replace(definition, 'WHERE id=target FOR KEY SHARE', 'WHERE id=target FOR UPDATE');
 definition := replace(definition,
   'SELECT * INTO m FROM public.meetups WHERE id=target FOR UPDATE;',
   'PERFORM id FROM public.people
      WHERE id=(SELECT person_id FROM public.meetups WHERE id=target) FOR UPDATE;
    SELECT * INTO m FROM public.meetups WHERE id=target FOR UPDATE;');
 EXECUTE definition;
END $migration$;

CREATE FUNCTION public.nudge_write(action text, target uuid, expected integer, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE p public.people; local_today date; tz text; choice text; until_date date;
BEGIN
 SELECT * INTO p FROM public.people WHERE id=target FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
 IF p.revision <> expected THEN
   RAISE EXCEPTION 'Revision conflict' USING ERRCODE='PT409';
 END IF;
 SELECT timezone INTO tz FROM public.profiles WHERE owner_id=auth.uid();
 local_today := (now() AT TIME ZONE coalesce(tz,'UTC'))::date;
 choice := payload->>'action'; until_date := (payload->>'until')::date;
 IF action <> 'nudge' OR choice NOT IN
   ('snooze','unsnooze','dismiss','undismiss','pause','unpause') OR choice IS NULL THEN
   RAISE EXCEPTION 'Invalid action' USING ERRCODE='23514';
 END IF;
 IF choice='snooze' AND (until_date IS NULL OR until_date <= local_today) THEN
   RAISE EXCEPTION 'Choose a future date' USING ERRCODE='23514';
 END IF;
 UPDATE public.people SET
   paused=CASE WHEN choice='pause' THEN true WHEN choice='unpause' THEN false ELSE paused END,
   snoozed_until=CASE WHEN choice='snooze' THEN until_date
     WHEN choice='unsnooze' THEN NULL ELSE snoozed_until END,
   dismissed_on=CASE WHEN choice='dismiss' THEN local_today
     WHEN choice='undismiss' THEN NULL ELSE dismissed_on END,
   revision=revision+1 WHERE id=target RETURNING * INTO p;
 RETURN to_jsonb(p);
END $$;
REVOKE ALL ON FUNCTION public.nudge_write(text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.nudge_write(text,uuid,integer,jsonb) TO authenticated;

-- Serialize direct Data API meetup writes with RPC writes and preference edits.
CREATE FUNCTION ilp_private.lock_meetup_person() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
   IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN RETURN OLD; END IF;
   PERFORM id FROM public.people WHERE id=OLD.person_id FOR UPDATE; RETURN OLD;
 ELSE
   PERFORM id FROM public.people WHERE id=NEW.person_id FOR UPDATE; RETURN NEW;
 END IF;
END $$;
CREATE FUNCTION ilp_private.reset_nudge_cycle() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE pid uuid; mid uuid; old_latest date; new_latest date; clear_cycle boolean;
BEGIN
 -- Provider account deletion already cascades people; never access data as Auth's role.
 IF TG_OP='DELETE' THEN
   IF auth.uid() IS DISTINCT FROM OLD.owner_id THEN RETURN OLD; END IF;
   pid := OLD.person_id; mid := OLD.id;
 ELSE
   pid := NEW.person_id; mid := NEW.id;
 END IF;
 IF TG_OP='UPDATE' AND NEW.completed_on=OLD.completed_on THEN RETURN NEW; END IF;
 SELECT max(completed_on) INTO old_latest FROM public.meetups
   WHERE person_id=pid AND id<>mid;
 IF TG_OP<>'INSERT' THEN old_latest := greatest(old_latest,OLD.completed_on); END IF;
 SELECT max(completed_on) INTO new_latest FROM public.meetups WHERE person_id=pid;
 clear_cycle := new_latest IS NULL OR old_latest IS NULL OR new_latest > old_latest;
 UPDATE public.people SET
   snoozed_until=CASE WHEN clear_cycle THEN NULL ELSE snoozed_until END,
   dismissed_on=CASE WHEN clear_cycle THEN NULL ELSE dismissed_on END,
   revision=revision+1 WHERE id=pid;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION ilp_private.lock_meetup_person(),
 ilp_private.reset_nudge_cycle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ilp_private.lock_meetup_person(),
 ilp_private.reset_nudge_cycle() TO authenticated;
CREATE TRIGGER a_lock_meetup_person BEFORE INSERT OR UPDATE OR DELETE ON public.meetups
 FOR EACH ROW EXECUTE FUNCTION ilp_private.lock_meetup_person();
CREATE TRIGGER reset_nudge_cycle AFTER INSERT OR UPDATE OR DELETE ON public.meetups
 FOR EACH ROW EXECUTE FUNCTION ilp_private.reset_nudge_cycle();
NOTIFY pgrst, 'reload schema';
    """)


def downgrade() -> None:
    op.execute("""
DROP TRIGGER reset_nudge_cycle ON public.meetups;
DROP TRIGGER a_lock_meetup_person ON public.meetups;
DROP FUNCTION ilp_private.reset_nudge_cycle(), ilp_private.lock_meetup_person();
DROP FUNCTION public.nudge_write(text,uuid,integer,jsonb);
ALTER TABLE public.people DROP COLUMN paused, DROP COLUMN snoozed_until,
 DROP COLUMN dismissed_on;
    """)
