import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Session } from '../auth/client';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { journal, failureMessage, type Person, type PersonInput, type Meetup } from './client';
import { DueList, NudgeControls } from './NudgeViews';

const levels = [
  ['closest', 'Closest - make time regularly', 2, 'weeks'],
  ['close', 'Close - see fairly often', 1, 'months'],
  ['occasional', 'Comme ci, comme \u00e7a - see occasionally', 3, 'months'],
  ['distant', 'Distant - catch up once in a while', 6, 'months'],
] as const;
const blank: PersonInput = {
  name: '',
  priority: null,
  cadence_count: null,
  cadence_unit: null,
  archived: false,
};
function today(timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day'].map((k) => parts.find((p) => p.type === k)?.value).join('-');
}

function PersonEditor({
  person,
  people,
  session,
  done,
  close,
}: {
  person: Person | null;
  people: Person[];
  session: Session;
  done: (saved: Person) => void;
  close: () => void;
}) {
  const [draft, setDraft] = useState<PersonInput>(
    person
      ? {
          name: person.name,
          priority: person.priority ?? null,
          cadence_count: person.cadence_count ?? null,
          cadence_unit: person.cadence_unit ?? null,
          archived: person.archived,
        }
      : blank,
  );
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const suggestion = levels.find((l) => l[0] === draft.priority);
  return (
    <Dialog
      open
      title={person ? 'Edit person' : 'Add person'}
      onRequestClose={() => {
        if (!busy && window.confirm('Discard this person form?')) close();
      }}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setError('');
          const name = draft.name.trim();
          const duplicate = people.find(
            (entry) => entry.id !== person?.id && entry.name.trim() === name,
          );
          if (duplicate) {
            setNameError(
              duplicate.archived
                ? 'An archived person already has this name. Choose a different name.'
                : 'A person already has this name. Choose a different name.',
            );
            return;
          }
          setNameError('');
          setBusy(true);
          void journal<Person>(
            session,
            person ? `people/${person.id}` : 'people',
            person ? 'PUT' : 'POST',
            { ...draft, name, ...(person ? { revision: person.revision } : {}) },
          )
            .then(done, (e) => setError(failureMessage(e)))
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Name
          <input
            required
            maxLength={120}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'person-name-error' : undefined}
            value={draft.name}
            onChange={(e) => {
              setDraft({ ...draft, name: e.target.value });
              setNameError('');
            }}
          />
        </label>
        {nameError && (
          <p id="person-name-error" role="alert" className="error-text">
            {nameError}
          </p>
        )}
        <label htmlFor="person-priority">
          Private priority
          <select
            id="person-priority"
            value={draft.priority ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, priority: (e.target.value as PersonInput['priority']) || null })
            }
          >
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
            onClick={() =>
              setDraft({ ...draft, cadence_count: suggestion[2], cadence_unit: suggestion[3] })
            }
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
            value={draft.cadence_unit ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                cadence_unit: (e.target.value as PersonInput['cadence_unit']) || null,
                cadence_count: e.target.value ? (draft.cadence_count ?? 1) : null,
              })
            }
          >
            <option value="">No cadence</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </label>
        {draft.cadence_unit && (
          <label>
            Every
            <input
              type="number"
              required
              min={1}
              max={365}
              value={draft.cadence_count ?? 1}
              onChange={(e) => setDraft({ ...draft, cadence_count: Number(e.target.value) })}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="error-text">
            {error}
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
}: {
  person: Person;
  meetup: Meetup | null;
  timezone: string;
  session: Session;
  done: (message: string) => void;
  close: () => void;
}) {
  const [date, setDate] = useState(meetup?.completed_on ?? today(timezone));
  const [note, setNote] = useState(meetup?.note ?? '');
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // A retry retains the exact payload/key after an ambiguous transport failure.
  const [submitted, setSubmitted] = useState<{ completed_on: string; note: string } | null>(null);
  return (
    <Dialog
      open
      title={`${meetup ? 'Edit' : 'Log'} meetup with ${person.name}`}
      onRequestClose={() => {
        if (!busy && window.confirm('Discard this meetup form?')) close();
      }}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const payload = submitted ?? { completed_on: date, note };
          setSubmitted(payload);
          setBusy(true);
          setError('');
          void journal(
            session,
            meetup ? `meetups/${meetup.id}` : `people/${person.id}/meetups`,
            meetup ? 'PUT' : 'POST',
            { ...payload, ...(meetup ? { revision: meetup.revision } : { request_id: requestId }) },
          )
            .then(
              () => done(meetup ? 'Meetup updated.' : 'Meetup logged.'),
              (e) => setError(failureMessage(e)),
            )
            .finally(() => setBusy(false));
        }}
      >
        <label>
          Meetup date
          <input
            type="date"
            required
            max={today(timezone)}
            value={date}
            disabled={submitted !== null}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Note (optional)
          <textarea
            maxLength={2000}
            value={note}
            disabled={submitted !== null}
            onChange={(e) => setNote(e.target.value)}
          />
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
  const [people, setPeople] = useState<Person[] | null>(null);
  const [history, setHistory] = useState<Meetup[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const [view, setView] = useState<'catchup' | 'people' | 'review'>('catchup');
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<'person' | 'meetup' | null>(null);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editingMeetup, setEditingMeetup] = useState<Meetup | null>(null);
  const [confirmation, setConfirmation] = useState<{
    title: string;
    path: string;
    method: string;
    body?: unknown;
    success: string;
  } | null>(null);
  const profileHeading = useRef<HTMLHeadingElement>(null);
  const profileSection = useRef<HTMLElement>(null);
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people?.find((p) => p.id === selected);
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
    setHistory(null);
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
      if (document.activeElement === document.body) profileHeading.current?.focus();
    });
  }
  useEffect(() => {
    // Refresh across local midnight, returning to the tab, or a timezone change.
    const refresh = () => setAttempt((a) => a + 1);
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [timezone]);
  useEffect(() => {
    const abort = new AbortController();
    void journal<Person[]>(session, 'people', 'GET', undefined, abort.signal).then(
      (value) => {
        if (!abort.signal.aborted) setPeople(value);
      },
      (e) => {
        if (!abort.signal.aborted) setError(failureMessage(e));
      },
    );
    return () => abort.abort();
  }, [session, attempt, timezone]);
  useEffect(() => {
    if (!selected) return;
    const abort = new AbortController();
    void journal<Meetup[]>(
      session,
      `people/${selected}/meetups`,
      'GET',
      undefined,
      abort.signal,
    ).then(
      (value) => {
        if (!abort.signal.aborted) setHistory(value);
      },
      (e) => {
        if (!abort.signal.aborted) setError(failureMessage(e));
      },
    );
    return () => abort.abort();
  }, [session, selected, attempt]);
  function refresh() {
    setError('');
    setAttempt((a) => a + 1);
  }
  function done(message: string) {
    closeEditor();
    setConfirmation(null);
    refresh();
    notify(message);
  }
  return (
    <section className="people-page stack stack--large" aria-label="People and meetup history">
      <div className="page-heading">
        <h2 ref={pageHeading} tabIndex={-1}>
          {viewTitle}
        </h2>
        <p className="secondary">A little space to remember time together.</p>
        <p className="supporting secondary">
          Today: {today(timezone)} · {timezone}
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
        <Button onClick={refresh}>Refresh people</Button>
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
      {error && (
        <p role="alert" className="error-text">
          {error}
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
          <Button className="self-start" onClick={backToList}>
            <ArrowLeft aria-hidden="true" size={18} /> Back to {viewTitle}
          </Button>
          <div className="stack stack--small">
            <p className="eyebrow">Person details</p>
            <h2 ref={profileHeading} tabIndex={-1}>
              {person.name}
            </h2>
          </div>
          <p>
            {person.archived ? 'Archived - ' : ''}
            {levels.find((l) => l[0] === person.priority)?.[1] ?? 'No priority'}
          </p>
          <p>
            {person.cadence_count
              ? `Every ${person.cadence_count} ${person.cadence_unit}`
              : 'No cadence'}
          </p>
          <div className="actions">
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
                })
              }
            >
              Delete person
            </Button>
          </div>
          <NudgeControls
            key={person.id}
            person={person}
            session={session}
            notify={notify}
            refresh={(updated) => {
              setPeople(
                (current) => current?.map((p) => (p.id === updated.id ? updated : p)) ?? null,
              );
              refresh();
            }}
          />
          <h3>Meetup history</h3>
          {!history ? null : !history.length ? (
            <p>No meetup logged. The last-seen date is unknown.</p>
          ) : (
            history.map((m) => (
              <article className="surface stack" key={m.id}>
                <h4>{m.completed_on}</h4>
                {m.note && <p className="meetup-note">{m.note}</p>}
                <div className="actions">
                  <Button
                    onClick={() => {
                      setEditingMeetup(m);
                      setEditor('meetup');
                    }}
                  >
                    Edit meetup on {m.completed_on}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      setConfirmation({
                        title: `Delete meetup with ${person.name} on ${m.completed_on}?`,
                        path: `meetups/${m.id}?revision=${m.revision}`,
                        method: 'DELETE',
                        success: 'Meetup deleted.',
                      })
                    }
                  >
                    Delete meetup on {m.completed_on}
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>
      )}
      {editor === 'person' && people && (
        <PersonEditor
          person={editingPerson}
          people={people}
          session={session}
          done={(saved) => {
            setPeople((current) => {
              if (!current) return current;
              return current.some((entry) => entry.id === saved.id)
                ? current.map((entry) => (entry.id === saved.id ? saved : entry))
                : [...current, saved];
            });
            done(editingPerson ? 'Person saved.' : 'Person added.');
          }}
          close={closeEditor}
        />
      )}
      {editor === 'meetup' && person && (
        <MeetupEditor
          person={person}
          meetup={editingMeetup}
          timezone={timezone}
          session={session}
          done={done}
          close={closeEditor}
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
                void journal(session, confirmation.path, confirmation.method, confirmation.body)
                  .then(
                    () => done(confirmation.success),
                    (e) => setError(failureMessage(e)),
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
