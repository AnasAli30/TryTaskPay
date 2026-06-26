import type { Db } from 'mongodb';

let indexesPromise: Promise<void> | null = null;

export function ensureFarcasterSignerIndexes(db: Db): Promise<void> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      await db.collection('farcasterUserSigners').createIndex({ userFid: 1 }, { unique: true });
      await db
        .collection('boostLiteAutoExecutions')
        .createIndex({ taskId: 1, userFid: 1 }, { unique: true });
    })().catch((err) => {
      indexesPromise = null;
      throw err;
    });
  }
  return indexesPromise;
}
