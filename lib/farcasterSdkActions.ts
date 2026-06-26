import sdk from '@farcaster/miniapp-sdk';

/** Coerce API / Mongo values to a plain Farcaster fid for SDK postMessage. */
export function normalizeFid(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const n = parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if ('fid' in obj) return normalizeFid(obj.fid);
    if ('$numberLong' in obj) return normalizeFid(obj.$numberLong);
    if ('$numberInt' in obj) return normalizeFid(obj.$numberInt);
  }
  return null;
}

export async function miniAppViewProfile(rawFid: unknown): Promise<void> {
  const fid = normalizeFid(rawFid);
  if (!fid || fid <= 0) throw new Error('Invalid profile fid');
  await sdk.actions.viewProfile({ fid });
}

export async function miniAppViewCast(rawHash: unknown): Promise<void> {
  const hash = String(rawHash ?? '').trim();
  if (!hash) throw new Error('Invalid cast hash');
  await sdk.actions.viewCast({ hash });
}

export async function miniAppOpenUrl(url: string): Promise<void> {
  const clean = String(url ?? '').trim();
  if (!clean) return;
  await sdk.actions.openUrl(clean);
}

export async function miniAppOpenMiniApp(url: string): Promise<void> {
  const clean = String(url ?? '').trim();
  if (!clean) return;
  await sdk.actions.openMiniApp({ url: clean });
}
