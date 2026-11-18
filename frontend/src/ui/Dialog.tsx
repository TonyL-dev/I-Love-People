import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, onRequestClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    const opener = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      dialog.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="dialog"
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
