import { useId, useRef, useState } from 'react';

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
  const id = useId();
  const listId = `${id}-options`;
  const [search, setSearch] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const activeOption = useRef<HTMLLIElement>(null);
  const open = search !== null && !disabled;
  const query = search?.trim().toLowerCase() ?? '';
  const selected = { id: value, label: timezoneLabel(value) };
  const options = zones.some((zone) => zone.id === value) ? zones : [selected, ...zones];
  const matches = options.filter(
    (zone) => zone.label.toLowerCase().includes(query) || zone.id.toLowerCase().includes(query),
  );
  const active = open ? matches[highlight] : undefined;

  function close() {
    setSearch(null);
    setHighlight(-1);
  }

  function choose(zone: (typeof zones)[number]) {
    onChange(zone.id);
    close();
  }

  return (
    <div className="timezone-picker">
      <label htmlFor={id}>Timezone</label>
      <input
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Search timezones"
        value={open ? search : selected.label}
        disabled={disabled}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={active ? `${listId}-${highlight}` : undefined}
        onFocus={() => setSearch('')}
        onClick={() => {
          if (!open) setSearch('');
        }}
        onBlur={close}
        onChange={(event) => {
          setSearch(event.target.value);
          setHighlight(-1);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) setSearch('');
            if (!matches.length) return;
            const next =
              event.key === 'ArrowDown'
                ? Math.min(highlight + 1, matches.length - 1)
                : highlight < 0
                  ? matches.length - 1
                  : Math.max(highlight - 1, 0);
            setHighlight(next);
            requestAnimationFrame(() => activeOption.current?.scrollIntoView({ block: 'nearest' }));
          } else if (event.key === 'Enter' && open) {
            event.preventDefault();
            const option = active ?? (matches.length === 1 ? matches[0] : undefined);
            if (option) choose(option);
          } else if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
          }
        }}
      />
      <div className="timezone-picker__popup" hidden={!open}>
        <ul id={listId} role="listbox" aria-label="Timezones">
          {open &&
            matches.map((zone, index) => (
              <li
                key={zone.id}
                id={`${listId}-${index}`}
                ref={highlight === index ? activeOption : undefined}
                role="option"
                aria-selected={zone.id === value}
                data-highlighted={highlight === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(zone)}
              >
                {zone.label}
              </li>
            ))}
        </ul>
        {open && matches.length === 0 && <p role="status">No matching timezones.</p>}
      </div>
    </div>
  );
}
