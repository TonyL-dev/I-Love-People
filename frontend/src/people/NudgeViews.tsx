import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { AccountError, type Session } from '../auth/client';
import { Button } from '../ui/Button';
import { journal, failureMessage, type Person } from './client';

export function NudgeControls({
  person,
  session,
  refresh,
  reloadConflict,
  notify,
}: {
  person: Person;
  session: Session;
  refresh: (updated: Person) => void;
  reloadConflict: (error: unknown) => void;
  notify: (message: string) => void;
}) {
  const { register, handleSubmit } = useForm({ defaultValues: { until: '' } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function change(action: string, until?: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const updated = await journal<Person>(session, `people/${person.id}/nudge`, 'PUT', {
        action,
        revision: person.revision,
        ...(action === 'snooze' ? { until } : {}),
      });
      refresh(updated);
      notify(
        {
          snooze: `Nudge snoozed until ${until}.`,
          unsnooze: 'Snooze cleared.',
          pause: 'Nudges paused.',
          unpause: 'Nudges unpaused.',
          dismiss: 'Nudge dismissed for today.',
          undismiss: 'Nudge shown again today.',
        }[action] ?? 'Nudge preferences saved.',
      );
    } catch (failure) {
      reloadConflict(failure);
      setError(
        failure instanceof AccountError && failure.status === 422
          ? 'Choose a snooze date after today in your saved account timezone.'
          : failureMessage(failure),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Nudge preferences">
      <details className="nudge-settings">
        <summary>
          <span>Nudge settings</span>
          <ChevronDown className="disclosure-chevron" aria-hidden="true" size={18} />
        </summary>
        <div className="stack stack--small">
          <p>{person.due_on ? `Catch-up date: ${person.due_on}` : 'Catch-up date unknown'}</p>
          {person.suppression && <p role="status">{nudgeStatus(person)}</p>}
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() => void change(person.paused ? 'unpause' : 'pause')}
            >
              {person.paused ? 'Unpause nudges' : 'Pause nudges'}
            </Button>
            <Button
              disabled={busy || !person.due_on}
              onClick={() =>
                void change(person.suppression === 'dismissed' ? 'undismiss' : 'dismiss')
              }
            >
              {person.suppression === 'dismissed' ? 'Show again today' : 'Dismiss for today'}
            </Button>
            {person.snoozed_until && (
              <Button disabled={busy} onClick={() => void change('unsnooze')}>
                Clear snooze
              </Button>
            )}
          </div>
          <form
            className="actions snooze-form"
            onSubmit={(event) => void handleSubmit(({ until }) => change('snooze', until))(event)}
          >
            <label>
              Snooze until
              <input type="date" required {...register('until')} />
            </label>
            <Button type="submit" busy={busy} disabled={!person.due_on}>
              Snooze nudge
            </Button>
          </form>
          <p className="supporting secondary">A new latest meetup clears snooze and dismissal.</p>
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

function nudgeStatus(person: Person) {
  switch (person.suppression) {
    case 'paused':
      return 'Nudges paused';
    case 'scheduled':
      return `Meetup scheduled for ${person.next_scheduled_on}`;
    case 'snoozed':
      return `Snoozed until ${person.snoozed_until}`;
    case 'dismissed':
      return 'Dismissed for today';
    case 'archived':
      return 'Archived';
    default:
      return person.due_on ? `Catch-up date: ${person.due_on}` : person.reason;
  }
}

const groups = [
  ['now', 'Time to catch up'],
  ['soon', 'In the next 7 days'],
  ['later', 'A little later'],
  ['unknown', 'No meetup logged'],
  ['suppressed', 'Taking a pause'],
] as const;

export function DueList({
  people,
  review,
  open,
  log,
}: {
  people: Person[];
  review: boolean;
  open: (id: string, trigger: HTMLButtonElement) => void;
  log: (id: string, trigger: HTMLButtonElement) => void;
}) {
  const visible = people.filter(
    (p) =>
      !p.archived &&
      (review
        ? p.due_on && !p.paused && (p.timing === 'now' || p.timing === 'soon')
        : p.cadence_count || !p.last_seen || p.suppression === 'scheduled'),
  );
  const active = visible.filter(
    (p) => !p.suppression && (p.timing === 'now' || p.timing === 'soon'),
  );
  return (
    <section className="stack stack--large" aria-label={review ? 'Weekly review' : 'Catch up'}>
      <h2>{review ? 'Weekly review' : 'A little time to reconnect.'}</h2>
      {active.length === 0 && <p>All caught up. There is no nudge to act on right now.</p>}
      {groups.map(([key, title]) => {
        const rows = visible.filter((p) =>
          key === 'suppressed' ? p.suppression : !p.suppression && (p.timing ?? 'unknown') === key,
        );
        if (!rows.length) return null;
        return (
          <section className="stack" key={key} aria-label={title}>
            <h3>{title}</h3>
            {rows.map((p) => (
              <article className="surface stack" key={p.id}>
                <h4>{p.name}</h4>
                <p className="secondary">
                  {p.last_seen ? `Last meetup: ${p.last_seen}` : 'No meetup logged'}
                </p>
                <p>{nudgeStatus(p)}</p>
                {review && (
                  <>
                    <p>{p.reason}</p>
                    <p>
                      Private priority:{' '}
                      {p.priority
                        ? {
                            closest: 'Closest',
                            close: 'Close',
                            occasional: 'Comme ci, comme ça',
                            distant: 'Distant',
                          }[p.priority]
                        : 'No priority'}
                    </p>
                  </>
                )}
                <div className="actions">
                  <Button
                    id={`library-log-${p.id}`}
                    onClick={(event) => log(p.id, event.currentTarget)}
                  >
                    Log meetup with {p.name}
                  </Button>
                  <Button
                    id={`library-person-${p.id}`}
                    onClick={(event) => open(p.id, event.currentTarget)}
                  >
                    More about {p.name}
                  </Button>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </section>
  );
}
