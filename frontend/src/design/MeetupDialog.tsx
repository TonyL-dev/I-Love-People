import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Notice } from '../ui/Notice';
import type { SamplePerson } from './fixtures';

export function MeetupDialog({
  person,
  onClose,
  onSaved,
}: {
  person: SamplePerson;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [date, setDate] = useState('2026-11-17');
  const [note, setNote] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState('');
  const dirty = date !== '2026-11-17' || note !== '';

  function requestClose() {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!date || date > '2026-11-17') {
      setError('Choose November 17, 2026 or a past date for this sample.');
      return;
    }
    onSaved(person.name);
  }

  return (
    <Dialog open title={`A little time with ${person.name}`} onRequestClose={requestClose}>
      <form className="stack" onSubmit={submit}>
        <p className="secondary">Today is ready. Add a note only if you’d like.</p>
        <label htmlFor="meetup-date">
          Meetup date
          <input
            id="meetup-date"
            name="date"
            type="date"
            required
            max="2026-11-17"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-describedby="sample-date-help"
          />
        </label>
        <p className="supporting secondary" id="sample-date-help">
          Sample date: November 17, 2026. Nothing you enter here is stored.
        </p>
        <label htmlFor="meetup-note">
          A note to remember <span className="optional">Optional</span>
          <textarea
            id="meetup-note"
            name="note"
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Something to ask about next time…"
          />
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {confirmDiscard ? (
          <Notice title="Discard your unsaved changes?">
            <div className="actions">
              <Button onClick={() => setConfirmDiscard(false)}>Keep editing</Button>
              <Button variant="danger" onClick={onClose}>
                Discard changes
              </Button>
            </div>
          </Notice>
        ) : null}
        <div className="actions actions--end">
          <Button onClick={requestClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Try sample save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
