import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Notice } from '../ui/Notice';
import { samplePeople } from './fixtures';
import { PersonList } from './PersonList';
import type { PersonActions, SampleState } from './types';
export function CatchUp({
  sampleState,
  setSampleState,
  setNotice,
  setLogging,
  setOptions,
}: PersonActions & {
  sampleState: SampleState;
  setSampleState: (state: SampleState) => void;
  setNotice: (message: string) => void;
}) {
  function sampleContent() {
    if (sampleState === 'loading')
      return (
        <div role="status" aria-label="Loading your people" className="person-list">
          {[1, 2, 3].map((id) => (
            <div key={id} className="person-row skeleton-row">
              <span className="avatar skeleton" />
              <div className="skeleton-lines">
                <div className="skeleton" />
                <div className="skeleton skeleton--short" />
              </div>
            </div>
          ))}
        </div>
      );
    if (sampleState === 'error' || sampleState === 'offline')
      return (
        <Notice
          variant="error"
          title={sampleState === 'offline' ? 'You’re offline.' : 'We couldn’t load your people.'}
        >
          <p className="supporting secondary">
            {sampleState === 'offline'
              ? 'Reconnect to see private records. Unsaved form text stays only in this tab’s memory.'
              : 'Check your connection and try again.'}
          </p>
          <Button onClick={() => setSampleState('ready')}>Try again</Button>
        </Notice>
      );
    if (sampleState === 'empty')
      return (
        <EmptyState
          title="Start with someone you care about."
          action={
            <Button
              variant="primary"
              onClick={() =>
                setNotice(
                  'Adding people will be available after private account setup. This reference contains only synthetic samples.',
                )
              }
            >
              Add your first person
            </Button>
          }
        >
          A name is enough. You can add dates and reminders whenever you like.
        </EmptyState>
      );
    return (
      <>
        {(
          [
            ['now', 'Time to catch up'],
            ['soon', 'In the next 7 days'],
            ['later', 'A little later'],
            ['unknown', 'No meetup logged'],
          ] as const
        ).map(([group, title]) => {
          const people = samplePeople.filter((person) => person.group === group);
          return (
            <section key={group} className="people-section">
              <div className="section-heading">
                <h2>{title}</h2>
                <span className="supporting secondary">
                  {people.length} {people.length === 1 ? 'person' : 'people'}
                </span>
              </div>
              {<PersonList items={people} setLogging={setLogging} setOptions={setOptions} />}
            </section>
          );
        })}
      </>
    );
  }

  return (
    <>
      <div className="page-heading page-heading--actions">
        <div className="stack stack--small">
          <h1>A little time together.</h1>
          <p className="secondary">Tuesday, November 17 · A gentle place to start.</p>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            setNotice(
              'Person creation comes after private account setup. This foundation uses synthetic samples only.',
            )
          }
        >
          Add person
        </Button>
      </div>
      <p className="supporting secondary introduction">
        No keeping score. Just a reminder to make room.
      </p>
      {sampleContent()}
    </>
  );
}
