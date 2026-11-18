"""Owned people, meetup history and transactional retry receipts."""

from alembic import op

revision = "0004_people_meetups"
down_revision = "0003_profile_timezone"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
CREATE TABLE public.people (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid()
 REFERENCES auth.users(id) ON DELETE CASCADE,
 name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 120),
 priority text CHECK(priority IN ('closest','close','occasional','distant')),
 cadence_count integer CHECK(cadence_count BETWEEN 1 AND 365),
 cadence_unit text CHECK(cadence_unit IN ('days','weeks','months')),
 archived boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id), CHECK((cadence_count IS NULL) = (cadence_unit IS NULL))
);
CREATE TABLE public.meetups (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid()
 REFERENCES auth.users(id) ON DELETE CASCADE,
 person_id uuid NOT NULL, completed_on date NOT NULL,
 note text NOT NULL DEFAULT '' CHECK(length(note) <= 2000),
 revision integer NOT NULL DEFAULT 1 CHECK(revision > 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,person_id) REFERENCES public.people(owner_id,id) ON DELETE CASCADE
);
CREATE INDEX people_owner_name ON public.people(owner_id,name,id);
CREATE INDEX meetups_owner_person_date ON public.meetups(owner_id,person_id,completed_on DESC);
CREATE TABLE public.meetup_requests (
 owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL, person_id uuid NOT NULL,
 payload text NOT NULL, result jsonb NOT NULL,
 PRIMARY KEY(owner_id,request_id),
 FOREIGN KEY(owner_id,person_id) REFERENCES public.people(owner_id,id) ON DELETE CASCADE
);
CREATE FUNCTION ilp_private.journal_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE tz text;
BEGIN
 IF TG_OP = 'UPDATE' THEN
   IF NEW.id <> OLD.id OR NEW.owner_id <> OLD.owner_id OR NEW.created_at <> OLD.created_at
      OR NEW.revision <> OLD.revision + 1 THEN
     RAISE EXCEPTION 'Revision conflict' USING ERRCODE = '40001';
   END IF;
   IF TG_TABLE_NAME = 'meetups' THEN
     IF NEW.person_id <> OLD.person_id THEN
       RAISE EXCEPTION 'Immutable parent' USING ERRCODE = '23514';
     END IF;
   END IF;
 ELSE
   NEW.revision := 1; NEW.created_at := now();
 END IF;
 NEW.updated_at := now();
 IF TG_TABLE_NAME = 'meetups' THEN
   SELECT timezone INTO tz FROM public.profiles WHERE owner_id = auth.uid();
   IF NEW.completed_on > (now() AT TIME ZONE coalesce(tz,'UTC'))::date THEN
     RAISE EXCEPTION 'Future completed date' USING ERRCODE = '23514';
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION ilp_private.journal_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ilp_private.journal_guard() TO authenticated;
CREATE TRIGGER people_guard BEFORE INSERT OR UPDATE ON public.people
 FOR EACH ROW EXECUTE FUNCTION ilp_private.journal_guard();
CREATE TRIGGER meetups_guard BEFORE INSERT OR UPDATE ON public.meetups
 FOR EACH ROW EXECUTE FUNCTION ilp_private.journal_guard();
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.people FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.people TO authenticated;
CREATE POLICY people_owner ON public.people TO authenticated
 USING ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()))
 WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
ALTER TABLE public.meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetups FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.meetups FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meetups TO authenticated;
CREATE POLICY meetups_owner ON public.meetups TO authenticated
 USING ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()))
 WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
ALTER TABLE public.meetup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetup_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.meetup_requests FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.meetup_requests TO authenticated;
CREATE POLICY meetup_requests_owner ON public.meetup_requests TO authenticated
 USING ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()))
 WITH CHECK ((SELECT auth.uid()) = owner_id AND (SELECT ilp_private.session_active()));
CREATE FUNCTION public.journal_write(action text, target uuid, expected integer, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
#variable_conflict use_variable
DECLARE p public.people; m public.meetups; previous public.meetup_requests; result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT ilp_private.session_active() THEN
   RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
 END IF;
 IF action = 'person_create' THEN
   INSERT INTO public.people(id,name,priority,cadence_count,cadence_unit,archived)
   VALUES(target,payload->>'name',payload->>'priority',(payload->>'cadence_count')::int,
          payload->>'cadence_unit',(payload->>'archived')::boolean) RETURNING * INTO p;
   RETURN to_jsonb(p);
 ELSIF action IN ('person_edit','person_delete') THEN
   SELECT * INTO p FROM public.people WHERE id=target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
   IF p.revision <> expected THEN
     RAISE EXCEPTION 'Conflict' USING ERRCODE='40001'; END IF;
   IF action = 'person_delete' THEN
     DELETE FROM public.people WHERE id=target; RETURN '{}'::jsonb;
   END IF;
   UPDATE public.people SET name=payload->>'name', priority=payload->>'priority',
     cadence_count=(payload->>'cadence_count')::int, cadence_unit=payload->>'cadence_unit',
     archived=(payload->>'archived')::boolean, revision=revision+1
   WHERE id=target RETURNING * INTO p;
   RETURN to_jsonb(p);
 ELSIF action = 'meetup_create' THEN
   -- Serialize retries per account/key, including concurrent requests for different parents.
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      auth.uid()::text || (payload->>'request_id'),0));
   SELECT * INTO previous FROM public.meetup_requests
    WHERE owner_id=auth.uid() AND request_id=(payload->>'request_id')::uuid;
   IF FOUND THEN
     IF previous.person_id <> target OR previous.payload <> md5(payload::text) 
        OR previous.result ? 'changed' THEN
       RAISE EXCEPTION 'Request reused' USING ERRCODE='40001'; END IF;
     RETURN previous.result;
   END IF;
   PERFORM 1 FROM public.people WHERE id=target FOR KEY SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
   INSERT INTO public.meetups(person_id,completed_on,note)
    VALUES(target,(payload->>'completed_on')::date,coalesce(payload->>'note',''))
    RETURNING * INTO m;
   result := to_jsonb(m);
   INSERT INTO public.meetup_requests(request_id,person_id,payload,result)
    VALUES((payload->>'request_id')::uuid,target,md5(payload::text),result);
   RETURN result;
 ELSIF action IN ('meetup_edit','meetup_delete') THEN
   SELECT * INTO m FROM public.meetups WHERE id=target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unavailable' USING ERRCODE='P0002'; END IF;
   IF m.revision <> expected THEN
     RAISE EXCEPTION 'Conflict' USING ERRCODE='40001'; END IF;
   IF action = 'meetup_delete' THEN
     DELETE FROM public.meetups WHERE id=target; RETURN '{}'::jsonb;
   END IF;
   UPDATE public.meetups SET completed_on=(payload->>'completed_on')::date,
    note=coalesce(payload->>'note',''), revision=revision+1
    WHERE id=target RETURNING * INTO m;
   RETURN to_jsonb(m);
 END IF;
 RAISE EXCEPTION 'Unknown operation' USING ERRCODE='23514';
END $$;
CREATE FUNCTION ilp_private.clear_meetup_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 -- Auth account deletion already cascades receipts; do not access them as Auth's role.
 IF auth.uid() = OLD.owner_id THEN
   UPDATE public.meetup_requests SET result = jsonb_build_object('changed',true)
    WHERE owner_id = OLD.owner_id AND result->>'id' = OLD.id::text;
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION ilp_private.clear_meetup_receipt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ilp_private.clear_meetup_receipt() TO authenticated;
CREATE TRIGGER clear_meetup_receipt AFTER UPDATE OR DELETE ON public.meetups
 FOR EACH ROW EXECUTE FUNCTION ilp_private.clear_meetup_receipt();
REVOKE ALL ON FUNCTION public.journal_write(text,uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.journal_write(text,uuid,integer,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
    """)


def downgrade() -> None:
    op.execute("DROP FUNCTION public.journal_write(text,uuid,integer,jsonb)")
    op.execute("DROP TABLE public.meetup_requests, public.meetups, public.people")
    op.execute("DROP FUNCTION ilp_private.journal_guard()")
    op.execute("DROP FUNCTION IF EXISTS ilp_private.clear_meetup_receipt()")
