import { createWalletClient, custom, type WalletClient } from 'viem';
import { arbitrum } from 'wagmi/chains';
import type { Config } from 'wagmi';
import { connect, getConnectorClient, reconnect } from 'wagmi/actions';

function normalizeAddr(addr: string) {
  return addr.toLowerCase();
}

/** Restore wagmi + injected wallet for dashboard txs when SIWE session outlives wagmi state. */
export async function ensureBrowserWalletClient(
  config: Config,
  expectedAddress?: string,
): Promise<{ address: `0x${string}`; walletClient: WalletClient } | null> {
  try {
    await reconnect(config);
  } catch {
    // ignore — may already be connected or no prior session
  }

  const tryConnectorClient = async (): Promise<{
    address: `0x${string}`;
    walletClient: WalletClient;
  } | null> => {
    try {
      const client = await getConnectorClient(config, { chainId: arbitrum.id });
      const addr = client.account?.address;
      if (!addr) return null;
      if (expectedAddress && normalizeAddr(addr) !== normalizeAddr(expectedAddress)) return null;
      return { address: addr, walletClient: client as unknown as WalletClient };
    } catch {
      return null;
    }
  };

  const existing = await tryConnectorClient();
  if (existing) return existing;

  const connector = config.connectors[0];
  if (connector) {
    try {
      await connect(config, { connector, chainId: arbitrum.id });
      const connected = await tryConnectorClient();
      if (connected) return connected;
    } catch {
      // user rejected or no provider
    }
  }

  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const provider = (window as any).ethereum;
      const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
      const raw = accounts[0];
      if (!raw) return null;
      const addr = raw as `0x${string}`;
      if (expectedAddress && normalizeAddr(addr) !== normalizeAddr(expectedAddress)) return null;
      const walletClient = createWalletClient({
        account: addr,
        chain: arbitrum,
        transport: custom(provider),
      });
      return { address: addr, walletClient };
    } catch {
      return null;
    }
  }

  return null;
}
