import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from './Button';

export function Toast({ message, dismiss }: { message: string; dismiss: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (hovered || focused) return;
    const timer = window.setTimeout(dismiss, 7000);
    return () => window.clearTimeout(timer);
  }, [dismiss, hovered, focused]);

  return (
    <div
      className="toast"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      <p className="toast__message" role="status" aria-live="polite" aria-atomic="true">
        <CheckCircle2 className="success-text" aria-hidden="true" size={24} />
        <span>{message}</span>
      </p>
      <Button variant="quiet" aria-label="Dismiss notification" onClick={dismiss}>
        <X aria-hidden="true" size={20} />
      </Button>
    </div>
  );
}
