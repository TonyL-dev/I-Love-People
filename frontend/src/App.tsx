import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Heart, Users, CalendarDays, Settings, Palette, type LucideIcon } from 'lucide-react';
import { Link, usePath } from './navigation';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';
import { EmptyState } from './ui/EmptyState';
import { Notice } from './ui/Notice';
import { samplePeople, type SamplePerson } from './design/fixtures';
import { MeetupDialog } from './design/MeetupDialog';
import { AccountPage } from './auth/AccountPage';
import { Components } from './design/Components';

import { AppearanceField, type Appearance } from './ui/Appearance';
import type { SampleState } from './design/types';
import { CatchUp } from './design/CatchUp';
import { People } from './design/People';
import { Profile } from './design/Profile';
import { Review } from './design/Review';
import { DesignSettings } from './design/Settings';

function initialAppearance(): Appearance {
  try {
    const value = localStorage.getItem('ilp.appearance');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

const destinations: { path: string; label: string; icon: LucideIcon }[] = [
  { path: '/design', label: 'Catch up', icon: Heart },
  { path: '/design/people', label: 'People', icon: Users },
  { path: '/design/review', label: 'Review', icon: CalendarDays },
  { path: '/design/settings', label: 'Settings', icon: Settings },
  { path: '/design/components', label: 'Components', icon: Palette },
];

function subscribeToConnection(update: () => void) {
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}

export function App({ initialConfirmation }: { initialConfirmation: string | null }) {
  const path = usePath();
  const online = useSyncExternalStore(subscribeToConnection, () => navigator.onLine);
  const isDesign = path === '/design' || path.startsWith('/design/');
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  const [confirmationToken, setConfirmationToken] = useState(initialConfirmation);
  const [sampleState, setSampleState] = useState<SampleState>('ready');
  const [query, setQuery] = useState('');
  const [logging, setLogging] = useState<SamplePerson | null>(null);
  const [options, setOptions] = useState<SamplePerson | null>(null);
  const [notice, setNotice] = useState('');
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  useEffect(() => {
    document.documentElement.dataset.appearance = appearance;
    try {
      localStorage.setItem('ilp.appearance', appearance);
    } catch {
      /* Preferences still work in memory. */
    }
  }, [appearance]);

  useEffect(() => {
    if (previousPath.current !== path) {
      mainRef.current?.focus();
      previousPath.current = path;
    }
    const routeTitle = destinations.find((item) => item.path === path)?.label;
    document.title = `${isDesign ? (routeTitle ?? 'Person') : 'Welcome'} · I Love People`;
  }, [path, isDesign]);

  const selectedPerson = path.startsWith('/design/people/')
    ? samplePeople.find((person) => person.id === path.split('/').at(-1))
    : undefined;

  function renderPage() {
    if (!isDesign)
      return [
        '/',
        '/login',
        '/forgot-password',
        '/reset-password',
        '/create-account',
        '/confirm-email',
      ].includes(path) ? (
        <AccountPage
          path={path}
          appearance={appearance}
          setAppearance={setAppearance}
          confirmationToken={confirmationToken}
          discardConfirmation={() => setConfirmationToken(null)}
        />
      ) : (
        <EmptyState
          title="That page isn’t here."
          action={
            <Link className="button button--primary" href="/">
              Go to sign in
            </Link>
          }
        >
          Check the address or return to sign in.
        </EmptyState>
      );
    if (path === '/design/components') return <Components />;
    if (path === '/design/settings')
      return <DesignSettings appearance={appearance} setAppearance={setAppearance} />;
    if (path === '/design/people')
      return (
        <People query={query} setQuery={setQuery} setLogging={setLogging} setOptions={setOptions} />
      );
    if (path.startsWith('/design/people/'))
      return (
        <Profile selectedPerson={selectedPerson} setLogging={setLogging} setOptions={setOptions} />
      );
    if (path === '/design/review') return <Review />;
    if (path !== '/design')
      return (
        <EmptyState
          title="That sample page isn’t here."
          action={
            <Link className="button button--primary" href="/design">
              Back to Catch up
            </Link>
          }
        >
          Use the navigation to explore the reference.
        </EmptyState>
      );
    return (
      <CatchUp
        sampleState={sampleState}
        setSampleState={setSampleState}
        setNotice={setNotice}
        setLogging={setLogging}
        setOptions={setOptions}
      />
    );
  }

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="brand-header">
        <Link className="brand" href={isDesign ? '/design' : '/'}>
          <Heart aria-hidden="true" size={24} />
          <span>I Love People</span>
        </Link>
        <span className="supporting secondary brand-tagline">Make time for your people.</span>
      </header>
      {isDesign && (
        <aside className="reference-bar" aria-label="Design reference controls">
          <div>
            <Link href="/design/components" className="reference-link">
              Component reference
            </Link>
            <p className="caption secondary">Synthetic people · No personal data or account</p>
          </div>
          <label htmlFor="sample-state">
            Screen state
            <select
              id="sample-state"
              aria-label="Screen state"
              value={sampleState}
              onChange={(event) => setSampleState(event.target.value as SampleState)}
              disabled={path !== '/design'}
            >
              {['ready', 'empty', 'loading', 'error', 'offline'].map((value) => (
                <option key={value} value={value}>
                  {value[0]?.toUpperCase()}
                  {value.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <AppearanceField value={appearance} onChange={setAppearance} id="reference-appearance" />
        </aside>
      )}
      <div className={isDesign ? 'workspace' : 'signed-out-workspace'}>
        {isDesign && (
          <nav className="navigation" aria-label="Main navigation">
            {destinations
              .filter((item) => item.path !== '/design/components')
              .map(({ path: destination, label, icon: Icon }) => (
                <Link
                  key={destination}
                  href={destination}
                  aria-current={
                    path === destination ||
                    (destination === '/design/people' && path.startsWith(destination + '/'))
                      ? 'page'
                      : undefined
                  }
                >
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
          </nav>
        )}
        <main id="main" ref={mainRef} tabIndex={-1} className="main-content">
          {!online && (
            <Notice title="You’re offline.">
              <p role="status">
                Reconnect before saving. Keep this page open to preserve unsaved text.
              </p>
            </Notice>
          )}
          {renderPage()}
          {notice && (
            <div className="feedback" role="status">
              <p>{notice}</p>
              <Button variant="quiet" onClick={() => setNotice('')}>
                Dismiss
              </Button>
            </div>
          )}
        </main>
      </div>
      <footer className="app-footer">
        Private by design. A little space for the people in your life.
      </footer>
      {logging && (
        <MeetupDialog
          person={logging}
          onClose={() => setLogging(null)}
          onSaved={(name) => {
            setLogging(null);
            setNotice(`Sample save complete for ${name}. No record was stored.`);
          }}
        />
      )}
      {options && (
        <Dialog open title={`Options for ${options.name}`} onRequestClose={() => setOptions(null)}>
          <div className="stack">
            <p className="secondary">
              Profile preferences, snooze, pause, archive, and deletion will be connected after
              account ownership is enforced.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                setLogging(options);
                setOptions(null);
              }}
            >
              Try logging a meetup
            </Button>
            <Button onClick={() => setOptions(null)}>Back to person</Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
