'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Inbox, LayoutDashboard, FolderKanban, Search } from 'lucide-react';
import { useUnreadCount } from '@/hooks/useNotifications';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface RailProps {
  bottom?: ReactNode;
  onSearchClick?: () => void;
}

interface RailNavItem {
  key: 'dashboard' | 'projects' | 'inbox';
  href: string;
  label: string;
  icon: typeof Inbox;
}

const NAV_ITEMS: RailNavItem[] = [
  { key: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'projects', href: '/projects', label: 'Projects', icon: FolderKanban },
  { key: 'inbox', href: '/inbox', label: 'Inbox', icon: Inbox },
];

const isActive = (pathname: string | null, href: string): boolean => {
  if (!pathname) return false;
  if (pathname === href) return true;
  // prefix match for nested routes (e.g. /projects/123/tasks/456 → projects active)
  return pathname.startsWith(`${href}/`);
};

export function Rail({ bottom, onSearchClick }: RailProps) {
  const pathname = usePathname();
  const unread = useUnreadCount();
  const unreadCount = unread.data?.count ?? 0;

  return (
    <aside
      data-testid="shell-rail"
      aria-label="Primary navigation"
      className="flex h-full w-[52px] shrink-0 flex-col items-center border-r border-border bg-card py-2"
    >
      {/* Workspace logo */}
      <div
        aria-label="Workspace"
        className="mb-2 grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-primary"
      >
        <Image
          src="/logo.jpg"
          alt="Smart Collab"
          width={32}
          height={32}
          className="h-8 w-8 object-cover"
          priority
        />
      </div>

      {/* Top nav */}
      <nav aria-label="Sections" className="flex flex-col items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            type="button"
            aria-label="Search"
            onClick={onSearchClick}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Search className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </TooltipTrigger>
          <TooltipContent side="right">Search</TooltipContent>
        </Tooltip>

        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const showUnreadDot = item.key === 'inbox' && unreadCount > 0;
          const label = showUnreadDot ? `${item.label} (${unreadCount} unread)` : item.label;
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger
                render={
                  <Link
                    href={item.href}
                    aria-label={label}
                    data-active={active ? 'true' : 'false'}
                    data-unread={showUnreadDot ? 'true' : 'false'}
                    className={
                      'relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground ' +
                      (active
                        ? 'bg-accent text-foreground shadow-[inset_2px_0_0_var(--primary)]'
                        : '')
                    }
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    {showUnreadDot ? (
                      <span
                        data-testid="inbox-unread-dot"
                        aria-hidden
                        className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-card"
                      />
                    ) : null}
                  </Link>
                }
              />
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Bottom slot for t4: Help / Theme / Avatar */}
      <div className="mt-auto flex flex-col items-center gap-1">{bottom}</div>
    </aside>
  );
}
