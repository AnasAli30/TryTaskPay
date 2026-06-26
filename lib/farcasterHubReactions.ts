/**
 * Submit ReactionAdd to the network (Ed25519 signer from signed-key request).
 *
 * Prefers Neynar HTTPS `submitMessage` (port 443) so it works on Vercel/serverless where
 * outbound TCP to gRPC :2283 often hits ETIMEDOUT. gRPC is optional fallback.
 */
import {
  FarcasterNetwork,
  HubError,
  Message,
  NobleEd25519Signer,
  ReactionType,
  getSSLHubRpcClient,
  makeReactionAdd,
} from '@farcaster/hub-nodejs';
import { hexToBytes } from 'viem';
import { getAllNeynarApiKeys } from '@/lib/neynar';

/**
 * Neynar Snapchain hub HTTP API (raw protobuf body).
 * @see https://docs.neynar.com/reference/publish-message
 */
const DEFAULT_NEYNAR_SUBMIT_MESSAGE_URL = 'https://snapchain-api.neynar.com/v1/submitMessage';

function getNeynarSubmitMessageUrl(): string {
  return process.env.NEYNAR_SUBMIT_MESSAGE_URL?.trim() || DEFAULT_NEYNAR_SUBMIT_MESSAGE_URL;
}

/**
 * Public gRPC hub (fallback only). Serverless often cannot reach :2283.
 * Override with `FARCASTER_HUB_GRPC` if you self-host a writer.
 */
const DEFAULT_HUB_GRPC = 'hub-api.neynar.com:2283';

export function getFarcasterHubGrpcAddress(): string {
  return process.env.FARCASTER_HUB_GRPC?.trim() || DEFAULT_HUB_GRPC;
}

function httpSubmitDuplicateOk(status: number, body: string): boolean {
  const low = body.toLowerCase();
  if (status === 409) return true;
  return (
    low.includes('duplicate') ||
    low.includes('already') ||
    low.includes('conflict') ||
    low.includes('bad_request.duplicate')
  );
}

/**
 * POST signed protobuf Message to Neynar; tries rotated API keys on retryable failures.
 */
async function submitMessageViaNeynarHttp(signed: Message): Promise<{ ok: true } | { ok: false; detail: string }> {
  const url = getNeynarSubmitMessageUrl();
  const bytes = Message.encode(signed).finish();
  const bodyBuf = Buffer.from(bytes);
  let lastDetail = '';

  let keys: string[];
  try {
    keys = getAllNeynarApiKeys();
  } catch {
    return { ok: false, detail: 'No NEYNAR_API_KEY configured for HTTPS submit' };
  }

  for (const apiKey of keys) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'x-api-key': apiKey,
      },
      body: bodyBuf,
      cache: 'no-store',
    });

    if (res.ok) {
      return { ok: true };
    }

    const text = await res.text().catch(() => '');
    if (httpSubmitDuplicateOk(res.status, text)) {
      return { ok: true };
    }

    lastDetail = `HTTP ${res.status} ${text.slice(0, 800)}`;

    const retry =
      res.status >= 500 ||
      res.status === 401 ||
      res.status === 402 ||
      res.status === 403 ||
      res.status === 408 ||
      res.status === 429;
    if (!retry) {
      return { ok: false, detail: lastDetail };
    }
  }

  return { ok: false, detail: lastDetail || 'Neynar submitMessage failed for all keys' };
}

function normalizeCastHash(hashOrUrl: string): `0x${string}` {
  const t = hashOrUrl.trim();
  if (t.startsWith('http')) {
    throw new Error('Cast URL not supported for hub reaction; pass hash');
  }
  const h = t.startsWith('0x') ? t : `0x${t}`;
  return h as `0x${string}`;
}

function castHashToBytes(hex: `0x${string}`): Uint8Array {
  const bytes = hexToBytes(hex);
  if (bytes.length !== 20) {
    throw new Error(`Invalid cast hash length: ${bytes.length}`);
  }
  return bytes;
}

function submitDuplicateOk(err: unknown): boolean {
  return (
    err instanceof HubError &&
    (err.errCode === 'bad_request.duplicate' || err.errCode === 'bad_request.conflict')
  );
}

export async function hubPublishReaction(params: {
  privateKey32: Uint8Array;
  userFid: number;
  targetAuthorFid: number;
  castHash: string;
  reactionType: 'like' | 'recast';
}): Promise<{ success: boolean; message?: string }> {
  const hashHex = normalizeCastHash(params.castHash);
  const hashBytes = castHashToBytes(hashHex);
  const signer = new NobleEd25519Signer(params.privateKey32);
  const type =
    params.reactionType === 'like' ? ReactionType.LIKE : ReactionType.RECAST;

  const body = {
    type,
    targetCastId: {
      fid: params.targetAuthorFid,
      hash: hashBytes,
    },
  };

  const msgResult = await makeReactionAdd(
    body,
    {
      fid: params.userFid,
      network: FarcasterNetwork.MAINNET,
    },
    signer,
  );

  if (msgResult.isErr()) {
    return {
      success: false,
      message: msgResult.error.message,
    };
  }
  const message = msgResult.value;

  const http = await submitMessageViaNeynarHttp(message);
  if (http.ok) {
    return { success: true };
  }

  const skipGrpc = process.env.FARCASTER_HUB_GRPC_DISABLED === '1';
  if (skipGrpc) {
    return { success: false, message: http.detail };
  }

  console.warn('[hubPublishReaction] HTTPS submit failed, trying gRPC:', http.detail);

  const client = getSSLHubRpcClient(getFarcasterHubGrpcAddress());
  try {
    const submitResult = await client.submitMessage(message);
    if (submitResult.isOk()) {
      return { success: true };
    }
    const err = submitResult.error;
    if (submitDuplicateOk(err)) {
      return { success: true };
    }
    return { success: false, message: err.message };
  } finally {
    try {
      (client as { $?: { close(): void } }).$?.close();
    } catch {
      /* ignore */
    }
  }
}
