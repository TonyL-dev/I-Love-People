import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from 'react';

const navigationEvent = 'ilp:navigate';

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(navigationEvent, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(navigationEvent, callback);
  };
}

export function usePath() {
  return useSyncExternalStore(subscribe, () => window.location.pathname);
}

export function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      !href ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target ||
      !href.startsWith('/')
    )
      return;
    event.preventDefault();
    window.history.pushState(null, '', href);
    window.dispatchEvent(new Event(navigationEvent));
  }
  return <a {...props} href={href} onClick={navigate} />;
}
