'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { HelpCircle, LogIn, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useLogout } from '@/hooks/useUser';
import { avatarUrlFor } from '@/lib/auth';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const HELP_HREF = 'https://github.com/dev-niloy/smart-collab#smart-project--task-collaboration-system';

export function RailBottom() {
  const router = useRouter();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { user, isLoading } = useUser();
  const logout = useLogout();

  const current = (theme === 'system' ? resolvedTheme : theme) ?? 'dark';
  const nextTheme = current === 'dark' ? 'light' : 'dark';

  const onLogout = async () => {
    await logout.mutateAsync();
    router.push('/login');
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              href={HELP_HREF}
              target="_blank"
              rel="noopener"
              aria-label="Help"
              className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <HelpCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </Link>
          }
        />
        <TooltipContent side="right">Help</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label="Toggle theme"
          onClick={() => setTheme(nextTheme)}
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {current === 'dark' ? (
            <Sun className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          ) : (
            <Moon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          )}
        </TooltipTrigger>
        <TooltipContent side="right">
          {current === 'dark' ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>

      {isLoading ? (
        <div
          aria-label="Loading account"
          aria-busy="true"
          className="mt-1 h-8 w-8 animate-pulse rounded-full bg-secondary"
        />
      ) : user ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Account menu (${user.email})`}
                      className="mt-1 grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-primary text-xs font-semibold text-primary-foreground ring-1 ring-foreground/15 hover:opacity-90"
                    >
                      {avatarUrlFor(user) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarUrlFor(user)!}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</span>
                      )}
                    </button>
                  }
                />
              }
            />
            <TooltipContent side="right">{user.email}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  {user.name && user.name !== user.email ? (
                    <>
                      <span className="text-sm font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium">{user.email}</span>
                  )}
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role?.replace('_', ' ')}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/profile">Profile</Link>} />
            <DropdownMenuItem onClick={onLogout} disabled={logout.isPending}>
              {logout.isPending ? 'Logging out…' : 'Log out'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href="/login"
                aria-label="Sign in"
                className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground ring-1 ring-foreground/10 hover:bg-accent hover:text-foreground"
              >
                <LogIn className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              </Link>
            }
          />
          <TooltipContent side="right">Sign in</TooltipContent>
        </Tooltip>
      )}
    </>
  );
}
