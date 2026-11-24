import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { hasPendingRequests, subscribeToPendingRequests } from '../api/pendingRequests';

export function Loading() {
  const busy = useSyncExternalStore(subscribeToPendingRequests, hasPendingRequests);
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const overlay = dialog.current;
    if (!busy || !overlay) return;
    overlay.showModal();
    return () => overlay.close();
  }, [busy]);

  return (
    <dialog
      ref={dialog}
      className="loading-overlay"
      aria-label="Loading"
      onCancel={(event) => event.preventDefault()}
    >
      <svg
        className="loading-heart"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {/* The same Lucide Heart outline used in the header, with a normalized path length. */}
        <path
          pathLength={100}
          d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
        />
      </svg>
      <span className="visually-hidden" role="status">
        {busy ? 'Please wait.' : ''}
      </span>
    </dialog>
  );
}
