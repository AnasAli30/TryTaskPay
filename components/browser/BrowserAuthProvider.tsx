'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { useAccount, useConnect, useSignMessage, useConfig } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useReconnect } from 'wagmi';
import { connect, getConnection } from 'wagmi/actions';
import { useAppMode } from '@/components/app-mode-provider';
import type { BrowserAuthState } from '@/components/hooks/useUserIdentity';

const BrowserAuthContext = createContext<BrowserAuthState | null>(null);

const stubAuth: BrowserAuthState = {
  walletConnected: false,
  siweVerified: false,
  loading: false,
  authError: null,
  refresh: async () => {},
  signInWithWallet: async () => false,
  clearAuthError: () => {},
};

function WalletSessionSync() {
  const { mutate: reconnect } = useReconnect();
  const { isConnected, address } = useAccount();
  const { siweVerified } = useBrowserAuth();
  const { connectAsync, connectors } = useConnect();

  useEffect(() => {
    reconnect();
  }, [reconnect]);

  useEffect(() => {
    if (siweVerified && !isConnected && !address && connectors[0]) {
      connectAsync({ connector: connectors[0], chainId: arbitrum.id }).catch(() => {});
    }
  }, [siweVerified, isConnected, address, connectors, connectAsync]);

  return null;
}

async function readInjectedAddress(): Promise<`0x${string}` | null> {
  if (typeof window === 'undefined' || !(window as any).ethereum) return null;
  try {
    const accounts = (await (window as any).ethereum.request({
      method: 'eth_accounts',
    })) as string[];
    return accounts[0] ? (accounts[0] as `0x${string}`) : null;
  } catch {
    return null;
  }
}

export function BrowserAuthProvider({ children }: { children: ReactNode }) {
  const { isBrowser } = useAppMode();
  const config = useConfig();
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [siweVerified, setSiweVerified] = useState(false);
  const [profile, setProfile] = useState<Partial<BrowserAuthState>>({});
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  useEffect(() => {
    console.log('[BrowserAuth] provider ready', { isBrowser, address, isConnected });
  }, [isBrowser, address, isConnected]);

  const refresh = useCallback(async () => {
    if (!isBrowser) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get('/api/auth/me', { withCredentials: true });
      if (res.data?.authenticated) {
        setSiweVerified(true);
        setProfile({
          walletAddress: res.data.walletAddress,
          fid: res.data.fid,
          xUsername: res.data.xUsername,
          displayName: res.data.displayName,
          username: res.data.username,
          pfpUrl: res.data.pfpUrl,
        });
      } else {
        setSiweVerified(false);
        setProfile({});
      }
    } catch {
      setSiweVerified(false);
      setProfile({});
    } finally {
      setLoading(false);
    }
  }, [isBrowser]);

  useEffect(() => {
    refresh();
  }, [refresh, address]);

  const resolveWalletAddress = useCallback(async (): Promise<`0x${string}` | null> => {
    console.log('[BrowserAuth] resolveWalletAddress start', { address, isConnected });
    if (address) {
      console.log('[BrowserAuth] using wagmi address', address);
      return address;
    }

    const conn = getConnection(config);
    if (conn.address) {
      console.log('[BrowserAuth] using getConnection address', conn.address);
      return conn.address;
    }

    const injected = await readInjectedAddress();
    if (injected) {
      console.log('[BrowserAuth] using injected address', injected);
      return injected;
    }

    const connector = connectors[0];
    if (!connector) {
      console.error('[BrowserAuth] no connector');
      return null;
    }

    try {
      console.log('[BrowserAuth] connectAsync…');
      const result = await connectAsync({ connector, chainId: arbitrum.id });
      console.log('[BrowserAuth] connectAsync ok', result.accounts);
      return result.accounts[0] ?? null;
    } catch (e1) {
      console.warn('[BrowserAuth] connectAsync failed, trying connect()', e1);
      try {
        await connect(config, { connector, chainId: arbitrum.id });
        const after = getConnection(config);
        console.log('[BrowserAuth] connect() ok', after.address);
        return after.address ?? null;
      } catch (e2) {
        console.error('[BrowserAuth] connect() failed', e2);
        return null;
      }
    }
  }, [address, config, connectors, connectAsync, isConnected]);

  const signInWithWallet = useCallback(async (): Promise<boolean> => {
    console.log('[BrowserAuth] signInWithWallet called', { isBrowser });
    if (!isBrowser) {
      console.error('[BrowserAuth] blocked: not browser mode (AppModeProvider missing?)');
      setAuthError('Auth not available in this context.');
      return false;
    }

    setAuthError(null);

    const walletAddr = await resolveWalletAddress();
    if (!walletAddr) {
      console.error('[BrowserAuth] no wallet address resolved');
      setAuthError('Connect your wallet first, then try again.');
      return false;
    }

    try {
      console.log('[BrowserAuth] fetching nonce for', walletAddr);
      const nonceRes = await axios.post('/api/auth/wallet/nonce', { address: walletAddr });
      const message = nonceRes.data?.message as string | undefined;
      if (!message) {
        console.error('[BrowserAuth] nonce response missing message', nonceRes.data);
        setAuthError('Could not start sign-in. Please try again.');
        return false;
      }

      console.log('[BrowserAuth] requesting signature…');
      const signature = await signMessageAsync({
        account: walletAddr,
        message,
      });
      console.log('[BrowserAuth] signature received, verifying…');

      await axios.post(
        '/api/auth/wallet/verify',
        { message, signature },
        { withCredentials: true },
      );
      console.log('[BrowserAuth] verify ok, refreshing session');
      await refresh();
      return true;
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string; response?: { data?: { error?: string } } };
      console.error('[BrowserAuth] signInWithWallet error', {
        code: err?.code,
        message: err?.message,
        response: err?.response?.data,
        raw: e,
      });
      if (err?.code === 4001 || err?.message?.toLowerCase().includes('rejected')) {
        setAuthError('Signature cancelled.');
      } else {
        setAuthError(
          err?.response?.data?.error ??
            err?.message ??
            'Sign-in failed. Check your wallet and try again.',
        );
      }
      return false;
    }
  }, [isBrowser, resolveWalletAddress, signMessageAsync, refresh]);

  const value: BrowserAuthState = isBrowser
    ? {
        walletConnected: isConnected || Boolean(address),
        siweVerified,
        walletAddress: profile.walletAddress ?? address,
        fid: profile.fid,
        xUsername: profile.xUsername,
        displayName: profile.displayName,
        username: profile.username,
        pfpUrl: profile.pfpUrl,
        loading,
        authError,
        refresh,
        signInWithWallet,
        clearAuthError,
      }
    : stubAuth;

  return (
    <BrowserAuthContext.Provider value={value}>
      {isBrowser && <WalletSessionSync />}
      {children}
    </BrowserAuthContext.Provider>
  );
}

export function useBrowserAuth(): BrowserAuthState {
  const ctx = useContext(BrowserAuthContext);
  return ctx ?? stubAuth;
}
