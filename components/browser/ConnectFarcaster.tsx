'use client';

import { useState } from 'react';
import { SignInButton, useProfile } from '@farcaster/auth-kit';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FarcasterLogo } from '@/components/icons';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';

export function ConnectFarcaster() {
  const { fid, refresh } = useBrowserAuth();
  const { isAuthenticated } = useProfile();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const handleSuccess = async (res: {
    message?: string;
    signature?: string;
    nonce?: string;
  }) => {
    if (!res.message || !res.signature || !res.nonce) return;
    setLinking(true);
    setError('');
    try {
      await axios.post(
        '/api/auth/farcaster/verify',
        {
          message: res.message,
          signature: res.signature,
          nonce: res.nonce,
        },
        { withCredentials: true },
      );
      await refresh();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to link Farcaster');
    } finally {
      setLinking(false);
    }
  };

  if (fid) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-50 border border-purple-100">
        <FarcasterLogo size={16} />
        <span className="text-sm font-semibold text-purple-800 flex-1">Farcaster connected</span>
        <FontAwesomeIcon icon={faCheckCircle} className="text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {linking ? (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
          <FontAwesomeIcon icon={faSpinner} spin />
          Linking Farcaster…
        </div>
      ) : (
        <SignInButton onSuccess={handleSuccess} />
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      {isAuthenticated && !fid && !linking && (
        <p className="text-xs text-gray-500">Complete sign-in above to link your account.</p>
      )}
    </div>
  );
}
