'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ArrowUpRight, Home, Info, LogIn, Mail, Menu, X, type LucideIcon } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';

type NavLink = { href: string; label: string; icon: LucideIcon };

const NAV_LINKS: NavLink[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/about', label: 'About', icon: Info },
  { href: '/contact', label: 'Contact', icon: Mail },
];

export function MarketingNav() {
  const pathname = usePathname();
  const { user, isLoading } = useUser();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="mx-auto max-w-[1080px] px-6 pt-5">
        {/* Floating pill — spans the content container width */}
        <div className="surface-edge-highlight relative flex w-full items-center justify-between gap-3 rounded-full border border-border/70 bg-background/70 px-2 py-1.5 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 pl-3 pr-2">
            <span
              aria-hidden
              className="size-6 rounded-full"
              style={{
                background:
                  'conic-gradient(from 200deg, #5e6ad2, #828fff, #d2db5e, #ff7a7a, #5e6ad2)',
              }}
            />
            <span className="hidden text-[13.5px] font-semibold tracking-tight md:inline">
              Smart Collab
            </span>
          </Link>

          {/* Center links */}
          <nav className="hidden flex-1 items-center justify-center md:flex">
            {NAV_LINKS.map((l) => {
              const Icon = l.icon;
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13.5px] transition-colors',
                    active
                      ? 'bg-card/60 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" />
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="hidden items-center gap-1.5 pl-2 md:flex">
            {isLoading ? null : user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-[#828fff]"
              >
                Open app
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] text-muted-foreground hover:text-foreground"
                >
                  <LogIn className="size-3.5" />
                  Log In
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary pl-4 pr-3 text-[13px] font-medium text-primary-foreground hover:bg-[#828fff]"
                >
                  Get Started
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="ml-1 inline-flex size-8 items-center justify-center rounded-full text-foreground md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="mx-auto mt-2 max-w-[420px] px-4 md:hidden">
          <div className="rounded-2xl border border-border/70 bg-background/90 p-3 backdrop-blur-xl">
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => {
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                      pathname === l.href
                        ? 'bg-card text-foreground'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    {l.label}
                  </Link>
                );
              })}
              <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
                {user ? (
                  <Link
                    href="/dashboard"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground"
                  >
                    Open app
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-border/70 px-4 text-[13px] text-foreground"
                    >
                      Log In
                    </Link>
                    <Link
                      href="/signup"
                      className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-medium text-primary-foreground"
                    >
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
