'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { XLogo } from '@/components/icons';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import axios from 'axios';
import { useState } from 'react';

export function ConnectX() {
  const { xUsername, siweVerified, refresh } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = () => {
    if (!siweVerified) {
      openAuthGate();
      return;
    }
    const returnTo = encodeURIComponent(
      typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/app',
    );
    window.location.href = `/api/auth/x/start?returnTo=${returnTo}`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await axios.post('/api/auth/x/disconnect', {}, { withCredentials: true });
      await refresh();
    } finally {
      setDisconnecting(false);
    }
  };

  if (xUsername) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
        <XLogo size={14} />
        <span className="text-sm font-semibold flex-1">@{xUsername}</span>
        <FontAwesomeIcon icon={faCheckCircle} className="text-green-600" />
        <button
          type="button"
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-xs text-gray-400 hover:text-red-500 ml-1 disabled:opacity-50"
          aria-label="Disconnect X"
        >
          <FontAwesomeIcon icon={disconnecting ? faSpinner : faXmark} spin={disconnecting} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      className="w-full py-3 px-4 rounded-xl bg-black text-white font-bold flex items-center justify-center gap-2"
    >
      <XLogo size={14} />
      {siweVerified ? 'Connect X' : 'Sign in wallet to connect X'}
    </button>
  );
}
