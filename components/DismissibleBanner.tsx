'use client';

import type { ReactNode } from 'react';

export default function DismissibleBanner({ children, onDismiss, className = '', role = 'status', dismissLabel = 'Dismiss notification' }: {
  children: ReactNode;
  onDismiss: () => void;
  className?: string;
  role?: 'status' | 'alert';
  dismissLabel?: string;
}) {
  return (
    <div role={role} className={`flex items-start gap-3 ${className}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onDismiss} aria-label={dismissLabel} title="Dismiss" className="-my-2 -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-current hover:bg-black/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </div>
  );
}
