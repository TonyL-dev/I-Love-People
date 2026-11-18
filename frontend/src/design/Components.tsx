import { useEffect, useState } from 'react';
import { fetchHealth } from '../api/health';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { EmptyState } from '../ui/EmptyState';

export function Components() {
  const [attempt, setAttempt] = useState(0);
  const [health, setHealth] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal).then(
      () => {
        if (!controller.signal.aborted) setHealth('ok');
      },
      () => {
        if (!controller.signal.aborted) setHealth('error');
      },
    );
    return () => controller.abort();
  }, [attempt]);
  return (
    <div className="stack stack--large">
      <div className="page-heading">
        <h1>The little details.</h1>
        <p className="secondary">Shared components, interaction states, and the API connection.</p>
      </div>
      <section className="surface stack">
        <h2>Actions</h2>
        <div className="actions">
          <Button variant="primary">Primary action</Button>
          <Button>Secondary action</Button>
          <Button variant="quiet">Quiet action</Button>
          <Button variant="danger">Destructive action</Button>
          <Button disabled>Unavailable</Button>
          <Button busy>Saving…</Button>
        </div>
        <p className="supporting secondary">
          Use Tab to inspect keyboard focus. Hover and press show subtle feedback.
        </p>
      </section>
      <section className="stack">
        <h2>Feedback</h2>
        <Notice title="A little more time.">
          <p className="supporting secondary">Snoozing keeps the catch-up date visible.</p>
        </Notice>
        <Notice title="We couldn’t save that." variant="error">
          <p className="supporting secondary">
            Your draft is still here. Check your connection and try again.
          </p>
        </Notice>
        <p className="success-text" role="status">
          Meetup saved. A little time, remembered.
        </p>
      </section>
      <section className="surface stack">
        <h2>API connection</h2>
        <p role="status">
          {health === 'loading'
            ? 'Checking the API…'
            : health === 'ok'
              ? 'The API is responding.'
              : 'The API could not be reached.'}
        </p>
        <p className="supporting secondary">
          This checks /api/health. Database readiness is verified separately.
        </p>
        <Button
          className="self-start"
          onClick={() => {
            setHealth('loading');
            setAttempt((n) => n + 1);
          }}
        >
          Check again
        </Button>
      </section>
      <section className="stack">
        <h2>Empty state</h2>
        <EmptyState title="Start with someone you care about.">
          A name is enough. Add dates and reminders whenever you like.
        </EmptyState>
      </section>
      <section className="surface stack">
        <h2>Typography & spacing</h2>
        <p>System typography. Familiar shapes. One action color.</p>
        <p className="supporting secondary">
          32/38 titles · 22/28 sections · 17/26 body · 15/22 supporting
        </p>
        <p className="caption secondary">4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 px spacing</p>
        <div className="swatches" aria-label="Semantic color tokens">
          {['page', 'surface', 'text', 'action', 'danger', 'success'].map((color) => (
            <span key={color}>
              <b className={`swatch-color--${color}`} />
              {color}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
