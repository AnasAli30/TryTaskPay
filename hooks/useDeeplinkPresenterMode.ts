'use client';

import { useEffect, useState } from 'react';

/**
 * Farcaster signer docs: on mobile open the deeplink directly; on web show a QR to scan with the phone.
 */
export function useDeeplinkOpenDirectly(): boolean {
  const [openDirectly, setOpenDirectly] = useState(true);

  useEffect(() => {
    const ua = navigator.userAgent;
    const mobileUa =
      /Android|iPhone|iPod|iPad|IEMobile|Mobile|webOS|BlackBerry|Opera Mini/i.test(ua);
    const iPadAsDesktop = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    setOpenDirectly(mobileUa || iPadAsDesktop);
  }, []);

  return openDirectly;
}
