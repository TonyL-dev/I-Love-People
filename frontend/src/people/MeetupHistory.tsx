import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Button } from '../ui/Button';
import type { Meetup } from './client';

const dayLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const monthLabel = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function meetupCount(count: number) {
  return `${count} ${count === 1 ? 'meetup' : 'meetups'}`;
}

type RowActions = {
  onEdit: (meetup: Meetup) => void;
  onDelete: (meetup: Meetup) => void;
};

function MeetupRow({ meetup, onEdit, onDelete }: RowActions & { meetup: Meetup }) {
  const { completed_on: date, note } = meetup;
  return (
    <details className="history-entry">
      <summary>
        <span className="history-entry-label">
          <time dateTime={date}>{dayLabel.format(new Date(`${date}T00:00:00Z`))}</time>
          {note && <span className="history-note-preview supporting secondary">{note}</span>}
        </span>
        <ChevronDown className="disclosure-chevron" aria-hidden="true" size={18} />
      </summary>
      <div className="history-entry-body stack stack--small">
        {note && <p className="meetup-note">{note}</p>}
        <div className="actions">
          <Button aria-label={`Edit meetup on ${date}`} onClick={() => onEdit(meetup)}>
            Edit meetup
          </Button>
          <Button
            aria-label={`Delete meetup on ${date}`}
            variant="danger"
            onClick={() => onDelete(meetup)}
          >
            Delete meetup
          </Button>
        </div>
      </div>
    </details>
  );
}

export function MeetupHistory({
  history,
  name,
  onRefresh,
  onEdit,
  onDelete,
  fullHeading,
  children,
}: RowActions & {
  history: Meetup[] | undefined;
  name: string;
  onRefresh: () => void;
  fullHeading: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  const [full, setFull] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<ReadonlySet<string>>();
  const openHistory = useRef<HTMLButtonElement>(null);
  const recentHeading = useRef<HTMLElement>(null);
  const id = useId();
  const count = history?.length ?? 0;
  const months = new Map<string, Meetup[]>();
  if (full) {
    for (const meetup of history ?? []) {
      const month = meetup.completed_on.slice(0, 7);
      const group = months.get(month);
      if (group) group.push(meetup);
      else months.set(month, [meetup]);
    }
  }
  const newestMonth = months.keys().next().value;

  function toggleMonth(month: string) {
    setExpandedMonths((previous) => {
      const next = new Set(previous ?? (newestMonth ? [newestMonth] : []));
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  function switchView(open: boolean) {
    setFull(open);
    requestAnimationFrame(() => {
      const target = open ? fullHeading.current : (openHistory.current ?? recentHeading.current);
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'center' });
    });
  }

  return (
    <>
      <div hidden={full}>
        <div className="person-overview stack">{children}</div>
        <section className="person-history" aria-label="Recent meetups">
          <details className="recent-meetups">
            <summary ref={recentHeading}>
              <span>Recent meetups</span>
              {history && (
                <span className="history-count supporting secondary">
                  <span aria-hidden="true">{count}</span>
                  <span className="visually-hidden">{meetupCount(count)} total</span>
                </span>
              )}
              <ChevronDown className="disclosure-chevron" aria-hidden="true" size={18} />
            </summary>
            {history?.slice(0, 3).map((meetup) => (
              <MeetupRow key={meetup.id} meetup={meetup} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {count ? (
              <Button ref={openHistory} className="history-action" onClick={() => switchView(true)}>
                View all {meetupCount(count)}
              </Button>
            ) : (
              <>
                {history && (
                  <p className="supporting">No meetup logged. The last-seen date is unknown.</p>
                )}
                <Button className="history-action" onClick={onRefresh}>
                  Refresh history
                </Button>
              </>
            )}
          </details>
        </section>
      </div>
      {full && (
        <section className="full-meetup-history stack" aria-labelledby={`${id}-title`}>
          <Button className="self-start" onClick={() => switchView(false)}>
            <ArrowLeft aria-hidden="true" size={18} /> Back to {name}
          </Button>
          <div className="stack stack--small">
            <h2 id={`${id}-title`} ref={fullHeading} tabIndex={-1}>
              Meetup history
            </h2>
            <p className="supporting secondary">
              {name} · {meetupCount(count)}
            </p>
          </div>
          <div>
            {Array.from(months, ([month, entries]) => {
              const expanded = expandedMonths?.has(month) ?? month === newestMonth;
              const panel = `${id}-${month}`;
              return (
                <div className="history-month" key={month}>
                  <Button
                    className="history-month-toggle"
                    variant="quiet"
                    aria-expanded={expanded}
                    aria-controls={panel}
                    onClick={() => toggleMonth(month)}
                  >
                    <span className="history-month-label">
                      <span>{monthLabel.format(new Date(`${month}-01T00:00:00Z`))}</span>
                      <span className="history-count supporting secondary">
                        {meetupCount(entries.length)}
                      </span>
                    </span>
                    <ChevronDown className="disclosure-chevron" aria-hidden="true" size={18} />
                  </Button>
                  <div id={panel} className="history-month-entries" hidden={!expanded}>
                    {expanded &&
                      entries.map((meetup) => (
                        <MeetupRow
                          key={meetup.id}
                          meetup={meetup}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))}
                  </div>
                </div>
              );
            })}
            {!count && <p>No meetup logged. The last-seen date is unknown.</p>}
          </div>
          <Button className="self-start" onClick={onRefresh}>
            Refresh history
          </Button>
        </section>
      )}
    </>
  );
}
