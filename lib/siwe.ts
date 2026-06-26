import { getAddress } from 'ethers';
import { SiweMessage } from 'siwe';
import { getDatabase } from '@/lib/mongodb';
import { getAppWebUrl } from '@/lib/xOAuth';

/** SIWE requires EIP-55 checksummed addresses in the message body. */
export function normalizeSiweAddress(address: string): string {
  return getAddress(address.trim());
}

const NONCE_COLLECTION = 'authNonces';
const NONCE_TTL_MS = 5 * 60 * 1000;

/** SIWE requires an absolute URI; NEXT_PUBLIC_URL may be host-only (e.g. cloudflare tunnel). */
export function normalizeAbsoluteUrl(raw?: string | null): string {
  const fallback = 'http://localhost:3000';
  const value = raw?.trim();
  if (!value) return fallback;
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value.replace(/\/$/, '');
  }
  return `https://${value.replace(/\/$/, '')}`;
}

/** Allowed SIWE domains (web dapp + optional mini app / Vercel host). */
export function getAllowedSiweDomains(): string[] {
  const domains = new Set<string>();
  const explicit = process.env.SIWE_DOMAIN?.trim();
  if (explicit) domains.add(explicit);

  try {
    domains.add(new URL(getAppWebUrl()).hostname);
  } catch {
    /* ignore */
  }

  try {
    domains.add(new URL(normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_URL)).hostname);
  } catch {
    /* ignore */
  }

  domains.add('localhost');
  return Array.from(domains);
}

/** Pick SIWE origin from request host, else default to APP_WEB_URL (not NEXT_PUBLIC_URL). */
export function resolveSiweOrigin(req?: { headers: Headers }): string {
  const appWeb = getAppWebUrl();
  const miniApp = normalizeAbsoluteUrl(process.env.NEXT_PUBLIC_URL);

  if (req) {
    const hostHeader = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const host = hostHeader.split(',')[0]?.trim().split(':')[0]?.toLowerCase();
    const proto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim();

    if (host) {
      const webHost = new URL(appWeb).hostname.toLowerCase();
      const miniHost = new URL(miniApp).hostname.toLowerCase();

      if (host === webHost) return appWeb;
      if (host === miniHost) return miniApp;
    }
  }

  return appWeb;
}

export function resolveSiweDomain(req?: { headers: Headers }): string {
  const fromEnv = process.env.SIWE_DOMAIN?.trim();
  if (fromEnv) return fromEnv;
  try {
    return new URL(resolveSiweOrigin(req)).hostname;
  } catch {
    return 'localhost';
  }
}

/** @deprecated use resolveSiweOrigin */
export function getSiweOrigin(): string {
  return getAppWebUrl();
}

/** @deprecated use resolveSiweDomain */
export function getSiweDomain(): string {
  return resolveSiweDomain();
}

export async function storeNonce(address: string, nonce: string): Promise<void> {
  const db = await getDatabase();
  const normalized = address.toLowerCase();
  await db.collection(NONCE_COLLECTION).updateOne(
    { address: normalized },
    {
      $set: {
        address: normalized,
        nonce,
        expiresAt: new Date(Date.now() + NONCE_TTL_MS),
      },
    },
    { upsert: true },
  );
}

export async function consumeNonce(address: string, nonce: string): Promise<boolean> {
  const db = await getDatabase();
  const normalized = address.toLowerCase();
  const doc = await db.collection(NONCE_COLLECTION).findOne({
    address: normalized,
    nonce,
    expiresAt: { $gt: new Date() },
  });
  if (!doc) return false;
  await db.collection(NONCE_COLLECTION).deleteOne({ _id: doc._id });
  return true;
}

export function buildSiweMessage(params: {
  address: string;
  nonce: string;
  chainId?: number;
  req?: { headers: Headers };
}): SiweMessage {
  const origin = resolveSiweOrigin(params.req);
  const address = normalizeSiweAddress(params.address);
  return new SiweMessage({
    domain: resolveSiweDomain(params.req),
    address,
    statement: 'Sign in to TaskPay',
    uri: origin,
    version: '1',
    chainId: params.chainId ?? 42161,
    nonce: params.nonce,
  });
}

export async function verifySiweMessage(
  message: string,
  signature: string,
): Promise<{ address: string } | null> {
  try {
    const siwe = new SiweMessage(message);
    const allowed = getAllowedSiweDomains();
    if (!allowed.includes(siwe.domain)) return null;

    const fields = await siwe.verify({ signature, domain: siwe.domain });
    const address = fields.data.address;
    const nonce = fields.data.nonce;
    const ok = await consumeNonce(address, nonce);
    if (!ok) return null;
    return { address: address.toLowerCase() };
  } catch {
    return null;
  }
}
