'use client';

import { useState } from 'react';

export type InboxTab = 'unread' | 'mentions' | 'assigned';

const TABS: { key: InboxTab; label: string }[] = [
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'assigned', label: 'Assigned to me' },
];

export interface InboxPanelProps {
  initialTab?: InboxTab;
  onTabChange?: (tab: InboxTab) => void;
}

export function InboxPanel({ initialTab = 'unread', onTabChange }: InboxPanelProps) {
  const [active, setActive] = useState<InboxTab>(initialTab);

  const select = (tab: InboxTab) => {
    setActive(tab);
    onTabChange?.(tab);
  };

  return (
    <div data-testid="inbox-panel" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Inbox</h2>
      </div>
      <div role="tablist" aria-label="Inbox filter" className="flex flex-col gap-1 p-2">
        {TABS.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => select(t.key)}
              className={
                'flex items-center justify-between rounded-md px-2 py-1.5 text-sm ' +
                (selected
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground')
              }
            >
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
