import { getNeynarApiKey, logNeynarHttpFailure, NEYNAR_API_BASE_URL } from '@/lib/neynar';

/**
 * Farcaster `publicSpamLabel` (user-by-username extras): numeric tier; &lt; 1 = spam tier.
 * Shared by verify/check-eligibility and profile display.
 */
export async function fetchPublicSpamLabelNumeric(
  fid: number,
  logSource: string,
): Promise<{ numeric: number | null; username: string | null }> {
  try {
    const apiKeySpam = getNeynarApiKey();
    const bulkUrlSpam = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fid}`;
    const bulkResSpam = await fetch(bulkUrlSpam, {
      method: 'GET',
      headers: { 'x-api-key': apiKeySpam, accept: 'application/json' },
      cache: 'no-store',
    });
    if (!bulkResSpam.ok) {
      await logNeynarHttpFailure(bulkResSpam, apiKeySpam, bulkUrlSpam, `${logSource} spam user/bulk`);
      return { numeric: null, username: null };
    }
    const bulkDataSpam = await bulkResSpam.json();
    const username = bulkDataSpam?.users?.[0]?.username;
    if (!username || typeof username !== 'string') {
      return { numeric: null, username: null };
    }
    const fcRes = await fetch(
      `https://farcaster.xyz/~api/v2/user-by-username?username=${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: { accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!fcRes.ok) {
      return { numeric: null, username };
    }
    const fcData = await fcRes.json();
    const spamLabel = fcData?.result?.extras?.publicSpamLabel;
    if (spamLabel === undefined || spamLabel === null) {
      return { numeric: null, username };
    }
    const str = String(spamLabel).trim();
    const leading = str.match(/^-?\d+/);
    const spamLabelNum = leading ? parseInt(leading[0], 10) : NaN;
    if (Number.isNaN(spamLabelNum)) {
      return { numeric: null, username };
    }
    return { numeric: spamLabelNum, username };
  } catch (e) {
    console.error(`[${logSource}] publicSpamLabel error:`, e);
    return { numeric: null, username: null };
  }
}

export type PublicSpamLabelTier = 'non_spam' | 'spam' | 'unknown';

/** For profile UI — same thresholds as evaluatePublicSpamLabel. */
export async function getPublicSpamLabelDisplay(fid: number): Promise<{
  numeric: number | null;
  tier: PublicSpamLabelTier;
}> {
  const { numeric } = await fetchPublicSpamLabelNumeric(fid, 'profile/spam-label');
  if (numeric === null) {
    return { numeric: null, tier: 'unknown' };
  }
  return { numeric, tier: numeric < 1 ? 'spam' : 'non_spam' };
}

/**
 * Farcaster `publicSpamLabel` (user-by-username extras): numeric tier; &lt; 1 = spam tier.
 * @see verify route — must match check-eligibility
 */
export async function evaluatePublicSpamLabel(
  fid: number,
  logSource: string,
): Promise<'pass' | 'spam' | 'indeterminate'> {
  const { numeric, username } = await fetchPublicSpamLabelNumeric(fid, logSource);
  if (numeric === null) {
    return 'indeterminate';
  }
  if (numeric < 1) {
    console.log(`[${logSource}] spam label ${numeric} (fid ${fid}, user ${username ?? '?'})`);
    return 'spam';
  }
  return 'pass';
}

export const NON_SPAM_QUEST_MESSAGE =
  'This quest is restricted to non-spam accounts only. Your account does not meet the criteria.';
