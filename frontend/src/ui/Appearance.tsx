export type Appearance = 'system' | 'light' | 'dark';

export function AppearanceField({
  value,
  onChange,
  id,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
  id: string;
}) {
  return (
    <label htmlFor={id}>
      Appearance
      <select
        aria-label="Appearance"
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as Appearance)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
