'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCircle2, BellRing, KeyRound } from 'lucide-react';

interface ProfileLink {
  key: 'profile' | 'notifications' | 'password';
  href: string;
  label: string;
  icon: typeof UserCircle2;
}

const LINKS: ProfileLink[] = [
  { key: 'profile', href: '/profile', label: 'Profile', icon: UserCircle2 },
  { key: 'notifications', href: '/profile/notifications', label: 'Notifications', icon: BellRing },
  { key: 'password', href: '/profile/password', label: 'Password', icon: KeyRound },
];

const isActive = (pathname: string | null, href: string): boolean => {
  if (!pathname) return false;
  if (href === '/profile') return pathname === '/profile';
  return pathname === href || pathname.startsWith(`${href}/`);
};

export function ProfilePanel() {
  const pathname = usePathname();

  return (
    <div data-testid="profile-panel" className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Account</span>
        <h2 className="text-sm font-semibold">Profile</h2>
      </div>
      <nav aria-label="Profile sections" className="flex flex-col gap-1 p-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.key}
              href={link.href}
              data-active={active ? 'true' : 'false'}
              className={
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ' +
                (active
                  ? 'bg-accent text-foreground shadow-[inset_2px_0_0_var(--primary)]'
                  : 'text-foreground hover:bg-accent')
              }
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
