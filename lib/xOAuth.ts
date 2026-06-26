/** Normalize env URL to absolute origin without trailing slash. */
export function normalizeAbsoluteUrl(raw?: string | null): string {
  const fallback = 'http://localhost:3000';
  const value = raw?.trim();
  if (!value) return fallback;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/$/, '');
  }
  return `https://${value.replace(/\/$/, '')}`;
}

/**
 * Canonical public web URL for the dapp (trytaskpay.com).
 * Use when NEXT_PUBLIC_URL points at a Farcaster mini app tunnel or different host.
 */
export function getAppWebUrl(): string {
  const fromEnv =
    process.env.APP_WEB_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_WEB_URL?.trim();
  const raw = fromEnv || process.env.NEXT_PUBLIC_URL?.trim();
  if (!raw) {
    throw new Error('APP_WEB_URL or NEXT_PUBLIC_URL must be set');
  }
  return normalizeAbsoluteUrl(raw);
}

/** Allowed post-OAuth redirect origins (open-redirect guard). */
export function getAllowedOAuthReturnOrigins(): string[] {
  const origins = new Set<string>();
  try {
    origins.add(new URL(getAppWebUrl()).origin);
  } catch {
    /* ignore */
  }
  try {
    origins.add(new URL(normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_URL)).origin);
  } catch {
    /* ignore */
  }
  origins.add('http://localhost:3000');
  origins.add('http://127.0.0.1:3000');
  return Array.from(origins);
}

/** X OAuth redirect_uri — must match X Developer Portal callback exactly. */
export function getXOAuthCallbackUrl(): string {
  const explicit =
    process.env.X_OAUTH_CALLBACK_URL?.trim() ||
    process.env.TWITTER_CALLBACK_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  return `${getAppWebUrl()}/api/auth/x/callback`;
}

/** OAuth 2.0 scopes — follows.read required for X follow quest verification. */
export function getXOAuthScopes(): string {
  const fromEnv =
    process.env.X_OAUTH_SCOPES?.trim() ||
    process.env.TWITTER_OAUTH_SCOPES?.trim();
  return fromEnv || 'tweet.read users.read follows.read offline.access';
}

export function getAppWebBasePath(): string {
  return `${getAppWebUrl()}/app`;
}

/** Resolve browser origin from request (for OAuth returnTo). */
export function resolveAppOriginFromRequest(req: { headers: Headers; nextUrl?: URL }): string {
  const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const host = hostHeader.split(',')[0]?.trim();
  const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim();

  if (host) {
    const origin = `${proto}://${host}`.replace(/\/$/, '');
    const allowed = getAllowedOAuthReturnOrigins();
    if (allowed.includes(new URL(origin).origin)) {
      return origin;
    }
  }

  if (req.nextUrl?.origin) {
    const allowed = getAllowedOAuthReturnOrigins();
    if (allowed.includes(req.nextUrl.origin)) {
      return req.nextUrl.origin;
    }
  }

  return getAppWebUrl();
}

/** Safe post-OAuth redirect target under /app on an allowed origin. */
export function resolveOAuthReturnUrl(
  req: { headers: Headers; nextUrl: URL },
  fallbackPath = '/app',
): string {
  const origin = resolveAppOriginFromRequest(req);
  const rawPath = req.nextUrl.searchParams.get('returnTo')?.trim() || fallbackPath;
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  const safePath = path.startsWith('/app') ? path : '/app';
  return `${origin}${safePath}`;
}

export function appendOAuthQuery(baseUrl: string, key: string, value: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(key, value);
  return url.toString();
}
