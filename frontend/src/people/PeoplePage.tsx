import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ArrowLeft, Check } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccountError, sessionStore, type Session } from '../auth/client';
import { meetupKey, peopleKey } from '../api/accountCache';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { journal, failureMessage, type Person, type PersonInput, type Meetup } from './client';
import { MeetupHistory } from './MeetupHistory';
import { DueList, NudgeControls } from './NudgeViews';
import { today, useAccountDay } from './accountDay';

const levels = [
  ['closest', 'Closest - make time regularly', 2, 'weeks'],
  ['close', 'Close - see fairly often', 1, 'months'],
  ['occasional', 'Comme ci, comme \u00e7a - see occasionally', 3, 'months'],
  ['distant', 'Distant - catch up once in a while', 6, 'months'],
] as const;

type PersonDraft = {
  name: string;
  priority: NonNullable<PersonInput['priority']> | '';
  cadence_unit: NonNullable<PersonInput['cadence_unit']> | '';
  cadence_count: number;
  next_scheduled_on: string;
};

function PersonEditor({
  person,
  people,
  session,
  done,
  close,
  reloadConflict,
}: {
  person: Person | null;
  people: Person[];
  session: Session;
  done: (saved: Person) => void;
  close: () => void;
  reloadConflict: (error: unknown) => void;
}) {
  const {
    register,
    control,
    setValue,
    setError,
    clearErrors,
    setFocus,
    handleSubmit,
    formState: { errors, isSubmitting: busy },
  } = useForm<PersonDraft>({
    defaultValues: {
      name: person?.name ?? '',
      priority: person?.priority ?? '',
      cadence_unit: person?.cadence_unit ?? '',
      cadence_count: person?.cadence_count ?? 1,
      next_scheduled_on: person?.next_scheduled_on ?? '',
    },
  });
  const priority = useWatch({ control, name: 'priority' });
  const cadenceUnit = useWatch({ control, name: 'cadence_unit' });
  const scheduled = useWatch({ control, name: 'next_scheduled_on' });
  const suggestion = levels.find((level) => level[0] === priority);
  const nameError = errors.name?.message;

  const submit = handleSubmit(async (draft) => {
    const name = draft.name.trim();
    if (!name) {
      setError('name', { message: 'Enter a name.' }, { shouldFocus: true });
      return;
    }
    const duplicate = people.find((entry) => entry.id !== person?.id && entry.name.trim() === name);
    if (duplicate) {
      setError(
        'name',
        {
          message: duplicate.archived
            ? 'An archived person already has this name. Choose a different name.'
            : 'A person already has this name. Choose a different name.',
        },
        { shouldFocus: true },
      );
      return;
    }
    const payload: PersonInput = {
      name,
      priority: draft.priority || null,
      cadence_unit: draft.cadence_unit || null,
      cadence_count: draft.cadence_unit ? draft.cadence_count : null,
      next_scheduled_on: draft.next_scheduled_on || null,
      archived: person?.archived ?? false,
    };
    try {
      const saved = await journal<Person>(
        session,
        person ? `people/${person.id}` : 'people',
        person ? 'PUT' : 'POST',
        { ...payload, ...(person ? { revision: person.revision } : {}) },
      );
      done(saved);
    } catch (failure) {
      reloadConflict(failure);
      setError('root.save', { message: failureMessage(failure) });
    }
  });

  return (
    <Dialog
      open
      title={person ? 'Edit person' : 'Add person'}
      onRequestClose={() => {
        if (!busy && (!person || window.confirm('Discard this person form?'))) close();
      }}
    >
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <label>
          Name
          <input
            required
            maxLength={120}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'person-name-error' : undefined}
            {...register('name', { onChange: () => clearErrors('name') })}
          />
        </label>
        {nameError && (
          <p id="person-name-error" role="alert" className="error-text">
            {nameError}
          </p>
        )}
        <label htmlFor="person-priority">
          Private priority
          <select id="person-priority" {...register('priority')}>
            <option value="">No priority</option>
            {levels.map((l) => (
              <option key={l[0]} value={l[0]}>
                {l[1]}
              </option>
            ))}
          </select>
        </label>
        {suggestion && (
          <Button
            onClick={() => {
              setValue('cadence_count', suggestion[2]);
              setValue('cadence_unit', suggestion[3]);
            }}
          >
            Use suggested cadence: every {suggestion[2]} {suggestion[3]}
          </Button>
        )}
        <p className="supporting secondary">
          Priority is private. Cadence changes only when you choose it. Nudges appear in this
          website.
        </p>
        <label htmlFor="person-cadence">
          Cadence
          <select
            id="person-cadence"
            aria-label="Cadence"
            {...register('cadence_unit', {
              onChange: (event) => {
                if (!event.target.value) setValue('cadence_count', 1);
              },
            })}
          >
            <option value="">No cadence</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </label>
        {cadenceUnit && (
          <label>
            Every
            <input
              type="number"
              required
              min={1}
              max={365}
              {...register('cadence_count', { valueAsNumber: true })}
            />
          </label>
        )}
        <label>
          Next scheduled meetup (optional)
          <input
            type="date"
            max="9999-12-31"
            aria-describedby="scheduled-meetup-help"
            {...register('next_scheduled_on')}
          />
        </label>
        <p id="scheduled-meetup-help" className="supporting secondary">
          Catch-up reminders pause through this date. Clear the date to resume your cadence sooner.
        </p>
        {scheduled && (
          <Button
            className="self-start"
            onClick={() => {
              setValue('next_scheduled_on', '');
              setFocus('next_scheduled_on');
            }}
          >
            Clear scheduled meetup
          </Button>
        )}
        {errors.root?.save?.message && (
          <p role="alert" className="error-text">
            {errors.root.save.message}
          </p>
        )}
        <Button type="submit" variant="primary" busy={busy}>
          Save person
        </Button>
      </form>
    </Dialog>
  );
}

function MeetupEditor({
  person,
  meetup,
  timezone,
  session,
  done,
  close,
  reloadConflict,
}: {
  person: Person;
  meetup: Meetup | null;
  timezone: string;
  session: Session;
  done: (message: string) => void;
  close: () => void;
  reloadConflict: (error: unknown) => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting: busy },
  } = useForm({
    defaultValues: {
      completed_on: meetup?.completed_on ?? today(timezone),
      note: meetup?.note ?? '',
    },
  });
  const [requestId] = useState(() => crypto.randomUUID());
  // A retry retains the exact payload/key after an ambiguous transport failure.
  const [submitted, setSubmitted] = useState<{ completed_on: string; note: string } | null>(null);
  const error = errors.root?.save?.message;
  const submit = handleSubmit(async (draft) => {
    const payload = submitted ?? draft;
    setSubmitted(payload);
    try {
      await journal(
        session,
        meetup ? `meetups/${meetup.id}` : `people/${person.id}/meetups`,
        meetup ? 'PUT' : 'POST',
        { ...payload, ...(meetup ? { revision: meetup.revision } : { request_id: requestId }) },
      );
      done(meetup ? 'Meetup updated.' : 'Meetup logged.');
    } catch (failure) {
      reloadConflict(failure);
      setError('root.save', { message: failureMessage(failure) });
    }
  });
  return (
    <Dialog
      open
      title={`${meetup ? 'Edit' : 'Log'} meetup with ${person.name}`}
      onRequestClose={() => {
        if (!busy && (!isDirty || window.confirm('Discard this meetup form?'))) close();
      }}
    >
      <form className="stack" onSubmit={(event) => void submit(event)}>
        <label>
          Meetup date
          <input
            type="date"
            required
            max={today(timezone)}
            {...register('completed_on')}
            disabled={submitted !== null}
          />
        </label>
        <label>
          Note (optional)
          <textarea maxLength={2000} {...register('note')} disabled={submitted !== null} />
        </label>
        <p className="supporting secondary">Dates use your saved timezone: {timezone}.</p>
        {error && (
          <p role="alert" className="error-text">
            {error} Retry sends the same entry.
          </p>
        )}
        <Button type="submit" variant="primary" busy={busy}>
          {submitted && error ? 'Retry save' : 'Save meetup'}
        </Button>
      </form>
    </Dialog>
  );
}

export function PeoplePage({
  session,
  timezone,
  notify,
}: {
  session: Session;
  timezone: string;
  notify: (message: string) => void;
}) {
  const cache = useQueryClient();
  const date = useAccountDay(timezone);
  const libraryKey = [...peopleKey, timezone, date];
  const peopleQuery = useQuery({
    queryKey: libraryKey,
    queryFn: ({ signal }) => journal<Person[]>(session, 'people', 'GET', undefined, signal),
  });
  const people = peopleQuery.data;
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState<'catchup' | 'people' | 'review'>('catchup');
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<'person' | 'meetup' | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingMeetup, setEditingMeetup] = useState<Meetup | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    path: string;
    method: 'PUT' | 'DELETE';
    body?: unknown;
    success: string;
    personId: string;
    meetupDelete?: boolean;
  } | null>(null);
  const profileHeading = useRef<HTMLHeadingElement>(null);
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const profileSection = useRef<HTMLElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people?.find((p) => p.id === selected);
  const historyQuery = useQuery({
    queryKey: [...meetupKey, selected],
    queryFn: ({ signal }) =>
      journal<Meetup[]>(session, `people/${selected}/meetups`, 'GET', undefined, signal),
    enabled: !!person,
  });
  const history = historyQuery.data;
  const readError = peopleQuery.error ?? historyQuery.error;
  const viewTitle = { catchup: 'Catch up', people: 'People', review: 'Weekly review' }[view];
  useEffect(() => {
    const nav = navigation.current;
    if (!nav) return;
    const observer = new ResizeObserver(() => {
      nav.parentElement?.style.setProperty('--library-nav-height', `${nav.offsetHeight}px`);
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selected && profileHeading.current) {
      profileHeading.current.focus({ preventScroll: true });
      profileSection.current?.scrollIntoView({ block: 'start' });
    }
  }, [selected]);
  function openPerson(id: string, trigger?: HTMLButtonElement) {
    opener.current = trigger ?? null;
    setSelected(id);
  }
  function backToList() {
    setSelected(null);
    requestAnimationFrame(() => {
      const target =
        (opener.current?.id && document.getElementById(opener.current.id)) || pageHeading.current;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
  }
  function closeEditor() {
    setEditor(null);
    requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        (historyHeading.current ?? profileHeading.current)?.focus();
      }
    });
  }
  function refreshPeople() {
    void cache.invalidateQueries({ queryKey: peopleKey });
  }
  function refreshHistory(personId: string) {
    void cache.invalidateQueries({ queryKey: [...meetupKey, personId] });
  }
  function reloadConflict(failure: unknown, personId?: string) {
    if (failure instanceof AccountError && failure.status === 409) {
      refreshPeople();
      if (personId) refreshHistory(personId);
    }
  }
  function done(message: string) {
    if (sessionStore.getSnapshot().session !== session) return false;
    closeEditor();
    setConfirmation(null);
    notify(message);
    return true;
  }
  return (
    <section className="people-page stack stack--large" aria-label="People and meetup history">
      <div className="page-heading">
        <h2 ref={pageHeading} tabIndex={-1}>
          {viewTitle}
        </h2>
        <p className="secondary">A little space to remember time together.</p>
        <p className="supporting secondary">
          Today: {date} · {timezone}
        </p>
      </div>
      <nav ref={navigation} className="library-navigation actions" aria-label="Your library">
        {(['catchup', 'people', 'review'] as const).map((value) => (
          <Button
            key={value}
            variant={view === value ? 'primary' : 'secondary'}
            aria-current={view === value ? 'page' : undefined}
            aria-pressed={view === value}
            onClick={() => {
              setView(value);
              setSelected(null);
            }}
          >
            {view === value && <Check aria-hidden="true" size={18} />}
            {{ catchup: 'Catch up', people: 'People', review: 'Weekly review' }[value]}
          </Button>
        ))}
      </nav>
      <div className="actions">
        <Button
          variant="primary"
          disabled={!people}
          onClick={() => {
            setView('people');
            setSelected(null);
            setEditingPerson(null);
            setEditor('person');
          }}
        >
          Add person
        </Button>
        <Button onClick={() => void peopleQuery.refetch()}>Refresh people</Button>
      </div>
      {view === 'people' && !person && (
        <>
          <label>
            Search people
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </>
      )}
      {view === 'people' && !person && (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) => setArchived(e.target.checked)}
          />{' '}
          Show archived people
        </label>
      )}
      {readError && (
        <p role="alert" className="error-text">
          {failureMessage(readError)}
        </p>
      )}
      {people && !people.length && (
        <p>No people yet. Add someone, then log a meetup whenever you like.</p>
      )}
      {view === 'people' &&
        !person &&
        people &&
        people.length > 0 &&
        !people.some(
          (p) =>
            p.archived === archived &&
            p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ) && <p>No matching people.</p>}
      {view !== 'people' && people && !person && (
        <DueList
          people={people}
          review={view === 'review'}
          open={openPerson}
          log={(id, trigger) => {
            openPerson(id, trigger);
            setEditingMeetup(null);
            setEditor('meetup');
          }}
        />
      )}
      {view === 'people' && !person && (
        <div className="stack">
          {people
            ?.filter(
              (p) =>
                p.archived === archived &&
                p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
            )
            .map((p) => (
              <div className="surface stack" key={p.id}>
                <Button
                  id={`library-person-${p.id}`}
                  variant="quiet"
                  onClick={(event) => openPerson(p.id, event.currentTarget)}
                >
                  {p.name}
                </Button>
                <p className="secondary">
                  {p.last_seen ? `Last meetup: ${p.last_seen}` : 'No meetup logged'}
                </p>
              </div>
            ))}
        </div>
      )}
      {person && (
        <section
          ref={profileSection}
          className="person-detail surface stack"
          aria-label={`Profile for ${person.name}`}
        >
          <MeetupHistory
            key={person.id}
            history={history}
            name={person.name}
            fullHeading={historyHeading}
            onRefresh={() => void historyQuery.refetch()}
            onEdit={(meetup) => {
              setEditingMeetup(meetup);
              setEditor('meetup');
            }}
            onDelete={(meetup) =>
              setConfirmation({
                title: `Delete meetup with ${person.name} on ${meetup.completed_on}?`,
                path: `meetups/${meetup.id}?revision=${meetup.revision}`,
                method: 'DELETE',
                success: 'Meetup deleted.',
                personId: person.id,
                meetupDelete: true,
              })
            }
          >
            <Button className="self-start" onClick={backToList}>
              <ArrowLeft aria-hidden="true" size={18} /> Back to {viewTitle}
            </Button>
            <h2 ref={profileHeading} tabIndex={-1}>
              {person.name}
            </h2>
            {person.archived && <p className="secondary">Archived</p>}
            <div className="actions" aria-label="Person actions" role="group">
              <Button
                variant="primary"
                onClick={() => {
                  setEditingMeetup(null);
                  setEditor('meetup');
                }}
              >
                Log meetup
              </Button>
              <Button
                onClick={() => {
                  setEditingPerson(person);
                  setEditor('person');
                }}
              >
                Edit person
              </Button>
              <Button
                onClick={() =>
                  setConfirmation({
                    title: `${person.archived ? 'Restore' : 'Archive'} ${person.name}? History will be retained.`,
                    path: `people/${person.id}`,
                    method: 'PUT',
                    success: person.archived ? 'Person restored.' : 'Person archived.',
                    personId: person.id,
                    body: {
                      name: person.name,
                      priority: person.priority ?? null,
                      cadence_count: person.cadence_count ?? null,
                      cadence_unit: person.cadence_unit ?? null,
                      archived: !person.archived,
                      revision: person.revision,
                    },
                  })
                }
              >
                {person.archived ? 'Restore person' : 'Archive person'}
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  setConfirmation({
                    title: `Delete ${person.name} and all their meetup history permanently?`,
                    path: `people/${person.id}?revision=${person.revision}`,
                    method: 'DELETE',
                    success: 'Person and meetup history deleted.',
                    personId: person.id,
                  })
                }
              >
                Delete person
              </Button>
            </div>
            <dl className="person-summary">
              <div>
                <dt>Last meetup</dt>
                <dd>{person.last_seen ?? 'None logged'}</dd>
              </div>
              <div>
                <dt>Next scheduled meetup</dt>
                <dd>
                  {person.next_scheduled_on ?? 'None scheduled'}
                  {person.next_scheduled_on && person.next_scheduled_on < date && ' (passed)'}
                </dd>
              </div>
              <div>
                <dt>Private priority</dt>
                <dd>
                  {levels.find((level) => level[0] === person.priority)?.[1].split(' - ')[0] ??
                    'None'}
                </dd>
              </div>
              <div>
                <dt>Cadence</dt>
                <dd>
                  {person.cadence_count
                    ? `Every ${person.cadence_count} ${person.cadence_unit}`
                    : 'None'}
                </dd>
              </div>
            </dl>
            <NudgeControls
              key={person.id}
              person={person}
              session={session}
              notify={notify}
              refresh={(updated) => {
                if (sessionStore.getSnapshot().session !== session) return;
                cache.setQueryData<Person[]>(libraryKey, (current) =>
                  current?.map((p) => (p.id === updated.id ? updated : p)),
                );
                refreshPeople();
              }}
              reloadConflict={reloadConflict}
            />
          </MeetupHistory>
        </section>
      )}
      {editor === 'person' && people && (
        <PersonEditor
          person={editingPerson}
          people={people}
          session={session}
          done={(saved) => {
            if (!done(editingPerson ? 'Person saved.' : 'Person added.')) return;
            cache.setQueryData<Person[]>(libraryKey, (current) => {
              if (!current) return current;
              return current.some((entry) => entry.id === saved.id)
                ? current.map((entry) => (entry.id === saved.id ? saved : entry))
                : [...current, saved];
            });
            refreshPeople();
          }}
          close={closeEditor}
          reloadConflict={reloadConflict}
        />
      )}
      {editor === 'meetup' && person && (
        <MeetupEditor
          person={person}
          meetup={editingMeetup}
          timezone={timezone}
          session={session}
          done={(message) => {
            if (!done(message)) return;
            refreshPeople();
            refreshHistory(person.id);
          }}
          close={closeEditor}
          reloadConflict={(failure) => reloadConflict(failure, person.id)}
        />
      )}
      {confirmation && (
        <Dialog
          open
          title={confirmation.title}
          onRequestClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          <div className="stack">
            <p>This change will sync to your other devices.</p>
            <Button onClick={() => setConfirmation(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() => {
                if (busy) return;
                setBusy(true);
                setError('');
                void journal(session, confirmation.path, confirmation.method, confirmation.body)
                  .then(
                    () => {
                      if (!done(confirmation.success)) return;
                      refreshPeople();
                      if (confirmation.meetupDelete) refreshHistory(confirmation.personId);
                      else if (confirmation.method === 'DELETE') {
                        setSelected(null);
                        cache.removeQueries({ queryKey: [...meetupKey, confirmation.personId] });
                      }
                    },
                    (e) => {
                      reloadConflict(
                        e,
                        confirmation.meetupDelete ? confirmation.personId : undefined,
                      );
                      setError(failureMessage(e));
                    },
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Confirm
            </Button>
            {error && <p role="alert">{error}</p>}
          </div>
        </Dialog>
      )}
    </section>
  );
}
