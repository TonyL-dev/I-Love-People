import type { ReactNode } from 'react';
import { CircleAlert, Info } from 'lucide-react';

interface NoticeProps {
  title: string;
  children?: ReactNode;
  variant?: 'info' | 'error';
}

export function Notice({ title, children, variant = 'info' }: NoticeProps) {
  const Icon = variant === 'error' ? CircleAlert : Info;
  return (
    <div className={`notice notice--${variant}`} role={variant === 'error' ? 'alert' : undefined}>
      <Icon aria-hidden="true" size={20} />
      <div className="stack stack--small">
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
