import { Link } from '../navigation';
import { Button } from '../ui/Button';
import type { SamplePerson } from './fixtures';

export function PersonRow({
  person,
  onLog,
  onMore,
}: {
  person: SamplePerson;
  onLog: (person: SamplePerson) => void;
  onMore: (person: SamplePerson) => void;
}) {
  return (
    <li className="person-row">
      <span className="avatar" aria-hidden="true">
        {person.initials}
      </span>
      <div className="person-row__identity">
        <Link className="person-name" href={`/design/people/${person.id}`}>
          {person.name}
        </Link>
        <span className="supporting secondary">
          {person.lastMet ? `Last met ${person.lastMet}` : 'No meetup logged'}
        </span>
        <span className="supporting action-text">{person.dueLabel}</span>
      </div>
      <div className="person-row__actions">
        <Button
          variant="quiet"
          onClick={() => onLog(person)}
          aria-label={`Log meetup with ${person.name}`}
        >
          Log meetup
        </Button>
        <Button
          variant="quiet"
          onClick={() => onMore(person)}
          aria-label={`More actions for ${person.name}`}
        >
          More
        </Button>
      </div>
    </li>
  );
}
