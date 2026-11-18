import { ArrowLeft } from 'lucide-react';
import { Link } from '../navigation';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import type { SamplePerson } from './fixtures';
import type { PersonActions } from './types';
export function Profile({
  selectedPerson,
  setLogging,
  setOptions,
}: PersonActions & { selectedPerson: SamplePerson | undefined }) {
  if (!selectedPerson)
    return (
      <EmptyState
        title="This sample person isn’t here."
        action={
          <Link className="button button--primary" href="/design/people">
            Back to People
          </Link>
        }
      >
        Choose someone from the sample list.
      </EmptyState>
    );
  return (
    <div className="stack stack--large">
      <Link className="back-link" href="/design/people">
        <ArrowLeft size={18} aria-hidden="true" />
        People
      </Link>
      <div className="profile-heading">
        <span className="avatar avatar--large" aria-hidden="true">
          {selectedPerson.initials}
        </span>
        <div className="stack stack--small">
          <h1>{selectedPerson.name}</h1>
          <span className="pill">{selectedPerson.priority}</span>
        </div>
      </div>
      <p className="action-text">{selectedPerson.dueLabel}</p>
      <div className="actions">
        <Button variant="primary" onClick={() => setLogging(selectedPerson)}>
          Log meetup
        </Button>
        <Button onClick={() => setOptions(selectedPerson)}>More actions</Button>
      </div>
      <dl className="surface facts">
        <div>
          <dt>Last meetup</dt>
          <dd>{selectedPerson.lastMet ?? 'No meetup logged'}</dd>
        </div>
        <div>
          <dt>Your pace</dt>
          <dd>{selectedPerson.cadence}</dd>
        </div>
      </dl>
      <section className="stack">
        <h2>Meetup history</h2>
        {selectedPerson.meetups.length ? (
          <ul className="history">
            {selectedPerson.meetups.map((meetup) => (
              <li key={meetup.id}>
                <h3>{meetup.date}</h3>
                <p className="secondary">{meetup.note || 'No note added.'}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Your shared story starts here.">
            Log the last time you met. Reminders can begin from that date.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
