import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'sc_at';
const REFRESH_COOKIE = 'sc_rt';

// Routes that require a logged-in user.
const PROTECTED_PREFIXES = ['/dashboard', '/projects', '/tasks', '/team'];

// Routes that should redirect away when already logged in.
const GUEST_PREFIXES = ['/login', '/signup'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasAccess = req.cookies.has(ACCESS_COOKIE);
  const hasRefresh = req.cookies.has(REFRESH_COOKIE);
  const authed = hasAccess || hasRefresh;

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (GUEST_PREFIXES.some((p) => pathname.startsWith(p)) && authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.delete('next');
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico|.*\\..*).*)'],
};
