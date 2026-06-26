/**
 * Neynar API configuration and helper functions
 */

/** Valid viewer_fid for Neynar APIs — rejects undefined/null strings and non-positive integers. */
export function parseViewerFid(raw: string | number | null | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : undefined;
  }
  const s = String(raw).trim();
  if (s === 'undefined' || s === 'null' || s === 'NaN') return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;

// Round-robin counter for cycling through API keys 2-5
let neynarKeyIndex = 0;

/**
 * Get the original Neynar API key (for best-friends route)
 */
export function getNeynarApiKey(): string {
  if (!NEYNAR_API_KEY) {
    throw new Error(
      'NEYNAR_API_KEY is not set. Please add it to your .env.local file.',
    );
  }
  return NEYNAR_API_KEY;
}

/**
 * Get all available Neynar API keys (2-5) for round-robin
 */
export function getAllNeynarApiKeys(): string[] {
  const keys: string[] = [];

  // Check for keys 2-5
  for (let i = 2; i <= 5; i++) {
    const key = process.env[`NEYNAR_API_KEY${i}`];
    if (key) {
      keys.push(key);
    }
  }

  if (keys.length === 0) {
    // Fallback to primary key if no rotation keys are set
    if (NEYNAR_API_KEY) return [NEYNAR_API_KEY];

    throw new Error(
      'At least one of NEYNAR_API_KEY, NEYNAR_API_KEY2, ...5 must be set.',
    );
  }

  return keys;
}

/**
 * Get Neynar API key using round-robin (for check-follow and users/bulk routes)
 * Cycles through keys 2, 3, 4, 5
 */
export function getNeynarApiKeyRoundRobin(): string {
  const allKeys = getAllNeynarApiKeys();

  // Use round-robin to cycle through available keys
  const selected = allKeys[neynarKeyIndex % allKeys.length];
  neynarKeyIndex = (neynarKeyIndex + 1) % allKeys.length;

  return selected;
}

export const NEYNAR_API_BASE_URL = 'https://api.neynar.com/v2/farcaster';

/**
 * Map an API key string to a stable Neynar slot number for logging.
 * 1 = main `NEYNAR_API_KEY`, 2–5 = `NEYNAR_API_KEY2` … `NEYNAR_API_KEY5`.
 */
export function resolveNeynarKeyApiNumber(apiKey: string): { apiNumber: number; label: string } {
  if (!apiKey) {
    return { apiNumber: 0, label: 'unknown (empty key)' };
  }
  if (NEYNAR_API_KEY && apiKey === NEYNAR_API_KEY) {
    return { apiNumber: 1, label: 'Neynar API 1 (main — NEYNAR_API_KEY)' };
  }
  for (let i = 2; i <= 5; i++) {
    const k = process.env[`NEYNAR_API_KEY${i}`];
    if (k && k === apiKey) {
      return { apiNumber: i, label: `Neynar API ${i} (NEYNAR_API_KEY${i})` };
    }
  }
  return { apiNumber: 0, label: 'unknown (key not matched to NEYNAR_API_KEY / NEYNAR_API_KEY2–5)' };
}

/** Structured console error: which Neynar key slot failed + HTTP/body details. */
export function logNeynarApiError(params: {
  source: string;
  apiKey: string;
  url?: string;
  status?: number;
  statusText?: string;
  errorDetails?: string;
  err?: unknown;
  note?: string;
}): void {
  const { apiNumber, label } = resolveNeynarKeyApiNumber(params.apiKey);
  const errMsg =
    params.err instanceof Error
      ? params.err.message
      : params.err != null
        ? String(params.err)
        : undefined;
  console.error('[Neynar API error]', {
    neynarApiNumber: apiNumber,
    neynarApiLabel: label,
    source: params.source,
    url: params.url,
    status: params.status,
    statusText: params.statusText,
    errorDetails:
      typeof params.errorDetails === 'string'
        ? params.errorDetails.slice(0, 2000)
        : params.errorDetails,
    exceptionMessage: errMsg,
    note: params.note,
  });
}

/** Read response body (clone) and log a Neynar HTTP failure with API slot number. */
export async function logNeynarHttpFailure(
  res: Response,
  apiKey: string,
  url: string,
  source: string,
): Promise<void> {
  let body = '';
  try {
    body = await res.clone().text();
  } catch {
    /* ignore */
  }
  logNeynarApiError({
    source,
    apiKey,
    url,
    status: res.status,
    statusText: res.statusText,
    errorDetails: body,
  });
}

/** HTTP statuses where another Neynar key may succeed (quota, auth, overload). */
function isNeynarRetryableStatus(status: number): boolean {
  if (status >= 500) return true;
  // 402 Payment Required — plan / CU limit on this key; try next key
  if (status === 402) return true;
  if (status === 401 || status === 403) return true;
  if (status === 408) return true; // Request Timeout
  if (status === 429) return true;
  return false;
}

/**
 * Fetch wrapper that rotates through all available API keys on failure.
 * Retries on network errors and on statuses where another key may work:
 * 401, 402, 403, 408, 429, and 5xx. Other 4xx (e.g. 400, 404) return immediately.
 */
export async function fetchWithNeynarFallback(url: string, init?: RequestInit): Promise<Response> {
  const keys = getAllNeynarApiKeys();
  let lastResponse: Response | undefined;
  let lastError: any;
  // Try keys in round-robin order starting from current index
  // We offset by neynarKeyIndex to start with the "next" expected key
  const rotatedKeys = [
    ...keys.slice(neynarKeyIndex),
    ...keys.slice(0, neynarKeyIndex)
  ];

  for (const key of rotatedKeys) {
    try {
      const headers = new Headers(init?.headers);
      headers.set('x-api-key', key);
      headers.set('accept', 'application/json');

      // Use only `cache: 'no-store'` — do not combine with `next.revalidate` (Next.js warns).
      const initSansNext =
        init && typeof init === 'object'
          ? (() => {
              const { next: _n, ...rest } = init as RequestInit & { next?: unknown };
              return rest;
            })()
          : {};
      const res = await fetch(url, {
        ...initSansNext,
        cache: init?.cache ?? 'no-store',
        headers,
      });

      if (res.ok) {
        // Update global index to point to next key for next time (simple load balancing)
        const keyIndex = keys.indexOf(key);
        if (keyIndex !== -1) {
          neynarKeyIndex = (keyIndex + 1) % keys.length;
        }
        return res;
      }

      lastResponse = res;
      await logNeynarHttpFailure(res, key, url, 'fetchWithNeynarFallback');

      if (!isNeynarRetryableStatus(res.status)) {
        return res;
      }

      console.warn(
        `[fetchWithNeynarFallback] Retrying after status ${res.status} — next key (current was Neynar API ${resolveNeynarKeyApiNumber(key).apiNumber})`,
      );

    } catch (err) {
      lastError = err;
      logNeynarApiError({
        source: 'fetchWithNeynarFallback (network/exception)',
        apiKey: key,
        url,
        err,
        note: 'Request threw before HTTP response',
      });
      // Continue to next key on network error
    }
  }

  if (lastResponse) {
    return lastResponse;
  }
  logNeynarApiError({
    source: 'fetchWithNeynarFallback (all keys failed — no HTTP response)',
    apiKey: rotatedKeys[0] ?? '',
    url,
    err: lastError,
    note: 'Throwing after network failures on every key',
  });
  throw lastError || new Error('All Neynar API keys failed.');
}

/** Max FIDs per `user/bulk` request (Neynar supports comma-separated lists; keep batches modest). */
const BULK_FOLLOWER_COUNT_BATCH = 50;

/**
 * Returns Farcaster follower_count per fid from Neynar user/bulk (missing users get 0).
 */
export async function fetchFollowerCountsByFids(fids: number[]): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const seen = new Set<number>();
  const unique: number[] = [];
  for (let i = 0; i < fids.length; i++) {
    const n = fids[i];
    if (!Number.isFinite(n) || seen.has(n)) continue;
    seen.add(n);
    unique.push(n);
  }
  for (let i = 0; i < unique.length; i += BULK_FOLLOWER_COUNT_BATCH) {
    const batch = unique.slice(i, i + BULK_FOLLOWER_COUNT_BATCH);
    const url = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${batch.join(',')}`;
    const res = await fetchWithNeynarFallback(url, { method: 'GET', cache: 'no-store' });
    if (!res.ok) {
      await logNeynarHttpFailure(res, getNeynarApiKey(), url, 'fetchFollowerCountsByFids user/bulk');
      continue;
    }
    const data = await res.json();
    const users = data?.users ?? [];
    for (const u of users) {
      const fid = u?.fid;
      if (typeof fid !== 'number') continue;
      out.set(fid, u.follower_count ?? 0);
    }
  }
  for (const fid of unique) {
    if (!out.has(fid)) out.set(fid, 0);
  }
  return out;
}
