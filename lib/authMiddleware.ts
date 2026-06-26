import type { NextRequest } from 'next/server';
import { getFidFromRequest } from '@/lib/quickAuthServer';
import { decodeSession, SESSION_COOKIE } from '@/lib/session';
import { getUserByWallet } from '@/lib/userAccountLinks';
import type { CanonicalUser } from '@/lib/userIdentity';

export interface AuthContext {
  walletAddress?: string;
  fid?: number;
  xUsername?: string;
  source: 'miniapp' | 'browser' | 'none';
}

export async function getAuthFromRequest(req: NextRequest): Promise<AuthContext> {
  const fidFromJwt = await getFidFromRequest(req);
  if (fidFromJwt) {
    const link = await getUserByWallet(''); // skip — mini-app uses FID directly
    void link;
    return { fid: fidFromJwt, source: 'miniapp' };
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    const session = decodeSession(token);
    if (session?.walletAddress) {
      const link = await getUserByWallet(session.walletAddress);
      return {
        walletAddress: session.walletAddress,
        fid: link?.fid,
        xUsername: link?.xUsername,
        source: 'browser',
      };
    }
  }

  return { source: 'none' };
}

/** Returns auth or null. Does not block legacy mini-app body-param callers when allowLegacy=true. */
export async function requireWalletAuth(
  req: NextRequest,
  expectedAddress?: string,
  allowLegacy = true,
): Promise<AuthContext | null> {
  const auth = await getAuthFromRequest(req);
  if (auth.source === 'browser' && auth.walletAddress) {
    if (expectedAddress && auth.walletAddress !== expectedAddress.toLowerCase()) {
      return null;
    }
    return auth;
  }
  if (allowLegacy && auth.source === 'miniapp') {
    return auth;
  }
  if (allowLegacy && auth.source === 'none') {
    return auth;
  }
  return auth.source === 'browser' ? auth : null;
}

export async function requireFidOrWallet(
  req: NextRequest,
  params: { userFid?: number; userWallet?: string },
): Promise<AuthContext | null> {
  const auth = await getAuthFromRequest(req);

  if (auth.source === 'miniapp' && auth.fid) {
    if (params.userFid && params.userFid !== auth.fid) return null;
    return auth;
  }

  if (auth.source === 'browser' && auth.walletAddress) {
    if (params.userWallet && params.userWallet.toLowerCase() !== auth.walletAddress) {
      return null;
    }
    if (params.userFid && auth.fid && params.userFid !== auth.fid) return null;
    return auth;
  }

  // Legacy: allow unauthenticated mini-app calls (backward compat)
  if (auth.source === 'none') return auth;
  return null;
}

export function authToCanonical(auth: AuthContext): CanonicalUser {
  return {
    walletAddress: auth.walletAddress ?? '',
    fid: auth.fid,
    xUsername: auth.xUsername,
    source: auth.source === 'miniapp' ? 'miniapp' : 'browser',
  };
}
