# Organize forms

Use React Hook Form for field registration, validation, and submission state. Keep server reads and invalidation in the data layer and keep interaction state such as dropdown search local to the field.

1. Define a TypeScript type for the editable values and initialize defaults from a loaded record. If the record changes identity, give its form a new React key. Decide explicitly how to handle fresh server data while a draft is open.
2. Use `register` for native inputs. Use `Controller` when a reusable controlled field needs a value and change handler. In the timezone picker, the form stores the selected IANA ID and the dropdown owns the temporary search text.
3. Submit with `handleSubmit`. Keep validation and server errors visible near the affected field or action. Preserve edits on failure. On success, update the relevant cache with the server response and reset the form baseline to those saved values.
4. Keep a submit action explicit. Disable controls while saving and announce success without moving focus. The server remains responsible for business validation and authorization.

The [preferences form](examples/preferences-form.tsx) demonstrates native input registration, inline feedback, and an injected save handler. Wire that handler to the destination project’s authorized API and cache updates.

The [timezone field](examples/timezone-field.tsx) is a controlled combobox. Add a `timezone` field to the form defaults, then render the picker through `Controller`.

```tsx
<Controller
  control={control}
  name="timezone"
  render={({ field }) => (
    <TimezoneField value={field.value} onChange={field.onChange} disabled={isSubmitting} />
  )}
/>
```

## Searchable field checklist

- Open with every option visible in a scrollable list. Clearing the query restores the full list.
- Match a case-insensitive substring of the human-readable label and stable ID.
- Keep the selected value when the user closes the list without choosing. Allow pointer and keyboard selection, with Escape to dismiss.
- Verify arrow navigation and Enter selection, empty results, saving after a failed request, and the saved label after revisiting. Check touch and screen reader behavior on the devices you support.
