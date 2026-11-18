import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { samplePeople } from './fixtures';
import { PersonList } from './PersonList';
import type { PersonActions } from './types';
export function People({
  query,
  setQuery,
  setLogging,
  setOptions,
}: PersonActions & { query: string; setQuery: (query: string) => void }) {
  const results = samplePeople.filter((p) =>
    p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <div className="stack">
      <div className="page-heading">
        <h1>Your people.</h1>
        <p className="secondary">A name, a shared memory, a reason to reconnect.</p>
      </div>
      <label htmlFor="people-search">
        Search people
        <input
          id="people-search"
          type="search"
          placeholder="Search by name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p className="supporting secondary" role="status">
        {results.length} {results.length === 1 ? 'person' : 'people'}
      </p>
      {results.length ? (
        <PersonList items={results} setLogging={setLogging} setOptions={setOptions} />
      ) : (
        <EmptyState
          title="No matching people."
          action={<Button onClick={() => setQuery('')}>Clear search</Button>}
        >
          Try a different name or clear the search.
        </EmptyState>
      )}
    </div>
  );
}
