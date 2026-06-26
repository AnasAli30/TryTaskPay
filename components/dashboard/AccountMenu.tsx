'use client';

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faWallet,
  faChevronDown,
  faRightFromBracket,
  faSpinner,
  faCheckCircle,
} from '@fortawesome/free-solid-svg-icons';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import axios from 'axios';
import { focusRing } from '@/components/brand/constants';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { FarcasterLogo, XLogo } from '@/components/icons';

function truncateAddress(addr?: string) {
  if (!addr) return '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AccountMenu() {
  const { siweVerified, walletAddress, displayName, pfpUrl, fid, xUsername, loading, refresh } =
    useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleConnect = () => {
    if (siweVerified) {
      setOpen((o) => !o);
      return;
    }
    if (!isConnected) {
      const c = connectors[0];
      if (c) connect({ connector: c });
      else openAuthGate();
      return;
    }
    openAuthGate();
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await axios.post('/api/auth/wallet/disconnect', {}, { withCredentials: true });
      disconnect();
      await refresh();
    } catch (e) {
      console.error('Sign out failed', e);
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-400">
        <FontAwesomeIcon icon={faSpinner} spin />
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={handleConnect}
        disabled={isPending}
        className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-bold transition-colors ${focusRing} ${
          siweVerified
            ? 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            : 'bg-black text-white hover:bg-gray-900 shadow-md shadow-black/10'
        }`}
      >
        {siweVerified && pfpUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pfpUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
        ) : (
          <FontAwesomeIcon icon={isPending ? faSpinner : faWallet} spin={isPending} />
        )}
        <span className="hidden sm:inline max-w-[120px] truncate">
          {siweVerified
            ? displayName || truncateAddress(walletAddress)
            : isConnected
              ? 'Sign in'
              : 'Connect'}
        </span>
        {siweVerified && <FontAwesomeIcon icon={faChevronDown} className="text-xs text-gray-400" />}
      </button>

      {open && siweVerified && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="font-bold text-sm truncate">{displayName || 'Wallet user'}</p>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{truncateAddress(walletAddress)}</p>
          </div>
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-xs">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-500" />
              <span className="font-semibold">Wallet connected</span>
            </div>
            {fid ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 text-xs text-purple-800">
                <FarcasterLogo className="w-4 h-4" />
                <span className="font-semibold">Farcaster linked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-xs text-gray-500">
                <FarcasterLogo className="w-4 h-4 opacity-40" />
                <span>FC not linked</span>
              </div>
            )}
            {xUsername ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900 text-xs text-white">
                <XLogo className="w-4 h-4" />
                <span className="font-semibold">@{xUsername}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-xs text-gray-500">
                <XLogo className="w-4 h-4 opacity-40" />
                <span>X not linked</span>
              </div>
            )}
          </div>
          <div className="p-2 border-t border-gray-100">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors ${focusRing}`}
            >
              <FontAwesomeIcon icon={signingOut ? faSpinner : faRightFromBracket} spin={signingOut} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
