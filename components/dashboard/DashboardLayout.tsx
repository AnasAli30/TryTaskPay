'use client';

import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { AuthGate } from '@/components/dashboard/AuthGate';
import { AuthGateProvider } from '@/components/dashboard/AuthContext';
import { XOAuthCallbackToast } from '@/components/browser/XOAuthCallbackToast';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGateProvider>
      <div className="min-h-screen bg-gradient-to-b from-white via-gray-50/50 to-white text-black antialiased">
        <DashboardNav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-16">
          {children}
        </main>
        <AuthGate />
        <Suspense fallback={null}>
          <XOAuthCallbackToast />
        </Suspense>
      </div>
    </AuthGateProvider>
  );
}
