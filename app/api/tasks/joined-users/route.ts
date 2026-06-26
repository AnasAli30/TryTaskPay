import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';

export const dynamic = 'force-dynamic';

type JoinedUser = {
  userFid: number;
  userUsername: string | null;
  userDisplayName: string | null;
  userPfpUrl: string | null;
  status: 'pending' | 'success' | 'failed';
  claimStatus: 'unclaimed' | 'claimed' | 'reclaimed';
  claimAmount?: number;
  isPro: boolean;
};

/**
 * GET /api/tasks/joined-users?taskId=...
 * Returns "who joined" for a creator task (completedBy fids) with status + claimStatus.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId parameter' }, { status: 400 });
    }

    let taskObjectId: ObjectId;
    try {
      taskObjectId = new ObjectId(taskId);
    } catch {
      return NextResponse.json({ error: 'Invalid taskId' }, { status: 400 });
    }

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

    const task = await tasksCollection.findOne({ _id: taskObjectId } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const fids = Array.isArray(task.completedBy) ? task.completedBy.filter((x) => typeof x === 'number') : [];
    const uniqueFids = Array.from(new Set(fids));

    // Pull completion records for this task so we can show pending/success/failed + claimStatus.
    const completionDocs = await completionsCollection
      .find(
        { taskId },
        {
          projection: {
            userFid: 1,
            status: 1,
            claimStatus: 1,
            claimAmount: 1,
            submittedAt: 1,
          },
        },
      )
      .toArray();

    const completionByFid: Record<number, Partial<TaskCompletion>> = {};
    for (const doc of completionDocs) {
      if (typeof (doc as any).userFid !== 'number') continue;
      completionByFid[(doc as any).userFid] = doc as any;
    }

    // Resolve user profiles for joined list
    const profileMap: Record<number, any> = {};
    if (uniqueFids.length > 0) {
      const batchSize = 100;
      const batches: number[][] = [];
      for (let i = 0; i < uniqueFids.length; i += batchSize) {
        batches.push(uniqueFids.slice(i, i + batchSize));
      }

      await Promise.all(
        batches.map(async (batch) => {
          try {
            const bulkUrl = `${req.nextUrl.origin}/api/neynar/users/bulk?fids=${batch.join(',')}`;
            const res = await fetch(bulkUrl, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            for (const u of data?.users || []) {
              if (typeof u?.fid === 'number') profileMap[u.fid] = u;
            }
          } catch {
            // Best-effort profile enrichment
          }
        }),
      );
    }

    const rewardToken = task.rewardToken || 'USDC';
    const totalBudget = task.totalBudget ?? task.rewardAmount ?? 0;

    const completions: JoinedUser[] = uniqueFids.map((fid) => {
      const p = profileMap[fid];
      const c = completionByFid[fid];

      const status = (c?.status as any) || 'pending';
      const claimStatus = (c?.claimStatus as any) || 'unclaimed';

      return {
        userFid: fid,
        userUsername: p?.username ?? null,
        userDisplayName: p?.display_name ?? null,
        userPfpUrl: p?.pfp_url ?? null,
        status,
        claimStatus,
        claimAmount: typeof c?.claimAmount === 'number' ? c?.claimAmount : undefined,
        isPro: p?.pro?.status === 'subscribed' || p?.pro?.status === 'active',
      };
    });

    // Per-user estimate (same logic as other UI)
    const perUser =
      typeof task.computedRewardPerUser === 'number'
        ? task.computedRewardPerUser
        : completions.length > 0
          ? totalBudget / completions.length
          : 0;

    completions.sort((a, b) => {
      const score = (x: JoinedUser) => {
        if (x.claimStatus === 'claimed') return 3;
        if (x.claimStatus === 'reclaimed') return 2;
        if (x.status === 'success') return 1;
        if (x.status === 'failed') return 0;
        return -1;
      };
      return score(b) - score(a);
    });

    return NextResponse.json(
      {
        completions,
        perUser,
        token: rewardToken,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error fetching joined users:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

