'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet,
  faSpinner,
  faCheckCircle,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { useConnect, useAccount } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useBrowserAuth } from '@/components/browser/BrowserAuthProvider';
import { useAuthGate } from '@/components/dashboard/AuthContext';

export function ConnectWalletButton() {
  const { connectAsync, connectors, isPending } = useConnect();
  const { address, isConnected } = useAccount();
  const { siweVerified, signInWithWallet, authError, clearAuthError } = useBrowserAuth();
  const { closeAuthGate } = useAuthGate();
  const [signing, setSigning] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const hasWallet = Boolean(address) || isConnected;

  const handleConnect = async () => {
    console.log('[ConnectWalletButton] Connect clicked', {
      connectors: connectors.length,
      address,
      isConnected,
    });
    clearAuthError();
    const c = connectors[0];
    if (!c) {
      console.error('[ConnectWalletButton] No connector available');
      return;
    }
    setConnecting(true);
    try {
      const result = await connectAsync({ connector: c, chainId: arbitrum.id });
      console.log('[ConnectWalletButton] Connected', result);
    } catch (e) {
      console.error('[ConnectWalletButton] Connect failed', e);
    } finally {
      setConnecting(false);
    }
  };

  const handleSignIn = async () => {
    console.log('[ConnectWalletButton] Sign message clicked', {
      address,
      isConnected,
      hasWallet,
      signing,
    });
    clearAuthError();
    setSigning(true);
    try {
      const ok = await signInWithWallet();
      console.log('[ConnectWalletButton] signInWithWallet result', ok);
      if (ok) closeAuthGate();
    } catch (e) {
      console.error('[ConnectWalletButton] handleSignIn unexpected error', e);
    } finally {
      setSigning(false);
    }
  };

  if (siweVerified) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
        <FontAwesomeIcon icon={faCheckCircle} />
        Wallet verified
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hasWallet ? (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isPending || connecting}
          className="w-full py-3 px-4 rounded-xl bg-black text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <FontAwesomeIcon
            icon={isPending || connecting ? faSpinner : faWallet}
            spin={isPending || connecting}
          />
          Connect Wallet
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSignIn}
          disabled={signing}
          className="w-full py-3 px-4 rounded-xl bg-black text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <FontAwesomeIcon icon={signing ? faSpinner : faWallet} spin={signing} />
          Sign message to verify
        </button>
      )}

      {authError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
          <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
          <span>{authError}</span>
        </div>
      )}
    </div>
  );
}
