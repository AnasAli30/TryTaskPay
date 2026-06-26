import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ObjectId } from 'mongodb';

/**
 * GET /api/tasks/platform-stats
 *
 * Lightweight aggregate: distinct tasks with success completions, distinct earners,
 * sum of task budgets (once per task). No Neynar, no full task payloads.
 * Cached 6h via unstable_cache + CDN Cache-Control.
 */
const SIX_HOURS_SEC = 6 * 60 * 60;

async function computePlatformStats(): Promise<{
  totalRewards: number;
  totalUsers: number;
  totalQuests: number;
}> {
  const db = await getDatabase();
  const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
  const tasksCollection = db.collection<BountyTask>('tasks');

  const [distinctTaskIdRaw, distinctUserFids] = await Promise.all([
    completionsCollection.distinct('taskId', { status: 'success' }),
    completionsCollection.distinct('userFid', { status: 'success' }),
  ]);

  const taskIds = distinctTaskIdRaw
    .filter((id) => id != null && String(id).length > 0)
    .map((id) => String(id));

  const totalQuests = taskIds.length;
  const totalUsers = distinctUserFids.filter((u): u is number => typeof u === 'number').length;

  let totalRewards = 0;
  const batchSize = 500;
  for (let i = 0; i < taskIds.length; i += batchSize) {
    const batch = taskIds.slice(i, i + batchSize);
    const objectIds: ObjectId[] = [];
    for (const id of batch) {
      try {
        if (ObjectId.isValid(id)) objectIds.push(new ObjectId(id));
      } catch {
        /* skip */
      }
    }
    if (objectIds.length === 0) continue;

    const tasks = await tasksCollection
      .find({ _id: { $in: objectIds } })
      .project({ totalBudget: 1, remainingBudget: 1, rewardAmount: 1 })
      .toArray();

    for (const t of tasks) {
      totalRewards += Number(t.totalBudget ?? t.remainingBudget ?? t.rewardAmount ?? 0);
    }
  }

  return {
    totalRewards: Math.round(totalRewards * 100) / 100,
    totalUsers,
    totalQuests,
  };
}

const getCachedPlatformStats = unstable_cache(
  async () => computePlatformStats(),
  ['platform-stats-v1'],
  { revalidate: SIX_HOURS_SEC }
);

export async function GET() {
  try {
    const stats = await getCachedPlatformStats();
    return NextResponse.json(
      { stats },
      {
        status: 200,
        headers: {
          'Cache-Control': `public, s-maxage=${SIX_HOURS_SEC}, stale-while-revalidate=${SIX_HOURS_SEC * 4}`,
        },
      }
    );
  } catch (error) {
    console.error('[platform-stats]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
