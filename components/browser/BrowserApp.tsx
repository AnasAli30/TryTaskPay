'use client';

import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';
import { AppModeProvider } from '@/components/app-mode-provider';
import { BrowserWalletProvider } from '@/components/browser/browser-wallet-provider';
import { BrowserAuthProvider } from '@/components/browser/BrowserAuthProvider';
import { BrandFont } from '@/components/brand/BrandFont';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import type { ReactNode } from 'react';

function getAuthKitConfig() {
  if (typeof window !== 'undefined') {
    return {
      rpcUrl: 'https://mainnet.optimism.io',
      domain: window.location.hostname,
      siweUri: `${window.location.origin}/app`,
    };
  }
  return {
    rpcUrl: 'https://mainnet.optimism.io',
    domain: 'localhost',
    siweUri: 'http://localhost:3000/app',
  };
}

export function BrowserApp({ children }: { children: ReactNode }) {
  return (
    <BrowserWalletProvider>
      <AppModeProvider mode="browser">
        <BrowserAuthProvider>
          <AuthKitProvider config={getAuthKitConfig()}>
            <BrandFont className="min-h-screen">
              <DashboardLayout>{children}</DashboardLayout>
            </BrandFont>
          </AuthKitProvider>
        </BrowserAuthProvider>
      </AppModeProvider>
    </BrowserWalletProvider>
  );
}
