import { getChainConfig, type SupportedChainId } from '@/lib/chainConfig';

export function toTokenWei(amount: number, chainId?: number | null): bigint {
  const config = getChainConfig(chainId);
  const factor = 10 ** config.token.decimals;
  return BigInt(Math.floor(amount * factor));
}

export function fromTokenWei(wei: bigint, chainId?: number | null): number {
  const config = getChainConfig(chainId);
  const factor = 10 ** config.token.decimals;
  return Number(wei) / factor;
}

export function getRpcUrl(chainId?: number | null): string {
  return getChainConfig(chainId).rpcUrls[0];
}

export async function chainJsonRpc<T>(
  chainId: SupportedChainId | number | null | undefined,
  method: string,
  params: unknown[],
): Promise<T> {
  const urls = getChainConfig(chainId).rpcUrls;
  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
      const data = (await res.json()) as { result?: T; error?: { message?: string } };
      if (data.error) throw new Error(data.error.message || 'RPC error');
      return data.result as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError ?? new Error('All RPC endpoints failed');
}
