import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, WagmiProvider, createConfig } from 'wagmi'
import { arbitrum, celo } from 'wagmi/chains'

export const miniAppConfig = createConfig({
  chains: [arbitrum, celo],
  transports: {
    [arbitrum.id]: http(),
    [celo.id]: http(),
  },
  connectors: [miniAppConnector()],
} as any)

const queryClient = new QueryClient()

export function MiniAppWalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WagmiProvider config={miniAppConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

/** @deprecated use MiniAppWalletProvider */
export function WalletProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return <MiniAppWalletProvider>{children}</MiniAppWalletProvider>
}

export const config = miniAppConfig
