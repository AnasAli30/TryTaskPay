'use client';

import { useAppMode } from '@/components/app-mode-provider';
import { useFrame } from '@/components/farcaster-provider';
import { useBrowserAuth as useBrowserAuthContext } from '@/components/browser/BrowserAuthProvider';

export interface BrowserAuthState {
  walletConnected: boolean;
  siweVerified: boolean;
  walletAddress?: string;
  fid?: number | null;
  xUsername?: string | null;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
  loading: boolean;
  authError?: string | null;
  refresh: () => Promise<void>;
  signInWithWallet: () => Promise<boolean>;
  clearAuthError: () => void;
}

/** @deprecated import from `@/components/browser/BrowserAuthProvider` */
export function useBrowserAuth(): BrowserAuthState {
  return useBrowserAuthContext();
}

export function useUserIdentity() {
  const { isBrowser, isMiniapp } = useAppMode();
  const { context } = useFrame();
  const browserAuth = useBrowserAuth();

  if (isMiniapp) {
    const user = context?.user;
    return {
      mode: 'miniapp' as const,
      fid: user?.fid,
      walletAddress: undefined as string | undefined,
      displayName: (user as any)?.displayName ?? (user as any)?.username,
      username: (user as any)?.username,
      pfpUrl: (user as any)?.pfpUrl,
      xUsername: undefined as string | undefined,
      siweVerified: true,
      requiresFarcasterForFcQuests: false,
      requiresXForXQuests: false,
      browserAuth: null as BrowserAuthState | null,
    };
  }

  return {
    mode: 'browser' as const,
    fid: browserAuth.fid ?? undefined,
    walletAddress: browserAuth.walletAddress,
    displayName: browserAuth.displayName,
    username: browserAuth.username,
    pfpUrl: browserAuth.pfpUrl,
    xUsername: browserAuth.xUsername ?? undefined,
    siweVerified: browserAuth.siweVerified,
    requiresFarcasterForFcQuests: isBrowser && !browserAuth.fid,
    requiresXForXQuests: isBrowser && !browserAuth.xUsername,
    browserAuth,
  };
}
