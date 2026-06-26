import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, TaskCompletion } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/reclaim-complete
 * Marks a custom task as reclaimed after on-chain reclaim tx succeeds.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, reclaimTxHash } = body as {
      taskId?: string;
      reclaimTxHash?: string;
    };

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.type !== 'custom_onchain') {
      return NextResponse.json({ error: 'Not a custom on-chain task' }, { status: 400 });
    }
    if ((task.creatorAddress || '').toLowerCase() !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Not the task creator' }, { status: 403 });
    }

    if (task.reclaimedAt) {
      return NextResponse.json({ success: true, message: 'Already marked as reclaimed.' });
    }

    const taskUpdate: Record<string, unknown> = {
      reclaimedAt: new Date(),
      status: 'completed',
    };
    if (reclaimTxHash) taskUpdate.reclaimTxHash = reclaimTxHash;

    await tasksCollection.updateOne({ _id: new ObjectId(taskId) } as any, { $set: taskUpdate });

    await completionsCollection.updateMany(
      {
        taskId,
        status: 'success',
        claimStatus: { $ne: 'claimed' },
      } as any,
      { $set: { claimStatus: 'reclaimed' } },
    );

    return NextResponse.json({
      success: true,
      message: 'Task marked as reclaimed. Unclaimed completions updated.',
    });
  } catch (error) {
    console.error('[custom-actions/reclaim-complete]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
