import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  className?: string;
  initialFocus?: 'input' | 'close';
  id?: string;
  closeOnBackdrop?: boolean;
}

export function Dialog({
  open,
  title,
  onRequestClose,
  children,
  className = '',
  initialFocus = 'input',
  id,
  closeOnBackdrop = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement;
    dialog.showModal();
    if (initialFocus === 'input') dialog.querySelector<HTMLInputElement>('input')?.focus();
    else dialog.querySelector<HTMLButtonElement>('button')?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open, initialFocus]);

  return (
    <dialog
      ref={ref}
      id={id}
      aria-labelledby={titleId}
      className={`dialog ${className}`}
      onClick={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onRequestClose();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
    >
      <div className="dialog__heading">
        <h2 id={titleId}>{title}</h2>
        <Button variant="quiet" onClick={onRequestClose}>
          Close
        </Button>
      </div>
      {children}
    </dialog>
  );
}
