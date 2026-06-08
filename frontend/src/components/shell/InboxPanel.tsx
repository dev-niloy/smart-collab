'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export type InboxTab = 'unread' | 'mentions' | 'assigned';

const TABS: { key: InboxTab; label: string }[] = [
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'assigned', label: 'Assigned to me' },
];

const VALID: ReadonlySet<InboxTab> = new Set(['unread', 'mentions', 'assigned']);

const readTab = (params: URLSearchParams | null): InboxTab => {
  const raw = params?.get('tab');
  return raw && VALID.has(raw as InboxTab) ? (raw as InboxTab) : 'unread';
};

export interface InboxPanelProps {
  initialTab?: InboxTab;
  onTabChange?: (tab: InboxTab) => void;
}

export function InboxPanel() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = readTab(params);
  const onInbox = pathname === '/inbox' || pathname?.startsWith('/inbox/');

  return (
    <div data-testid="inbox-panel" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Workspace</span>
        <h2 className="text-sm font-semibold">Inbox</h2>
      </div>
      <nav aria-label="Inbox filter" className="flex flex-col gap-1 p-2">
        {TABS.map((t) => {
          const selected = onInbox && t.key === active;
          return (
            <Link
              key={t.key}
              href={`/inbox?tab=${t.key}`}
              data-active={selected ? 'true' : 'false'}
              className={
                'flex items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ' +
                (selected
                  ? 'bg-accent text-foreground shadow-[inset_2px_0_0_var(--primary)]'
                  : 'text-foreground hover:bg-accent')
              }
            >
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
