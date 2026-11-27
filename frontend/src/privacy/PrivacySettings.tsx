import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { components } from '../api/schema';
import { AccountError, jsonRequest, sessionStore, type Session } from '../auth/client';
import { Button } from '../ui/Button';

const backupLimit = 4_000_000;
type Backup = components['schemas']['Backup'];
type Preview = components['schemas']['RestorePreview'];
type Review = { file: string; preview: Preview };

function peopleCount(count: number) {
  return `${count} ${count === 1 ? 'person' : 'people'}`;
}

function backupCounts({ people, meetups }: Preview) {
  return `${peopleCount(people)} and ${meetups} ${meetups === 1 ? 'meetup' : 'meetups'}`;
}

function hasDuplicateNames(backup: unknown) {
  if (
    !backup ||
    typeof backup !== 'object' ||
    !('people' in backup) ||
    !Array.isArray(backup.people)
  )
    return false;
  const names = new Set<string>();
  for (const person of backup.people as unknown[]) {
    if (
      !person ||
      typeof person !== 'object' ||
      !('name' in person) ||
      typeof person.name !== 'string'
    )
      continue;
    const name = person.name.trim();
    if (names.has(name)) return true;
    names.add(name);
  }
  return false;
}

export function PrivacySettings({
  session,
  onChanged,
  notify,
}: {
  session: Session;
  onChanged: () => void;
  notify: (message: string) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { register, control, handleSubmit, reset, resetField } = useForm({
    defaultValues: { confirmation: '', password: '' },
  });
  const [confirmation, password] = useWatch({ control, name: ['confirmation', 'password'] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function isCurrent() {
    return sessionStore.getSnapshot().session === session;
  }

  function request(action: string, body?: string) {
    return jsonRequest('/api/privacy/' + action, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body }),
    });
  }

  async function run(action: () => Promise<void>, fallback: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (!isCurrent()) return;
      const code = failure instanceof AccountError ? failure.status : 0;
      if (code === 401) sessionStore.clear('Your session ended. Sign in again.');
      else {
        const messages: Record<number, string> = {
          403: 'Your password could not be verified. Try again.',
          409: 'Your library or timezone changed. Choose the backup again to review it.',
          413: 'The backup exceeds the 4 MB limit.',
          422: 'This backup has an unsupported format, timezone, or record. Choose a valid backup.',
          429: 'Too many attempts. Wait a little before trying again.',
        };
        setError(messages[code] ?? fallback);
        if (code === 409) setReview(null);
      }
    } finally {
      setBusy(false);
    }
  }

  function download() {
    void run(async () => {
      const backup = (await request('backup')) as Backup;
      if (!isCurrent()) return;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(backup)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'i-love-people-backup.json';
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify('Backup ready. Check your downloads.');
    }, 'Your backup could not be downloaded. Try again.');
  }

  function choose(file: File) {
    setReview(null);
    void run(async () => {
      if (file.size > backupLimit) throw new AccountError(413, '');
      const contents = await file.text();
      if (!isCurrent()) return;
      let backup: unknown;
      try {
        backup = JSON.parse(contents);
      } catch {
        throw new AccountError(422, '');
      }
      if (hasDuplicateNames(backup)) {
        setError(
          'This backup contains duplicate person names. Give each person a unique name before restoring.',
        );
        return;
      }
      const preview = (await request('restore/preview', contents)) as Preview;
      if (isCurrent()) setReview({ file: contents, preview });
    }, 'Your backup could not be reviewed. Choose the file again.');
  }

  function restore(review: Review) {
    void run(async () => {
      await request(
        'restore',
        `{"backup":${review.file},"preview_token":${JSON.stringify(review.preview.preview_token)}}`,
      );
      if (!isCurrent()) return;
      setReview(null);
      notify(`Restored ${backupCounts(review.preview)}.`);
      onChanged();
    }, 'Restore could not be confirmed. Check your library before trying again.');
  }

  function cancelDelete() {
    setConfirmDelete(false);
    reset();
  }

  const deleteAll = handleSubmit(async ({ confirmation, password }) => {
    if (confirmation !== 'DELETE' || !password) return;
    const body = JSON.stringify({ confirmation, password });
    resetField('password');
    await run(async () => {
      await request('delete-all', body);
      if (!isCurrent()) return;
      cancelDelete();
      setReview(null);
      notify('All application data deleted.');
      onChanged();
    }, 'Deletion could not be confirmed. Check your library before trying again.');
  });

  return (
    <section className="surface stack" aria-labelledby="privacy-heading">
      <h2 id="privacy-heading">Backups and data</h2>
      <p className="supporting secondary">
        A backup includes people, meetup notes, timezone, and in-app reminder settings. Keep the
        file somewhere private.
      </p>
      <Button className="self-start" disabled={busy} onClick={download}>
        Download backup
      </Button>
      <label htmlFor="backup-file">
        Choose a backup to restore
        <input
          id="backup-file"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          aria-describedby="backup-help"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) choose(file);
          }}
        />
      </label>
      <p id="backup-help" className="supporting secondary">
        Restore adds records to an empty library and applies the backup timezone. Turn on push
        notifications again on each device if you want them.
      </p>
      {review && (
        <div className="stack stack--small">
          <h3>Review backup</h3>
          <p role="status">
            {backupCounts(review.preview)}. Backup timezone{' '}
            <strong>{review.preview.timezone}</strong>.
            {review.preview.timezone !== review.preview.current_timezone &&
              ` Your current timezone is ${review.preview.current_timezone}.`}
          </p>
          {review.preview.current_people > 0 && (
            <p>
              Your library already has {peopleCount(review.preview.current_people)}. Restore
              requires an empty library. Cancel to keep your current data.
            </p>
          )}
          <div className="actions">
            <Button disabled={busy} onClick={() => setReview(null)}>
              Cancel restore
            </Button>
            {review.preview.current_people === 0 && (
              <Button variant="primary" busy={busy} onClick={() => restore(review)}>
                Restore backup
              </Button>
            )}
          </div>
        </div>
      )}
      {confirmDelete ? (
        <form
          className="stack"
          onSubmit={(event) => void deleteAll(event)}
          aria-labelledby="delete-data-heading"
        >
          <h3 id="delete-data-heading">Delete all application data</h3>
          <p>
            This permanently removes all people, meetup history, your saved timezone, and
            notification registrations. You can still sign in to your account.
          </p>
          <label htmlFor="delete-password">
            Current password
            <input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              {...register('password')}
            />
          </label>
          <label htmlFor="delete-confirmation">
            Type DELETE to confirm
            <input
              id="delete-confirmation"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              {...register('confirmation')}
            />
          </label>
          <div className="actions">
            <Button disabled={busy} onClick={cancelDelete}>
              Cancel deletion
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={confirmation !== 'DELETE' || !password}
              busy={busy}
            >
              Permanently delete data
            </Button>
          </div>
        </form>
      ) : (
        <Button
          className="self-start"
          variant="danger"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete all data
        </Button>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}
