import type { Response, CookieOptions } from 'express';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth.constant';
import { ttlToMs } from './auth.tokens';

const isProd = (): boolean => process.env.NODE_ENV === 'production';

const baseCookie = (): CookieOptions => ({
  httpOnly: true,
  secure: isProd(),
  sameSite: isProd() ? 'none' : 'lax',
  domain: process.env.COOKIE_DOMAIN || undefined,
  path: '/',
});

export const setAuthCookies = (
  res: Response,
  tokens: { access: string; refresh: string },
): void => {
  const accessTtl = process.env.ACCESS_TOKEN_TTL ?? '15m';
  const refreshTtl = process.env.REFRESH_TOKEN_TTL ?? '7d';

  res.cookie(ACCESS_COOKIE, tokens.access, {
    ...baseCookie(),
    maxAge: ttlToMs(accessTtl),
  });

  res.cookie(REFRESH_COOKIE, tokens.refresh, {
    ...baseCookie(),
    maxAge: ttlToMs(refreshTtl),
  });
};

export const clearAuthCookies = (res: Response): void => {
  const opts = baseCookie();
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
};
