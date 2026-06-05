'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { HelpCircle, Moon, Sun, User as UserIcon } from 'lucide-react';
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

      {!isLoading && user ? (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="mt-1 grid h-8 w-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground hover:opacity-90"
                    />
                  }
                >
                  <UserIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </DropdownMenuTrigger>
              }
            />
            <TooltipContent side="right">Account</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role?.replace('_', ' ')}
                  </span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}
