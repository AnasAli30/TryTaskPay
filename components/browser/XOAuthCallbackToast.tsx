'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBrowserAuth } from '@/components/browser/BrowserAuthProvider';
import { getXOAuthErrorMessage } from '@/lib/xOAuthErrors';

export function XOAuthCallbackToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useBrowserAuth();

  useEffect(() => {
    const connected = searchParams.get('x_connected');
    const error = searchParams.get('x_error');

    if (!connected && !error) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('x_connected');
      url.searchParams.delete('x_error');
      router.replace(url.pathname + url.search, { scroll: false });
    };

    if (connected) {
      void refresh().then(() => {
        cleanUrl();
      });
      return;
    }

    if (error) {
      const message = getXOAuthErrorMessage(error);
      console.warn('[X OAuth]', message);
      // Brief alert so users see why connect failed (replace with toast UI later)
      window.alert(message);
      cleanUrl();
    }
  }, [searchParams, router, refresh]);

  return null;
}
