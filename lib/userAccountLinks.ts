import { getDatabase } from '@/lib/mongodb';
import type { UserAccountLink } from '@/lib/types';

export const USER_ACCOUNT_LINKS_COLLECTION = 'userAccountLinks';

export async function ensureUserAccountLinkIndexes(): Promise<void> {
  const db = await getDatabase();
  const col = db.collection(USER_ACCOUNT_LINKS_COLLECTION);
  await col.createIndex({ walletAddress: 1 }, { unique: true });
  await col.createIndex({ fid: 1 }, { unique: true, sparse: true });
  await col.createIndex({ username: 1 }, { unique: true, sparse: true });
}

export async function getUserByWallet(walletAddress: string): Promise<UserAccountLink | null> {
  const db = await getDatabase();
  return db
    .collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION)
    .findOne({ walletAddress: walletAddress.toLowerCase() });
}

export async function getUserByFid(fid: number): Promise<UserAccountLink | null> {
  const db = await getDatabase();
  return db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).findOne({ fid });
}

export async function upsertWalletUser(walletAddress: string): Promise<UserAccountLink> {
  const db = await getDatabase();
  const normalized = walletAddress.toLowerCase();
  const now = new Date();
  await db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).updateOne(
    { walletAddress: normalized },
    {
      $setOnInsert: { walletAddress: normalized, walletVerifiedAt: now },
      $set: { updatedAt: now },
    },
    { upsert: true },
  );
  const doc = await getUserByWallet(normalized);
  return doc!;
}

export async function linkFidToWallet(
  walletAddress: string,
  fid: number,
): Promise<UserAccountLink | null> {
  const db = await getDatabase();
  const normalized = walletAddress.toLowerCase();
  const existingFid = await getUserByFid(fid);
  if (existingFid && existingFid.walletAddress !== normalized) {
    throw new Error('FID_ALREADY_LINKED');
  }
  const now = new Date();
  await db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).updateOne(
    { walletAddress: normalized },
    {
      $set: { fid, farcasterLinkedAt: now, updatedAt: now },
      $setOnInsert: { walletAddress: normalized, walletVerifiedAt: now },
    },
    { upsert: true },
  );
  return getUserByWallet(normalized);
}

export async function linkXToWallet(
  walletAddress: string,
  xUsername: string,
  xUserId: string,
): Promise<UserAccountLink | null> {
  const db = await getDatabase();
  const normalized = walletAddress.toLowerCase();
  const now = new Date();
  await db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).updateOne(
    { walletAddress: normalized },
    {
      $set: {
        xUsername: xUsername.replace(/^@/, '').toLowerCase(),
        xUserId,
        xLinkedAt: now,
        updatedAt: now,
      },
      $setOnInsert: { walletAddress: normalized, walletVerifiedAt: now },
    },
    { upsert: true },
  );
  return getUserByWallet(normalized);
}

export async function unlinkXFromWallet(walletAddress: string): Promise<void> {
  const db = await getDatabase();
  await db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).updateOne(
    { walletAddress: walletAddress.toLowerCase() },
    {
      $unset: { xUsername: '', xUserId: '', xLinkedAt: '' },
      $set: { updatedAt: new Date() },
    },
  );
}

export async function updateUserProfile(
  walletAddress: string,
  updates: Partial<Pick<UserAccountLink, 'displayName' | 'username' | 'pfpUrl' | 'email'>>,
): Promise<UserAccountLink | null> {
  const db = await getDatabase();
  const normalized = walletAddress.toLowerCase();
  const $set: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.displayName !== undefined) $set.displayName = updates.displayName;
  if (updates.username !== undefined) $set.username = updates.username.toLowerCase();
  if (updates.pfpUrl !== undefined) $set.pfpUrl = updates.pfpUrl;
  if (updates.email !== undefined) {
    $set.email = updates.email;
    $set.emailVerified = false;
  }
  await db.collection<UserAccountLink>(USER_ACCOUNT_LINKS_COLLECTION).updateOne(
    { walletAddress: normalized },
    { $set },
  );
  return getUserByWallet(normalized);
}

export async function isUsernameTaken(username: string, excludeWallet?: string): Promise<boolean> {
  const db = await getDatabase();
  const query: Record<string, unknown> = { username: username.toLowerCase() };
  if (excludeWallet) {
    query.walletAddress = { $ne: excludeWallet.toLowerCase() };
  }
  const doc = await db.collection(USER_ACCOUNT_LINKS_COLLECTION).findOne(query);
  return !!doc;
}
