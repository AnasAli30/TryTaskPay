/**
 * Farcaster client API: signed key requests (no Neynar).
 * @see https://docs.farcaster.xyz/reference/farcaster/signer-requests
 */
import * as ed from '@noble/ed25519';
import { mnemonicToAccount } from 'viem/accounts';
import { getFarcasterDeveloperMnemonic } from '@/lib/farcasterAppCredentials';

export const FARCASTER_CLIENT_API = 'https://api.farcaster.xyz';

/**
 * How long the SignedKeyRequest EIP-712 signature stays valid (Unix deadline = now + offset).
 * Farcaster recommends ~24h in docs; we default to ~90 days so users have time to approve.
 * Override with `SIGNED_KEY_REQUEST_DEADLINE_SECS` (seconds from signing time).
 * @see https://docs.farcaster.xyz/reference/farcaster/signer-requests
 */
export const SIGNED_KEY_REQUEST_DEFAULT_DEADLINE_OFFSET_SEC = 90 * 24 * 60 * 60;

/**
 * Unix timestamp (seconds) when the signed key request signature expires.
 * If `SIGNED_KEY_REQUEST_DEADLINE_SECS` is unset or invalid, uses {@link SIGNED_KEY_REQUEST_DEFAULT_DEADLINE_OFFSET_SEC}.
 */
export function getSignedKeyRequestDeadlineSec(nowSec?: number): number {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const raw = process.env.SIGNED_KEY_REQUEST_DEADLINE_SECS?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return now + n;
    }
  }
  return now + SIGNED_KEY_REQUEST_DEFAULT_DEADLINE_OFFSET_SEC;
}

const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
  name: 'Farcaster SignedKeyRequestValidator',
  version: '1',
  chainId: 10,
  verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553',
} as const;

const SIGNED_KEY_REQUEST_PRIMARY_TYPE = 'SignedKeyRequest' as const;
const SIGNED_KEY_REQUEST_TYPES = {
  SignedKeyRequest: [
    { name: 'requestFid', type: 'uint256' },
    { name: 'key', type: 'bytes' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function getAppFid(): number {
  const raw = process.env.APP_FID?.trim();
  if (!raw) throw new Error('APP_FID is not set');
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) throw new Error('APP_FID must be a positive number');
  return n;
}

export async function generateEd25519Keypair(): Promise<{
  privateKey: Uint8Array;
  publicKeyHex: `0x${string}`;
}> {
  const privateKey = ed.utils.randomSecretKey();
  const publicKeyBytes = await ed.getPublicKeyAsync(privateKey);
  const publicKeyHex = (`0x${Buffer.from(publicKeyBytes).toString('hex')}`) as `0x${string}`;
  return { privateKey, publicKeyHex };
}

export async function signSignedKeyRequestEip712(params: {
  publicKeyHex: `0x${string}`;
  deadlineSec: number;
}): Promise<`0x${string}`> {
  const mnemonic = getFarcasterDeveloperMnemonic();
  if (!mnemonic) {
    throw new Error('FARCASTER_DEVELOPER_MNEMONIC is not set');
  }
  const appFid = getAppFid();
  const account = mnemonicToAccount(mnemonic);
  const signature = await account.signTypedData({
    domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
    types: SIGNED_KEY_REQUEST_TYPES,
    primaryType: SIGNED_KEY_REQUEST_PRIMARY_TYPE,
    message: {
      requestFid: BigInt(appFid),
      key: params.publicKeyHex,
      deadline: BigInt(params.deadlineSec),
    },
  });

  // Debug: log the address derived from mnemonic and the APP_FID used
  console.log('[signer/signEIP712] mnemonic-derived address:', account.address);
  console.log('[signer/signEIP712] APP_FID:', appFid);
  console.log('[signer/signEIP712] publicKeyHex:', params.publicKeyHex);
  console.log('[signer/signEIP712] deadline:', params.deadlineSec);

  return signature as `0x${string}`;
}

export type SignedKeyRequestApiState = 'pending' | 'approved' | 'completed';

export type SignedKeyRequestPayload = {
  token: string;
  deeplinkUrl: string;
  key: string;
  state: SignedKeyRequestApiState;
  userFid?: number;
};

function unwrapSignedKeyRequest(data: unknown): SignedKeyRequestPayload | null {
  const r = data as { result?: { signedKeyRequest?: Record<string, unknown> } };
  const sk = r?.result?.signedKeyRequest;
  if (!sk || typeof sk !== 'object') return null;
  const token = sk.token;
  const deeplinkUrl = sk.deeplinkUrl;
  const key = sk.key;
  const state = sk.state;
  if (typeof token !== 'string' || typeof deeplinkUrl !== 'string' || typeof key !== 'string') {
    return null;
  }
  if (state !== 'pending' && state !== 'approved' && state !== 'completed') {
    return null;
  }
  const userFid = typeof sk.userFid === 'number' ? sk.userFid : undefined;
  return { token, deeplinkUrl, key, state, userFid };
}

/** `requestFid` = APP FID (the app requesting the key, NOT the user). The user approves via deeplink. */
export async function postSignedKeyRequest(params: {
  appFid: number;
  publicKeyHex: `0x${string}`;
  deadlineSec: number;
  signature: `0x${string}`;
}): Promise<SignedKeyRequestPayload> {
  const requestBody = {
    key: params.publicKeyHex,
    requestFid: params.appFid,
    signature: params.signature,
    deadline: params.deadlineSec,
  };
  console.log('[signer/postSignedKeyRequest] POST body:', JSON.stringify(requestBody));

  const res = await fetch(`${FARCASTER_CLIENT_API}/v2/signed-key-requests`, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const json = await res.json().catch(() => ({}));
  console.log('[signer/postSignedKeyRequest] Response status:', res.status);
  console.log('[signer/postSignedKeyRequest] Response body:', JSON.stringify(json));

  if (!res.ok) {
    const msg =
      typeof (json as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message === 'string'
        ? (json as { errors: Array<{ message: string }> }).errors[0].message
        : `signed-key-requests failed: ${res.status}`;
    throw new Error(msg);
  }
  const out = unwrapSignedKeyRequest(json);
  if (!out) {
    throw new Error('Invalid signed-key-requests response');
  }
  return out;
}

export async function getSignedKeyRequestByToken(
  token: string,
): Promise<SignedKeyRequestPayload | null> {
  const url = new URL(`${FARCASTER_CLIENT_API}/v2/signed-key-request`);
  url.searchParams.set('token', token);
  const res = await fetch(url.toString(), { method: 'GET', headers: { accept: 'application/json' } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;
  return unwrapSignedKeyRequest(json);
}
