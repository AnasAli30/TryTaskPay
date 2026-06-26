import type { SessionPayload } from '@/lib/session';
import { getUserByWallet } from '@/lib/userAccountLinks';
import type { UserAccountLink } from '@/lib/types';

export interface CanonicalUser {
  walletAddress: string;
  fid?: number;
  xUsername?: string;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
  email?: string;
  source: 'miniapp' | 'browser';
  link?: UserAccountLink | null;
}

export async function resolveBrowserUser(session: SessionPayload): Promise<CanonicalUser> {
  const link = await getUserByWallet(session.walletAddress);
  return {
    walletAddress: session.walletAddress,
    fid: link?.fid,
    xUsername: link?.xUsername,
    displayName: link?.displayName,
    username: link?.username,
    pfpUrl: link?.pfpUrl,
    email: link?.email,
    source: 'browser',
    link,
  };
}

export function resolveMiniappUser(params: {
  fid: number;
  walletAddress?: string;
}): CanonicalUser {
  return {
    walletAddress: params.walletAddress?.toLowerCase() ?? '',
    fid: params.fid,
    source: 'miniapp',
  };
}

export function isFarcasterTaskType(type: string): boolean {
  return ['follow', 'boost_lite', 'boost', 'quote', 'channel', 'multi', 'miniapp'].includes(type);
}

export function isXTaskType(type: string): boolean {
  return ['x_follow', 'x_boost_lite', 'x_boost', 'x_bundle'].includes(type);
}
