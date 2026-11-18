import { PersonRow } from './PersonRow';
import type { SamplePerson } from './fixtures';
import type { PersonActions } from './types';
export function PersonList({
  items,
  setLogging,
  setOptions,
}: PersonActions & { items: SamplePerson[] }) {
  return (
    <ul className="person-list">
      {items.map((person) => (
        <PersonRow key={person.id} person={person} onLog={setLogging} onMore={setOptions} />
      ))}
    </ul>
  );
}
