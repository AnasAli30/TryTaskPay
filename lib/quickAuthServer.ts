import { createClient } from '@farcaster/quick-auth';
import { APP_URL } from '@/lib/constants';

const client = createClient();

/** Domain embedded in Quick Auth JWT (`aud`). Must match the mini app URL host. */
export function getQuickAuthVerifyDomain(): string {
  const fromEnv = process.env.QUICK_AUTH_DOMAIN?.trim();
  if (fromEnv) return fromEnv;
  return new URL(APP_URL).hostname;
}

export async function verifyQuickAuthBearerToken(token: string): Promise<number> {
  const payload = await client.verifyJwt({
    token,
    domain: getQuickAuthVerifyDomain(),
  });
  return payload.sub;
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get('authorization');
  if (!h?.toLowerCase().startsWith('bearer ')) return null;
  const t = h.slice(7).trim();
  return t || null;
}

export async function getFidFromRequest(req: Request): Promise<number | null> {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await verifyQuickAuthBearerToken(token);
  } catch {
    return null;
  }
}
