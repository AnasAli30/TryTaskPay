import { getDatabase } from '@/lib/mongodb';

export const X_OAUTH_STATE_COLLECTION = 'xOAuthStates';
const TTL_MS = 10 * 60 * 1000;

export interface XOAuthStateDoc {
  state: string;
  codeVerifier: string;
  walletAddress: string;
  returnTo: string;
  expiresAt: Date;
  createdAt: Date;
}

export async function ensureXOAuthStateIndexes(): Promise<void> {
  const db = await getDatabase();
  const col = db.collection(X_OAUTH_STATE_COLLECTION);
  await col.createIndex({ state: 1 }, { unique: true });
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

let indexesEnsured = false;

export async function saveXOAuthState(params: {
  state: string;
  codeVerifier: string;
  walletAddress: string;
  returnTo: string;
}): Promise<void> {
  if (!indexesEnsured) {
    indexesEnsured = true;
    await ensureXOAuthStateIndexes().catch((e) => {
      console.warn('[xOAuthState] index setup:', e);
    });
  }

  const db = await getDatabase();
  const now = new Date();
  await db.collection<XOAuthStateDoc>(X_OAUTH_STATE_COLLECTION).insertOne({
    state: params.state,
    codeVerifier: params.codeVerifier,
    walletAddress: params.walletAddress.toLowerCase(),
    returnTo: params.returnTo,
    expiresAt: new Date(now.getTime() + TTL_MS),
    createdAt: now,
  });
}

/** Atomically consume state (one-time use, prevents replay). */
export async function consumeXOAuthState(state: string): Promise<XOAuthStateDoc | null> {
  const db = await getDatabase();
  const doc = await db.collection<XOAuthStateDoc>(X_OAUTH_STATE_COLLECTION).findOneAndDelete({
    state,
    expiresAt: { $gt: new Date() },
  });
  return doc ?? null;
}
