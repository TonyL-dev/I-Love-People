import { useState } from 'react';

function timezoneLabel(id: string) {
  const parts = id.replaceAll('_', ' ').split('/');
  const city = parts.pop();
  return parts.length ? `${city} (${parts.join(' / ')})` : (city ?? id);
}

const zones = [...new Set(['UTC', ...Intl.supportedValuesOf('timeZone')])]
  .map((id) => ({ id, label: timezoneLabel(id) }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

export function TimezoneField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const selected = zones.find((zone) => zone.id === value) ?? {
    id: value,
    label: timezoneLabel(value),
  };
  const matches = zones.filter(
    ({ label, id }) => label.toLowerCase().includes(query) || id.toLowerCase().includes(query),
  );
  const options = matches.some(({ id }) => id === value) ? matches : [selected, ...matches];

  return (
    <div className="stack stack--small">
      <label htmlFor="timezone-search">
        Search timezones
        <input
          id="timezone-search"
          type="search"
          autoComplete="off"
          value={search}
          disabled={disabled}
          aria-controls="account-timezone"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              document.getElementById('account-timezone')?.focus();
            }
          }}
        />
      </label>
      <div className="stack stack--small">
        <label htmlFor="account-timezone">Timezone</label>
        <select
          id="account-timezone"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value);
            setSearch('');
          }}
        >
          {options.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {matches.length === 0 && (
        <p role="status" className="supporting secondary">
          No matching timezones.
        </p>
      )}
    </div>
  );
}
