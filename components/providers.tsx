'use client'

import { FrameProvider } from '@/components/farcaster-provider'
import { MiniAppWalletProvider } from '@/components/wallet-provider'
import { AppModeProvider } from '@/components/app-mode-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MiniAppWalletProvider>
      <FrameProvider>
        <AppModeProvider mode="miniapp">{children}</AppModeProvider>
      </FrameProvider>
    </MiniAppWalletProvider>
  )
}
