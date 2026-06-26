import { rapidApiGet, RAPIDAPI_HOST } from './rapidApiClient';

/**
 * X follower count from RapidAPI `screenname.php` (replaces flaky `search.php` People lookup).
 * Now uses multi-key fallback + caching via rapidApiClient.
 * @see https://rapidapi.com/twitter-api45/api/twitter-api45
 */
export async function fetchXFollowerCountByScreenName(
  screenname: string,
  options?: { restId?: string; rapidApiKey?: string },
): Promise<number | null> {
  const clean = screenname.replace(/^@/, '').trim();
  if (!clean) return null;

  const params: Record<string, string> = { screenname: clean };
  if (options?.restId) {
    params.rest_id = options.restId;
  }

  try {
    const res = await rapidApiGet({
      url: `https://${RAPIDAPI_HOST}/screenname.php`,
      params,
      timeout: 15000,
    });

    const data = res.data as {
      status?: string;
      sub_count?: number;
      followers_count?: number;
    };

    const raw = data?.sub_count ?? data?.followers_count;
    if (raw == null) return null;
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    console.error('[twitterRapidApi] screenname.php failed:', e);
    return null;
  }
}
