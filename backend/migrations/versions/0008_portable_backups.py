"""Atomic, owner-scoped backup, restore and password-confirmed deletion."""

from alembic import op

revision = "0008_portable_backups"
down_revision = "0007_web_push"
branch_labels = None
depends_on = None

LOCK = "PERFORM ilp_private.backup_lock();"


def update_write_functions(add_lock: bool) -> None:
    before, after = ("BEGIN", f"BEGIN\n {LOCK}") if add_lock else (f"BEGIN\n {LOCK}", "BEGIN")
    for name in ("journal_write", "nudge_write"):
        op.execute(f"""
DO $migration$ BEGIN
 EXECUTE replace(pg_catalog.pg_get_functiondef(
  'public.{name}(text,uuid,integer,jsonb)'::regprocedure), '{before}', '{after}');
END $migration$;
""")


def upgrade() -> None:
    op.execute("""
CREATE FUNCTION ilp_private.backup_lock() RETURNS void
LANGUAGE sql SET search_path = '' AS $$
 SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
   'ilp-backup:' || auth.uid()::text, 0)) WHERE auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION ilp_private.backup_lock() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ilp_private.backup_lock() TO authenticated;

CREATE FUNCTION ilp_private.backup_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NOT NULL THEN
   PERFORM ilp_private.backup_lock();
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION ilp_private.backup_guard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION ilp_private.backup_guard() TO authenticated;

CREATE FUNCTION public.backup_destination() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT ilp_private.session_active() THEN
   RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '42501';
 END IF;
 RETURN jsonb_build_object(
   'timezone', coalesce((SELECT timezone FROM public.profiles WHERE owner_id=auth.uid()), 'UTC'),
   'people', (SELECT count(*) FROM public.people WHERE owner_id=auth.uid()));
END $$;

CREATE FUNCTION public.backup_export() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE destination jsonb; backup jsonb;
BEGIN
 destination := public.backup_destination();
 IF (destination->>'people')::bigint > 20000 OR
    (SELECT count(*) > 20000 OR coalesce(sum(octet_length(note)),0) > 4000000
     FROM public.meetups WHERE owner_id=auth.uid()) THEN
   RAISE EXCEPTION 'Backup too large' USING ERRCODE='PT413';
 END IF;
 SELECT jsonb_build_object('version', 1, 'timezone', destination->'timezone',
   'people', coalesce((
     SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM (
       SELECT id, name, priority, cadence_count, cadence_unit, archived, paused,
         snoozed_until, dismissed_on FROM public.people WHERE owner_id=auth.uid()
     ) p
   ), '[]'::jsonb),
   'meetups', coalesce((
     SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM (
       SELECT id, person_id, completed_on, note
       FROM public.meetups WHERE owner_id=auth.uid()
     ) m
   ), '[]'::jsonb)) INTO backup;
 IF octet_length(backup::text) > 4200000 THEN
   RAISE EXCEPTION 'Backup too large' USING ERRCODE='PT413';
 END IF;
 RETURN backup;
END $$;

CREATE FUNCTION public.backup_restore(backup jsonb, expected_timezone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE destination jsonb; ids jsonb;
BEGIN
 PERFORM ilp_private.backup_lock();
 destination := public.backup_destination();
 IF (destination->>'people')::bigint <> 0
    OR (destination->>'timezone') IS DISTINCT FROM expected_timezone THEN
   RAISE EXCEPTION 'Destination changed' USING ERRCODE='PT409';
 END IF;
 IF backup->'version' IS DISTINCT FROM '1'::jsonb
    OR jsonb_typeof(backup->'people') IS DISTINCT FROM 'array'
    OR jsonb_typeof(backup->'meetups') IS DISTINCT FROM 'array'
    OR octet_length(backup::text) > 4200000 THEN
   RAISE EXCEPTION 'Invalid backup' USING ERRCODE='PT422';
 END IF;
 IF jsonb_array_length(backup->'people') > 20000
    OR jsonb_array_length(backup->'meetups') > 20000 THEN
   RAISE EXCEPTION 'Backup too large' USING ERRCODE='PT413';
 END IF;

 INSERT INTO public.profiles(owner_id,timezone) VALUES(auth.uid(),backup->>'timezone')
 ON CONFLICT(owner_id) DO UPDATE SET timezone=excluded.timezone;

 -- File IDs only link records inside this backup. Generate new database IDs.
 SELECT coalesce(jsonb_object_agg(p.id, gen_random_uuid()), '{}'::jsonb) INTO ids
 FROM jsonb_to_recordset(backup->'people') AS p(id uuid);
 IF (SELECT count(*) FROM jsonb_object_keys(ids)) <> jsonb_array_length(backup->'people')
    OR (SELECT count(DISTINCT m.id) FROM jsonb_to_recordset(backup->'meetups') AS m(id uuid))
        <> jsonb_array_length(backup->'meetups') THEN
   RAISE EXCEPTION 'Duplicate backup record' USING ERRCODE='PT422';
 END IF;
 INSERT INTO public.people(id,name,priority,cadence_count,cadence_unit,archived)
 SELECT (ids->>p.id::text)::uuid, p.name, p.priority, p.cadence_count, p.cadence_unit, p.archived
 FROM jsonb_to_recordset(backup->'people') AS p(
   id uuid, name text, priority text, cadence_count int, cadence_unit text, archived boolean
 );

 INSERT INTO public.meetups(person_id,completed_on,note)
 SELECT (ids->>m.person_id::text)::uuid, m.completed_on, m.note
 FROM jsonb_to_recordset(backup->'meetups') AS m(person_id uuid, completed_on date, note text);

 -- Meetup triggers establish a new cycle on insert. Restore preferences afterward.
 UPDATE public.people p SET paused=b.paused, snoozed_until=b.snoozed_until,
   dismissed_on=b.dismissed_on, revision=p.revision+1
 FROM jsonb_to_recordset(backup->'people') AS b(
   id uuid, paused boolean, snoozed_until date, dismissed_on date
 ) WHERE p.owner_id=auth.uid() AND p.id=(ids->>b.id::text)::uuid;
 RETURN '{}'::jsonb;
END $$;

CREATE TABLE ilp_private.backup_delete_challenges (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 nonce uuid NOT NULL,
 initial_session uuid NOT NULL,
 issued_at timestamptz NOT NULL
);
ALTER TABLE ilp_private.backup_delete_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ilp_private.backup_delete_challenges FORCE ROW LEVEL SECURITY;
REVOKE ALL ON ilp_private.backup_delete_challenges FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION ilp_private.backup_challenge() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := auth.uid(); nonce uuid := gen_random_uuid();
BEGIN
 IF caller IS NULL OR NOT ilp_private.session_active() THEN
   RAISE EXCEPTION 'Account unavailable' USING ERRCODE='42501';
 END IF;
 INSERT INTO ilp_private.backup_delete_challenges AS c VALUES(
   caller, nonce, (auth.jwt()->>'session_id')::uuid, clock_timestamp())
 ON CONFLICT(owner_id) DO UPDATE SET nonce=excluded.nonce,
   initial_session=excluded.initial_session, issued_at=excluded.issued_at;
 RETURN nonce;
END $$;
REVOKE ALL ON FUNCTION ilp_private.backup_challenge() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION ilp_private.backup_challenge() TO authenticated;

CREATE FUNCTION public.backup_begin_delete() RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
 SELECT ilp_private.backup_challenge()
$$;

-- A password session must be created after the challenge. A fresh browser token
-- or a refresh of an existing session cannot authorize this transaction.
CREATE FUNCTION ilp_private.backup_clear_settings(challenge uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE caller uuid := auth.uid(); fresh_session uuid := (auth.jwt()->>'session_id')::uuid;
BEGIN
 IF caller IS NULL OR NOT ilp_private.session_active() OR NOT EXISTS (
   SELECT 1 FROM jsonb_array_elements(auth.jwt()->'amr') AS method
   WHERE method->>'method'='password'
     AND (method->>'timestamp')::bigint BETWEEN
       extract(epoch FROM now())::bigint-60 AND extract(epoch FROM now())::bigint+5
 ) THEN
   RAISE EXCEPTION 'Recent password required' USING ERRCODE='42501';
 END IF;
 DELETE FROM ilp_private.backup_delete_challenges c USING auth.sessions s
 WHERE c.owner_id=caller AND c.nonce=challenge
   AND c.issued_at > now()-interval '60 seconds'
   AND c.initial_session <> fresh_session
   AND s.id=fresh_session AND s.user_id=caller AND s.created_at >= c.issued_at;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'New password session required' USING ERRCODE='42501';
 END IF;
 -- Use the same lock as device enrollment before clearing server-only records.
 PERFORM id FROM auth.users WHERE id=caller FOR NO KEY UPDATE;
 DELETE FROM ilp_private.push_devices WHERE owner_id=caller;
 DELETE FROM public.profiles WHERE owner_id=caller;
END $$;
REVOKE ALL ON FUNCTION ilp_private.backup_clear_settings(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION ilp_private.backup_clear_settings(uuid) TO authenticated;

CREATE FUNCTION public.backup_delete_all(challenge uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 PERFORM ilp_private.backup_lock();
 PERFORM ilp_private.backup_clear_settings(challenge);
 DELETE FROM public.people WHERE owner_id=auth.uid();
 RETURN '{}'::jsonb;
END $$;

REVOKE ALL ON FUNCTION public.backup_destination(), public.backup_export(),
 public.backup_restore(jsonb,text), public.backup_begin_delete(), public.backup_delete_all(uuid)
 FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.backup_destination(), public.backup_export(),
 public.backup_restore(jsonb,text), public.backup_begin_delete(), public.backup_delete_all(uuid)
 TO authenticated;
""")
    for table in ("people", "meetups", "profiles"):
        op.execute(f"""
CREATE TRIGGER backup_guard BEFORE INSERT OR UPDATE OR DELETE ON public.{table}
 FOR EACH STATEMENT EXECUTE FUNCTION ilp_private.backup_guard();
""")
    update_write_functions(add_lock=True)


def downgrade() -> None:
    update_write_functions(add_lock=False)
    for table in ("people", "meetups", "profiles"):
        op.execute(f"DROP TRIGGER backup_guard ON public.{table}")
    op.execute("""
DROP FUNCTION public.backup_delete_all(uuid), ilp_private.backup_clear_settings(uuid),
 public.backup_begin_delete(), ilp_private.backup_challenge(),
 public.backup_restore(jsonb,text), public.backup_export(), public.backup_destination(),
 ilp_private.backup_guard(), ilp_private.backup_lock();
DROP TABLE ilp_private.backup_delete_challenges;
""")
