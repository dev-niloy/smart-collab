'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useUser, useLogout } from '@/hooks/useUser';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  project_manager: 'Project Manager',
  team_member: 'Team Member',
};

export function Header() {
  const router = useRouter();
  const { user, isLoading } = useUser();
  const logout = useLogout();

  const onLogout = async () => {
    await logout.mutateAsync();
    router.push('/login');
  };

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Smart Collab
          </Link>
          {!isLoading && user ? (
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link href="/projects" className="text-muted-foreground hover:text-foreground">
                Projects
              </Link>
            </nav>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          {!isLoading && user ? <GlobalSearchBar /> : null}
          {!isLoading && user && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email} · {ROLE_LABEL[user.role] ?? user.role}
            </span>
          )}
          {!isLoading && user ? <NotificationBell /> : null}
          <ThemeToggle />
          {user && (
            <Button variant="outline" size="sm" onClick={onLogout} disabled={logout.isPending}>
              {logout.isPending ? 'Logging out…' : 'Logout'}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
