import { useId } from 'react';
import { useForm } from 'react-hook-form';

type Preferences = { displayName: string };

export function PreferencesForm({
  initialValues,
  save,
}: {
  initialValues: Preferences;
  save: (values: Preferences) => Promise<Preferences>;
}) {
  const nameId = useId();
  const errorId = `${nameId}-error`;
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm({ defaultValues: initialValues });

  const submit = handleSubmit(async (values) => {
    try {
      const saved = await save({ displayName: values.displayName.trim() });
      reset(saved);
    } catch {
      setError('root', { message: 'Preferences could not be saved. Try again.' });
    }
  });

  return (
    <form className="playbook-form" onSubmit={(event) => void submit(event)}>
      <label htmlFor={nameId}>Display name</label>
      <input
        {...register('displayName', {
          validate: (name) => Boolean(name.trim()) || 'Enter a display name.',
        })}
        id={nameId}
        readOnly={isSubmitting}
        aria-invalid={Boolean(errors.displayName)}
        aria-describedby={errors.displayName ? errorId : undefined}
      />
      {errors.displayName && (
        <p id={errorId} role="alert">
          {errors.displayName.message}
        </p>
      )}
      {errors.root && <p role="alert">{errors.root.message}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : 'Save preferences'}
      </button>
      <p role="status">{isSubmitSuccessful && !isSubmitting ? 'Preferences saved.' : ''}</p>
    </form>
  );
}
