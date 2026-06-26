'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, WagmiProvider, createConfig, createConnector } from 'wagmi';
import { arbitrum, celo } from 'wagmi/chains';

/** Minimal injected connector — avoids wagmi/connectors barrel (optional peer deps). */
function injectedConnector() {
  return createConnector((config) => ({
    id: 'injected',
    name: 'Browser Wallet',
    type: 'injected' as const,
    async setup() {},
    async connect(params: { chainId?: number } = {}) {
      const { chainId } = params;
      const provider = await this.getProvider();
      if (!provider) throw new Error('No wallet found');
      const accounts = (await provider.request({
        method: 'eth_requestAccounts',
      })) as `0x${string}`[];
      const currentChainId = await this.getChainId();
      let switchChainId = chainId;
      if (chainId && currentChainId !== chainId) {
        await this.switchChain?.({ chainId });
        switchChainId = chainId;
      }
      return {
        accounts,
        chainId: switchChainId ?? currentChainId,
      };
    },
    async disconnect() {},
    async getAccounts() {
      const provider = await this.getProvider();
      if (!provider) return [];
      return (await provider.request({ method: 'eth_accounts' })) as `0x${string}`[];
    },
    async getChainId() {
      const provider = await this.getProvider();
      if (!provider) return config.chains[0].id;
      const hex = (await provider.request({ method: 'eth_chainId' })) as string;
      return Number(hex);
    },
    async getProvider() {
      if (typeof window === 'undefined') return undefined;
      return (window as any).ethereum;
    },
    async switchChain({ chainId }: { chainId: number }) {
      const provider = await this.getProvider();
      if (!provider) throw new Error('No wallet found');
      const hex = `0x${chainId.toString(16)}`;
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hex }],
        });
      } catch (err: any) {
        if (err?.code === 4902) {
          const chainParams =
            chainId === celo.id
              ? {
                  chainId: hex,
                  chainName: 'Celo',
                  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                  rpcUrls: ['https://forno.celo.org'],
                  blockExplorerUrls: ['https://celoscan.io'],
                }
              : {
                  chainId: hex,
                  chainName: 'Arbitrum One',
                  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                  rpcUrls: ['https://arb1.arbitrum.io/rpc'],
                  blockExplorerUrls: ['https://arbiscan.io'],
                };
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [chainParams],
          });
        } else {
          throw err;
        }
      }
      return { id: chainId } as const;
    },
    async isAuthorized() {
      const accounts = await this.getAccounts();
      return accounts.length > 0;
    },
    onAccountsChanged(accounts: string[]) {
      if (accounts.length === 0) config.emitter.emit('disconnect');
      else config.emitter.emit('change', { accounts: accounts as `0x${string}`[] });
    },
    onChainChanged(chain: string) {
      config.emitter.emit('change', { chainId: Number(chain) });
    },
    onDisconnect() {
      config.emitter.emit('disconnect');
    },
  } as any));
}

export const browserWalletConfig = createConfig({
  chains: [arbitrum, celo],
  transports: {
    [arbitrum.id]: http(),
    [celo.id]: http(),
  },
  connectors: [injectedConnector()],
} as any);

const queryClient = new QueryClient();

export function BrowserWalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={browserWalletConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
