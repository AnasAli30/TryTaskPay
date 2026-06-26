import type { CustomActionRequest } from '@/lib/types';
import { arbitrumRpc, celoRpc, isValidTxHash } from '@/lib/alchemyTxParser';
import { CELO_CHAIN_ID } from '@/lib/chainConfig';

const BLOCKSCOUT_APIS: Record<number, string> = {
  42161: 'https://arbitrum.blockscout.com/api/v2',
  42220: 'https://celo.blockscout.com/api/v2',
};
const MAX_TX_SCAN = 50;

type RpcTx = {
  from?: string;
  to?: string | null;
  input?: string;
};

type RpcLog = {
  address?: string;
  topics?: string[];
};

type RpcReceipt = {
  status?: string;
  logs?: RpcLog[];
};

type BlockscoutAddress = { hash?: string };

type BlockscoutTxItem = {
  hash?: string;
  timestamp?: string;
  from?: BlockscoutAddress;
};

type BlockscoutTxResponse = {
  items?: BlockscoutTxItem[];
  next_page_params?: Record<string, unknown> | null;
};

export interface EarnerTxVerification {
  txHash: string;
  from: string;
  matchedEventSignature: string;
}

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

function collectEventSignatures(action: CustomActionRequest): string[] {
  const sigs = new Set<string>();
  const primary = action.trackedEvent?.signature?.toLowerCase();
  if (primary) sigs.add(primary);
  for (const alt of action.alternateEvents ?? []) {
    if (alt.signature) sigs.add(alt.signature.toLowerCase());
  }
  return Array.from(sigs);
}

function parseBlockscoutTimestamp(raw: string | undefined): number | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function txMatchesFunctionSelector(tx: RpcTx, action: CustomActionRequest): boolean {
  const expected = action.functionSelector?.toLowerCase();
  if (!expected) return true;
  const input = tx.input || '0x';
  if (input.length < 10) return false;
  const selector = input.slice(0, 10).toLowerCase();
  const normalizedExpected = expected.startsWith('0x') ? expected : `0x${expected}`;
  return selector === normalizedExpected;
}

function receiptHasMatchingEvent(
  receipt: RpcReceipt,
  expectedContract: string,
  allowedEvents: string[],
): string | null {
  for (const log of receipt.logs ?? []) {
    const logAddress = normalizeAddress(log.address || '');
    const topic0 = log.topics?.[0]?.toLowerCase();
    if (!topic0) continue;
    if (logAddress !== expectedContract) continue;
    if (allowedEvents.includes(topic0)) return topic0;
  }
  return null;
}

function chainRpc<T>(chainId: number, method: string, params: unknown[]): Promise<T> {
  return chainId === CELO_CHAIN_ID ? celoRpc<T>(method, params) : arbitrumRpc<T>(method, params);
}

function getBlockscoutApi(chainId: number): string {
  return BLOCKSCOUT_APIS[chainId] ?? BLOCKSCOUT_APIS[42161];
}

/**
 * Verifies a single chain transaction matches the approved custom action config.
 */
export async function verifyEarnerTxMatchesAction(
  txHash: string,
  earnerAddress: string,
  action: CustomActionRequest,
): Promise<EarnerTxVerification> {
  const hash = txHash.trim().toLowerCase();
  if (!isValidTxHash(hash)) {
    throw new Error('Invalid transaction hash format.');
  }

  const chainId = action.chainId ?? 42161;
  const chainLabel = chainId === CELO_CHAIN_ID ? 'Celo' : 'Arbitrum';

  const normalizedEarner = normalizeAddress(earnerAddress);
  const expectedContract = normalizeAddress(action.contractAddress);
  const allowedEvents = collectEventSignatures(action);
  if (allowedEvents.length === 0) {
    throw new Error('Custom action has no tracked event configured.');
  }

  const [tx, receipt] = await Promise.all([
    chainRpc<RpcTx | null>(chainId, 'eth_getTransactionByHash', [hash]),
    chainRpc<RpcReceipt | null>(chainId, 'eth_getTransactionReceipt', [hash]),
  ]);

  if (!tx) throw new Error(`Transaction not found on ${chainLabel}.`);
  if (!receipt) throw new Error('Transaction receipt not found.');

  if (receipt.status !== '0x1') {
    throw new Error('Transaction failed on-chain.');
  }

  const txFrom = normalizeAddress(tx.from || '');
  if (txFrom !== normalizedEarner) {
    throw new Error('Transaction was not sent from your connected wallet.');
  }

  if (!txMatchesFunctionSelector(tx, action)) {
    throw new Error('Transaction does not call the required contract function.');
  }

  const matchedEventSignature = receiptHasMatchingEvent(receipt, expectedContract, allowedEvents);
  if (!matchedEventSignature) {
    throw new Error(
      'Transaction does not emit the required on-chain event for this task.',
    );
  }

  return {
    txHash: hash,
    from: txFrom,
    matchedEventSignature,
  };
}

async function fetchBlockscoutTxPage(
  wallet: string,
  chainId: number,
  nextPageParams?: Record<string, unknown> | null,
): Promise<BlockscoutTxResponse> {
  const params = new URLSearchParams({
    sort: 'block_number',
    order: 'desc',
  });
  if (nextPageParams) {
    for (const [key, value] of Object.entries(nextPageParams)) {
      if (value != null) params.set(key, String(value));
    }
  }
  const url = `${getBlockscoutApi(chainId)}/addresses/${wallet}/transactions?${params.toString()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Could not load wallet transactions. Try again in a moment.');
  }
  return (await res.json()) as BlockscoutTxResponse;
}

/**
 * Scans wallet transactions after `sinceMs` and returns the first matching tx.
 */
export async function findMatchingEarnerTxAfterTime(
  earnerAddress: string,
  action: CustomActionRequest,
  sinceMs: number,
): Promise<EarnerTxVerification | null> {
  const wallet = normalizeAddress(earnerAddress);
  const chainId = action.chainId ?? 42161;
  let nextPage: Record<string, unknown> | null | undefined = null;
  let scanned = 0;

  while (scanned < MAX_TX_SCAN) {
    const page = await fetchBlockscoutTxPage(wallet, chainId, nextPage);
    const items = page.items ?? [];
    if (items.length === 0) break;

    for (const item of items) {
      if (scanned >= MAX_TX_SCAN) break;

      const hash = item.hash?.toLowerCase();
      const from = item.from?.hash?.toLowerCase();
      if (!hash || !isValidTxHash(hash)) continue;
      if (from !== wallet) continue;

      const txTime = parseBlockscoutTimestamp(item.timestamp);
      if (txTime != null && txTime < sinceMs) {
        return null;
      }

      scanned += 1;
      try {
        const match = await verifyEarnerTxMatchesAction(hash, wallet, action);
        if (txTime == null || txTime >= sinceMs) {
          return match;
        }
      } catch {
        continue;
      }
    }

    nextPage = page.next_page_params;
    if (!nextPage) break;
  }

  return null;
}
