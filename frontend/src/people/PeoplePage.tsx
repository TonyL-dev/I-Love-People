import { useEffect, useState } from 'react';
import type { Session } from '../auth/client';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { journal, failureMessage, type Person, type PersonInput, type Meetup } from './client';

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
  session,
  done,
  close,
}: {
  person: Person | null;
  session: Session;
  done: () => void;
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
          setBusy(true);
          setError('');
          void journal(
            session,
            person ? `people/${person.id}` : 'people',
            person ? 'PUT' : 'POST',
            { ...draft, ...(person ? { revision: person.revision } : {}) },
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
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
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
          Priority is private. Cadence changes only when you choose it. Reminders are planned for a
          later phase.
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
  done: () => void;
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
            .then(done, (e) => setError(failureMessage(e)))
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

export function PeoplePage({ session, timezone }: { session: Session; timezone: string }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  const [history, setHistory] = useState<Meetup[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
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
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people?.find((p) => p.id === selected);
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
  }, [session, attempt]);
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
  function done() {
    setEditor(null);
    setConfirmation(null);
    refresh();
  }
  return (
    <section className="people-page stack stack--large" aria-label="People and meetup history">
      <div className="page-heading">
        <h2>Your people</h2>
        <p className="secondary">A little space to remember time together.</p>
      </div>
      <div className="actions">
        <Button
          variant="primary"
          onClick={() => {
            setEditingPerson(null);
            setEditor('person');
          }}
        >
          Add person
        </Button>
        <Button onClick={refresh}>Refresh people</Button>
      </div>
      <label>
        Search people
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label className="checkbox-row">
        <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />{' '}
        Show archived people
      </label>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!people && !error && <p>Loading people...</p>}
      {people && !people.length && (
        <p>No people yet. Add someone, then log a meetup whenever you like.</p>
      )}
      {people &&
        people.length > 0 &&
        !people.some(
          (p) =>
            p.archived === archived &&
            p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
        ) && <p>No matching people.</p>}
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
                variant="quiet"
                onClick={() => {
                  setHistory(null);
                  setSelected(p.id);
                }}
              >
                {p.name}
              </Button>
              <p className="secondary">
                {p.last_seen ? `Last meetup: ${p.last_seen}` : 'No meetup logged'}
              </p>
            </div>
          ))}
      </div>
      {person && (
        <section className="surface stack" aria-label={`Profile for ${person.name}`}>
          <h2>{person.name}</h2>
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
                })
              }
            >
              Delete person
            </Button>
          </div>
          <h3>Meetup history</h3>
          {!history ? (
            <p>Loading history...</p>
          ) : !history.length ? (
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
      {editor === 'person' && (
        <PersonEditor
          person={editingPerson}
          session={session}
          done={done}
          close={() => setEditor(null)}
        />
      )}
      {editor === 'meetup' && person && (
        <MeetupEditor
          person={person}
          meetup={editingMeetup}
          timezone={timezone}
          session={session}
          done={done}
          close={() => setEditor(null)}
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
                  .then(done, (e) => setError(failureMessage(e)))
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
