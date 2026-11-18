import { Link } from '../navigation';
import { samplePeople } from './fixtures';
export function Review() {
  return (
    <div className="stack stack--large">
      <div className="page-heading">
        <h1>A moment to reconnect.</h1>
        <p className="secondary">Your weekly review · November 16–22, 2026</p>
      </div>
      <section className="surface stack">
        <h2>Who would you like to make time for?</h2>
        <p className="secondary">
          These sample dates come from meetup history and the chosen pace.
        </p>
      </section>
      {samplePeople
        .filter((p) => p.group === 'now' || p.group === 'soon')
        .map((p) => (
          <section key={p.id} className="surface stack">
            <h2>{p.name}</h2>
            <p>
              Last met {p.lastMet}. {p.cadence} is the chosen pace.
            </p>
            <p className="supporting action-text">{p.dueLabel}</p>
            <Link className="text-link" href={`/design/people/${p.id}`}>
              View person
            </Link>
          </section>
        ))}
    </div>
  );
}
