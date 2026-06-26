import {
  ARBITRUM_CHAIN_ID,
  CELO_CHAIN_ID,
  getChainConfig,
  type SupportedChainId,
} from '@/lib/chainConfig';
import { chainJsonRpc } from '@/lib/chainRpc';

export { ARBITRUM_CHAIN_ID, CELO_CHAIN_ID };

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55e4df523b3ef';

/** Public fallbacks — same pattern as creator-tasks escrow reads */
const PUBLIC_ARBITRUM_RPCS = [
  'https://arbitrum-one-rpc.publicnode.com',
  'https://rpc.ankr.com/arbitrum',
  'https://1rpc.io/arb',
] as const;

export interface ParsedTxEvent {
  logIndex: number;
  address: string;
  signature: string;
  name?: string;
  topics: string[];
}

export interface ParsedArbitrumTx {
  chainId: typeof ARBITRUM_CHAIN_ID;
  network: 'Arbitrum';
  txHash: string;
  from: string;
  contractAddress: string;
  functionSelector?: string;
  functionName?: string;
  status: 'success' | 'failed';
  events: ParsedTxEvent[];
  recommendedEvent: ParsedTxEvent;
}

function buildRpcEndpoints(): string[] {
  const endpoints: string[] = [];

  const direct = process.env.ALCHEMY_ARBITRUM_URL?.trim();
  if (direct) {
    // If user pasted only the key, build the full URL
    if (!direct.startsWith('http')) {
      endpoints.push(`https://arb-mainnet.g.alchemy.com/v2/${direct}`);
    } else {
      endpoints.push(direct.replace(/\/+$/, ''));
    }
  }

  const key = process.env.ALCHEMY_API_KEY?.trim();
  if (key && !key.startsWith('http')) {
    endpoints.push(`https://arb-mainnet.g.alchemy.com/v2/${key}`);
  }

  for (const pub of PUBLIC_ARBITRUM_RPCS) {
    if (!endpoints.includes(pub)) endpoints.push(pub);
  }

  return endpoints;
}

function isAuthRpcError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('must be authenticated') ||
    m.includes('invalid api key') ||
    m.includes('unauthorized') ||
    m.includes('forbidden')
  );
}

async function jsonRpc<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }

  const data = (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
  if (data.error) {
    throw new Error(data.error.message || 'RPC error');
  }
  return data.result as T;
}

export async function arbitrumRpc<T>(method: string, params: unknown[]): Promise<T> {
  const endpoints = buildRpcEndpoints();
  let lastError: Error | null = null;

  for (const url of endpoints) {
    try {
      return await jsonRpc<T>(url, method, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(message);
      // Bad/missing Alchemy key — try next endpoint (public RPC)
      if (isAuthRpcError(message) || message.includes('RPC HTTP 401') || message.includes('RPC HTTP 403')) {
        continue;
      }
      // Rate limit on one provider — try next
      if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
        continue;
      }
      throw lastError;
    }
  }

  if (lastError && isAuthRpcError(lastError.message)) {
    throw new Error(
      'Alchemy API key is invalid or missing. Fix ALCHEMY_API_KEY / ALCHEMY_ARBITRUM_URL in .env, or rely on the public RPC fallback.',
    );
  }

  throw lastError ?? new Error('All Arbitrum RPC endpoints failed.');
}

export function isValidTxHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash.trim());
}

function signatureLabel(textSignature?: string): string | undefined {
  if (!textSignature) return undefined;
  const open = textSignature.indexOf('(');
  return open > 0 ? textSignature.slice(0, open) : textSignature;
}

async function lookupFunctionName(selector: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.4byte.directory/api/v1/signatures/?hex_signature=${encodeURIComponent(selector)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { results?: { text_signature?: string }[] };
    return signatureLabel(data.results?.[0]?.text_signature);
  } catch {
    return undefined;
  }
}

async function lookupEventName(topic: string): Promise<string | undefined> {
  try {
    const res = await fetch(
      `https://www.4byte.directory/api/v1/event-signatures/?hex_signature=${encodeURIComponent(topic)}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return undefined;
    const data = (await res.json()) as { results?: { text_signature?: string }[] };
    return signatureLabel(data.results?.[0]?.text_signature);
  } catch {
    return undefined;
  }
}

async function enrichEventNames(events: ParsedTxEvent[]): Promise<void> {
  const uniqueTopics = Array.from(new Set(events.map((e) => e.signature)));
  const names = await Promise.all(uniqueTopics.map((topic) => lookupEventName(topic)));
  const byTopic = new Map(uniqueTopics.map((topic, i) => [topic, names[i]]));
  for (const event of events) {
    const resolved = byTopic.get(event.signature);
    if (resolved) event.name = resolved;
  }
}

type RpcTx = {
  from?: string;
  to?: string | null;
  input?: string;
};

type RpcLog = {
  address?: string;
  topics?: string[];
  logIndex?: string;
};

type RpcReceipt = {
  status?: string;
  logs?: RpcLog[];
};

function parseLog(log: RpcLog, index: number): ParsedTxEvent | null {
  const topics = log.topics || [];
  if (topics.length === 0) return null;
  const signature = topics[0].toLowerCase();
  const logIndex = log.logIndex != null ? parseInt(String(log.logIndex), 16) : index;
  return {
    logIndex,
    address: (log.address || '').toLowerCase(),
    signature,
    name: `Event_${signature.slice(2, 10)}`,
    topics,
  };
}

function pickRecommendedEvent(
  events: ParsedTxEvent[],
  contractAddress: string,
): ParsedTxEvent {
  const target = contractAddress.toLowerCase();
  const fromContract = events.filter(
    (e) => e.address === target && e.signature !== ERC20_TRANSFER_TOPIC,
  );
  if (fromContract.length > 0) return fromContract[0];
  const nonTransfer = events.filter((e) => e.signature !== ERC20_TRANSFER_TOPIC);
  if (nonTransfer.length > 0) return nonTransfer[0];
  return events[0];
}

export async function parseArbitrumTx(txHash: string): Promise<ParsedArbitrumTx> {
  const hash = txHash.trim().toLowerCase();
  if (!isValidTxHash(hash)) {
    throw new Error('Invalid transaction hash format.');
  }

  const [tx, receipt] = await Promise.all([
    arbitrumRpc<RpcTx | null>('eth_getTransactionByHash', [hash]),
    arbitrumRpc<RpcReceipt | null>('eth_getTransactionReceipt', [hash]),
  ]);

  if (!tx) throw new Error('Transaction not found on Arbitrum.');
  if (!receipt) throw new Error('Transaction receipt not found.');

  const status = receipt.status === '0x1' ? 'success' : 'failed';
  if (status === 'failed') {
    throw new Error('Transaction failed on-chain. Use a successful example transaction.');
  }

  const input = tx.input || '0x';
  const functionSelector =
    input.length >= 10 && input !== '0x' ? input.slice(0, 10).toLowerCase() : undefined;

  let contractAddress = (tx.to || '').toLowerCase();
  const events = (receipt.logs || [])
    .map((log, i) => parseLog(log, i))
    .filter((e): e is ParsedTxEvent => e != null);

  if (!contractAddress && events.length > 0) {
    contractAddress = events[0].address;
  }

  if (!contractAddress) {
    throw new Error('No contract interaction detected in this transaction.');
  }

  const [functionName] = await Promise.all([
    functionSelector ? lookupFunctionName(functionSelector) : Promise.resolve(undefined),
    enrichEventNames(events),
  ]);
  const recommendedEvent = pickRecommendedEvent(events, contractAddress);

  if (events.length === 0) {
    throw new Error('No events found in transaction receipt.');
  }

  return {
    chainId: ARBITRUM_CHAIN_ID,
    network: 'Arbitrum',
    txHash: hash,
    from: (tx.from || '').toLowerCase(),
    contractAddress,
    functionSelector,
    functionName,
    status,
    events,
    recommendedEvent,
  };
}

export interface ParsedCeloTx {
  chainId: typeof CELO_CHAIN_ID;
  network: 'Celo';
  txHash: string;
  from: string;
  contractAddress: string;
  functionSelector?: string;
  functionName?: string;
  status: 'success' | 'failed';
  events: ParsedTxEvent[];
  recommendedEvent: ParsedTxEvent;
}

export async function celoRpc<T>(method: string, params: unknown[]): Promise<T> {
  return chainJsonRpc<T>(CELO_CHAIN_ID, method, params);
}

export async function parseCeloTx(txHash: string): Promise<ParsedCeloTx> {
  const hash = txHash.trim().toLowerCase();
  if (!isValidTxHash(hash)) {
    throw new Error('Invalid transaction hash format.');
  }

  const [tx, receipt] = await Promise.all([
    celoRpc<RpcTx | null>('eth_getTransactionByHash', [hash]),
    celoRpc<RpcReceipt | null>('eth_getTransactionReceipt', [hash]),
  ]);

  if (!tx) throw new Error('Transaction not found on Celo.');
  if (!receipt) throw new Error('Transaction receipt not found.');

  const status = receipt.status === '0x1' ? 'success' : 'failed';
  if (status === 'failed') {
    throw new Error('Transaction failed on-chain. Use a successful example transaction.');
  }

  const input = tx.input || '0x';
  const functionSelector =
    input.length >= 10 && input !== '0x' ? input.slice(0, 10).toLowerCase() : undefined;

  let contractAddress = (tx.to || '').toLowerCase();
  const events = (receipt.logs || [])
    .map((log, i) => parseLog(log, i))
    .filter((e): e is ParsedTxEvent => e != null);

  if (!contractAddress && events.length > 0) {
    contractAddress = events[0].address;
  }

  if (!contractAddress) {
    throw new Error('No contract interaction detected in this transaction.');
  }

  const [functionName] = await Promise.all([
    functionSelector ? lookupFunctionName(functionSelector) : Promise.resolve(undefined),
    enrichEventNames(events),
  ]);
  const recommendedEvent = pickRecommendedEvent(events, contractAddress);

  if (events.length === 0) {
    throw new Error('No events found in transaction receipt.');
  }

  return {
    chainId: CELO_CHAIN_ID,
    network: 'Celo',
    txHash: hash,
    from: (tx.from || '').toLowerCase(),
    contractAddress,
    functionSelector,
    functionName,
    status,
    events,
    recommendedEvent,
  };
}

export type ParsedChainTx = ParsedArbitrumTx | ParsedCeloTx;

export async function parseTx(
  txHash: string,
  chainId: SupportedChainId | number = ARBITRUM_CHAIN_ID,
): Promise<ParsedChainTx> {
  if (chainId === CELO_CHAIN_ID) return parseCeloTx(txHash);
  return parseArbitrumTx(txHash);
}
