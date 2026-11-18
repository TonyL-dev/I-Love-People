import { Users } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Users size={32} aria-hidden="true" />
      <h2>{title}</h2>
      <p className="secondary">{children}</p>
      {action}
    </div>
  );
}
