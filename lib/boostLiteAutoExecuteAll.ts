/**
 * Server-side orchestrator: auto-execute like + recast for every opted-in user
 * when a boost_lite task becomes active.
 *
 * Called fire-and-forget from confirm-deposit after the task status flips to 'active'.
 * Processes users in parallel batches (default 5) with a pause between batches.
 */
import type { Collection, Document, Filter } from 'mongodb';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, FarcasterUserSignerDoc, BoostLiteAutoExecutionDoc, TaskCompletion } from '@/lib/types';
import { isReadyNativeSigner } from '@/lib/farcasterSignerReady';
import { decryptEd25519PrivateKey, getSignerEncryptionSecret } from '@/lib/signerKeyEncryption';
import { hubPublishReaction } from '@/lib/farcasterHubReactions';
import { lookupCastByHashOrUrl } from '@/lib/api';
import { fetchFollowerCountsByFids } from '@/lib/neynar';
import { checkEligibilityForTask } from '@/lib/taskEligibility';

/** Users processed concurrently per batch (hub + rate limits). */
const BATCH_SIZE = Math.max(1, Math.min(25, Number.parseInt(process.env.BOOST_LITE_BATCH_SIZE || '5', 10) || 5));

/** Pause between batches (ms). */
const INTER_BATCH_DELAY_MS = Math.max(
  0,
  Number.parseInt(process.env.BOOST_LITE_INTER_BATCH_MS || '1000', 10) || 1000,
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Atomically append userFid to completedBy only if a slot exists and FID not already listed.
 * Safe under parallel batch workers.
 */
async function atomicPushCompletedBy(
  tasksCol: Collection<BountyTask>,
  _id: ObjectId,
  userFid: number,
): Promise<boolean> {
  const filter: Filter<Document> = {
    _id,
    $expr: {
      $and: [
        {
          $or: [
            { $lte: [{ $ifNull: ['$maxCompletions', 0] }, 0] },
            {
              $lt: [
                { $size: { $ifNull: ['$completedBy', []] } },
                { $ifNull: ['$maxCompletions', 0] },
              ],
            },
          ],
        },
        {
          $eq: [{ $indexOfArray: [{ $ifNull: ['$completedBy', []] }, userFid] }, -1],
        },
      ],
    },
  };

  const r = await tasksCol.updateOne(filter, { $push: { completedBy: userFid } });
  return r.modifiedCount === 1;
}

export type BoostLiteCatchupStats = {
  taskId: string;
  taskType: string;
  taskStatus?: string;
  /** Slots used on this task */
  completedCount: number;
  /** Creator-configured cap; null = unlimited */
  maxCompletions: number | null;
  /** Remaining slots if capped; null if unlimited */
  slotsRemaining: number | null;
  /** Opted-in + approved signers (global) */
  optedInApprovedCount: number;
  /** Eligible for this task (not creator, has native signer, not already in completedBy) */
  eligibleRemainingCount: number;
  /** Exec rows for this task where like or recast not done */
  execIncompleteCount: number;
};

/**
 * Read-only stats for dashboards / catch-up: how many users left, slots left, etc.
 */
export async function getBoostLiteAutoCatchupStats(taskId: string | ObjectId): Promise<BoostLiteCatchupStats | null> {
  const _id = typeof taskId === 'string' ? new ObjectId(taskId) : taskId;
  const db = await getDatabase();
  const tasksCol = db.collection<BountyTask>('tasks');
  const task = await tasksCol.findOne({ _id } as any);
  if (!task) return null;

  const taskIdStr = _id.toHexString();
  const completedBy = task.completedBy ?? [];
  const completedCount = completedBy.length;
  const max = task.maxCompletions ?? 0;
  const maxCompletions = max > 0 ? max : null;
  const slotsRemaining =
    max > 0 ? Math.max(0, max - completedCount) : null;

  const signerCol = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');
  const signers = await signerCol.find({ autoBoostOptIn: true, signerStatus: 'approved' }).toArray();

  let eligibleRemainingCount = 0;
  const completedSet = new Set(completedBy);
  for (const s of signers) {
    const fid = s.userFid;
    if (fid === task.creatorFid) continue;
    if (completedSet.has(fid)) continue;
    if (!isReadyNativeSigner(s) || !s.encryptedEd25519PrivateKey) continue;
    eligibleRemainingCount++;
  }

  const execCol = db.collection<BoostLiteAutoExecutionDoc>('boostLiteAutoExecutions');
  const execIncompleteCount = await execCol.countDocuments({
    taskId: _id,
    $or: [{ likeDone: false }, { recastDone: false }],
  });

  return {
    taskId: taskIdStr,
    taskType: task.type,
    taskStatus: task.status,
    completedCount,
    maxCompletions,
    slotsRemaining,
    optedInApprovedCount: signers.length,
    eligibleRemainingCount,
    execIncompleteCount,
  };
}

export async function autoExecuteBoostLiteForAll(
  taskId: string | ObjectId,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const _id = typeof taskId === 'string' ? new ObjectId(taskId) : taskId;
  const db = await getDatabase();

  const tasksCol = db.collection<BountyTask>('tasks');
  const task = await tasksCol.findOne({ _id } as any);

  if (!task) {
    console.warn('[auto-boost] Task not found:', _id.toHexString());
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  if (task.type !== 'boost_lite') {
    console.warn('[auto-boost] Not a boost_lite task, skipping');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  if (task.status !== 'active') {
    console.warn('[auto-boost] Task not active, skipping');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  if (!task.castHash) {
    console.warn('[auto-boost] No castHash on task, skipping');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const castHashBounty = task.castHash;
  const creatorFidBounty = task.creatorFid;

  const castMeta = await lookupCastByHashOrUrl(castHashBounty.trim(), 'hash');
  const targetAuthorFid = castMeta?.author?.fid;
  if (typeof targetAuthorFid !== 'number') {
    console.error('[auto-boost] Could not resolve cast author for', castHashBounty);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const signerCol = db.collection<FarcasterUserSignerDoc>('farcasterUserSigners');
  const signers = await signerCol
    .find({ autoBoostOptIn: true, signerStatus: 'approved' })
    .toArray();

  if (signers.length === 0) {
    console.log('[auto-boost] No opted-in users found');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const encSecretRaw = getSignerEncryptionSecret();
  if (!encSecretRaw) {
    console.error('[auto-boost] SIGNER_ENCRYPTION_SECRET not set');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  const encSecret: string = encSecretRaw;

  const execCol = db.collection<BoostLiteAutoExecutionDoc>('boostLiteAutoExecutions');
  const completionsCol = db.collection<TaskCompletion>('taskCompletions');
  const taskIdStr = _id.toHexString();

  const maxCompletions = task.maxCompletions ?? 0;

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  type RunStats = { processed: number; succeeded: number; failed: number };

  /** One user: like + recast + DB; uses atomic completedBy when both reactions OK. */
  async function runOneUser(signer: FarcasterUserSignerDoc): Promise<RunStats> {
    const userFid = signer.userFid;

    const fresh = await tasksCol.findOne({ _id } as any);
    if (!fresh || fresh.status !== 'active') return { processed: 0, succeeded: 0, failed: 0 };

    const completedSet = new Set(fresh.completedBy ?? []);
    if (userFid === fresh.creatorFid) return { processed: 0, succeeded: 0, failed: 0 };
    if (completedSet.has(userFid)) return { processed: 0, succeeded: 0, failed: 0 };

    if (maxCompletions > 0 && (fresh.completedBy?.length ?? 0) >= maxCompletions) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    if (!isReadyNativeSigner(signer) || !signer.encryptedEd25519PrivateKey) {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    const encryptedPk = signer.encryptedEd25519PrivateKey;

    try {
      const privateKey32 = decryptEd25519PrivateKey(encSecret, encryptedPk);

      let exec = await execCol.findOne({ taskId: _id, userFid });
      if (!exec) {
        await execCol.insertOne({
          taskId: _id,
          userFid,
          castHash: castHashBounty,
          likeDone: false,
          recastDone: false,
          updatedAt: new Date(),
        });
        exec = (await execCol.findOne({ taskId: _id, userFid }))!;
      }

      let likeDone = exec.likeDone;
      let recastDone = exec.recastDone;
      const messages: string[] = [];

      if (!likeDone) {
        const r = await hubPublishReaction({
          privateKey32,
          userFid,
          targetAuthorFid,
          castHash: castHashBounty,
          reactionType: 'like',
        });
        if (r.success) {
          likeDone = true;
        } else {
          const low = (r.message || '').toLowerCase();
          if (low.includes('already') || low.includes('duplicate') || low.includes('exist')) {
            likeDone = true;
          } else {
            messages.push(r.message || 'Like failed');
          }
        }
      }

      if (!recastDone) {
        const r = await hubPublishReaction({
          privateKey32,
          userFid,
          targetAuthorFid,
          castHash: castHashBounty,
          reactionType: 'recast',
        });
        if (r.success) {
          recastDone = true;
        } else {
          const low = (r.message || '').toLowerCase();
          if (low.includes('already') || low.includes('duplicate') || low.includes('exist')) {
            recastDone = true;
          } else {
            messages.push(r.message || 'Recast failed');
          }
        }
      }

      await execCol.updateOne(
        { taskId: _id, userFid },
        {
          $set: {
            likeDone,
            recastDone,
            lastError: messages.length ? messages.join('; ') : undefined,
            updatedAt: new Date(),
          },
        },
      );

      const reactionsOk = likeDone && recastDone;
      if (!reactionsOk) {
        console.warn(`[auto-boost] ✗ FID ${userFid} — ${messages.join(', ')}`);
        return { processed: 1, succeeded: 0, failed: 1 };
      }

      const gotSlot = await atomicPushCompletedBy(tasksCol, _id, userFid);
      if (!gotSlot) {
        console.warn(
          `[auto-boost] FID ${userFid} — reactions OK but task full or already completed (no slot)`,
        );
        return { processed: 1, succeeded: 0, failed: 1 };
      }

      const existingCompletion = await completionsCol.findOne({ taskId: taskIdStr, userFid });
      if (!existingCompletion) {
        const completion: TaskCompletion = {
          taskId: taskIdStr,
          userFid,
          creatorFid: creatorFidBounty,
          status: 'pending',
          claimStatus: 'unclaimed',
          submittedAt: new Date(),
          verifyTxHash: 'auto-boost',
        };
        await completionsCol.insertOne(completion);
      }

      console.log(`[auto-boost] ✓ FID ${userFid} — like+recast done`);
      return { processed: 1, succeeded: 1, failed: 0 };
    } catch (err) {
      console.error(`[auto-boost] Error for FID ${userFid}:`, err);
      return { processed: 1, succeeded: 0, failed: 1 };
    }
  }

  // Build ordered queue: eligible signers only, highest Farcaster follower_count first.
  const initial = await tasksCol.findOne({ _id } as any);
  if (!initial?.castHash) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  const initialCompleted = new Set(initial.completedBy ?? []);
  const candidates: FarcasterUserSignerDoc[] = [];
  for (const signer of signers) {
    const userFid = signer.userFid;
    if (userFid === creatorFidBounty) continue;
    if (initialCompleted.has(userFid)) continue;
    if (!isReadyNativeSigner(signer) || !signer.encryptedEd25519PrivateKey) continue;
    candidates.push(signer);
  }

  const eligibleSigners: FarcasterUserSignerDoc[] = [];

  // Apply DB + targeting eligibility criteria before any hub reactions are attempted.
  // This prevents running auto-exec for fids that are not eligible for this specific task.
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const chunk = candidates.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.all(
      chunk.map(async (signer) => ({
        signer,
        outcome: await checkEligibilityForTask(db, task, signer.userFid),
      })),
    );
    for (const { signer, outcome } of outcomes) {
      if (outcome.eligible) {
        eligibleSigners.push(signer);
      }
    }
    if (INTER_BATCH_DELAY_MS > 0 && i + BATCH_SIZE < candidates.length) {
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  const followerByFid = await fetchFollowerCountsByFids(eligibleSigners.map((s) => s.userFid));
  const queue = [...eligibleSigners].sort((a, b) => {
    const aCount = followerByFid.get(a.userFid) ?? 0;
    const bCount = followerByFid.get(b.userFid) ?? 0;
    if (bCount !== aCount) return bCount - aCount;
    return a.userFid - b.userFid;
  });

  console.log(
    `[auto-boost] Starting for task ${taskIdStr} — ${queue.length} eligible in queue (sorted by follower_count desc), batch=${BATCH_SIZE}, interBatchMs=${INTER_BATCH_DELAY_MS}, maxCompletions=${maxCompletions || 'unlimited'}`,
  );

  let batchNo = 0;
  while (queue.length > 0) {
    const freshTask = await tasksCol.findOne({ _id } as any);
    if (!freshTask || freshTask.status !== 'active') {
      console.log('[auto-boost] stop — task missing or not active', {
        taskId: taskIdStr,
        status: freshTask?.status,
      });
      break;
    }

    const currentCount = freshTask.completedBy?.length ?? 0;
    if (maxCompletions > 0 && currentCount >= maxCompletions) {
      console.log(`[auto-boost] Task full (${currentCount}/${maxCompletions}), stopping — ${queue.length} left in queue`);
      break;
    }

    const remainingSlots =
      maxCompletions > 0 ? Math.max(0, maxCompletions - currentCount) : Number.POSITIVE_INFINITY;
    const take = Math.min(BATCH_SIZE, remainingSlots, queue.length);
    if (take <= 0) break;

    batchNo += 1;
    const batch = queue.splice(0, take);
    const batchFids = batch.map((s) => s.userFid);
    console.log(
      `[auto-boost] batch #${batchNo} — running ${take} user(s) in parallel: FIDs`,
      batchFids,
      `| queueLeft=${queue.length} slotsLeft=${remainingSlots === Number.POSITIVE_INFINITY ? '∞' : remainingSlots}`,
    );
    const statsList = await Promise.all(batch.map((s) => runOneUser(s)));
    for (const st of statsList) {
      processed += st.processed;
      succeeded += st.succeeded;
      failed += st.failed;
    }

    if (queue.length > 0 && INTER_BATCH_DELAY_MS > 0) {
      console.log(`[auto-boost] sleeping ${INTER_BATCH_DELAY_MS}ms before next batch (${queue.length} users left in queue)`);
      await sleep(INTER_BATCH_DELAY_MS);
    }
  }

  console.log(
    `[auto-boost] Done for task ${taskIdStr}: batches=${batchNo} processed=${processed} succeeded=${succeeded} failed=${failed}`,
  );
  return { processed, succeeded, failed };
}
