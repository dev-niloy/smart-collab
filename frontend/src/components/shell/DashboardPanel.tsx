'use client';

import Link from 'next/link';
import { CalendarDays, CheckCircle2 } from 'lucide-react';

interface DashboardLink {
  key: string;
  href: string;
  label: string;
  icon: typeof CalendarDays;
}

const LINKS: DashboardLink[] = [
  { key: 'my-tasks', href: '/dashboard#my-open-tasks', label: 'My Open Tasks', icon: CheckCircle2 },
  { key: 'deadlines', href: '/dashboard#upcoming-deadlines', label: "Today's Deadlines", icon: CalendarDays },
];

export function DashboardPanel() {
  return (
    <div data-testid="dashboard-panel" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Dashboard</h2>
      </div>
      <nav aria-label="Dashboard shortcuts" className="flex flex-col gap-1 p-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.key}
              href={link.href}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-accent"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
