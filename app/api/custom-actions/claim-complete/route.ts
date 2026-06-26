import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, TaskCompletion } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/claim-complete
 * Marks a custom task completion as claimed after on-chain claim tx succeeds.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, userFid, claimTxHash } = body as {
      taskId?: string;
      userFid?: number;
      claimTxHash?: string;
    };

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    const db = await getDatabase();
    const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
    const tasksCollection = db.collection<BountyTask>('tasks');

    const completion =
      userFid != null
        ? await completionsCollection.findOne({ taskId, userFid: Number(userFid) })
        : await completionsCollection.findOne({
            taskId,
            userWallet: session.walletAddress.toLowerCase(),
          });

    if (!completion) {
      return NextResponse.json({ error: 'Completion not found' }, { status: 404 });
    }

    if (completion.claimStatus === 'claimed') {
      if (claimTxHash && !completion.claimTxHash) {
        await completionsCollection.updateOne(
          { _id: completion._id } as any,
          { $set: { claimTxHash } },
        );
      }
      return NextResponse.json({ success: true, message: 'Already marked as claimed.' });
    }

    const update: Record<string, unknown> = {
      claimStatus: 'claimed',
      claimedAt: new Date(),
    };
    if (claimTxHash) update.claimTxHash = claimTxHash;
    if (completion.claimAmount != null) update.claimAmount = completion.claimAmount;

    await completionsCollection.updateOne({ _id: completion._id } as any, { $set: update });

    const claimAmount = completion.claimAmount ?? 0;
    if (claimAmount > 0) {
      try {
        await tasksCollection.updateOne(
          { _id: new ObjectId(taskId) } as any,
          { $inc: { remainingBudget: -claimAmount } },
        );
      } catch (e) {
        console.warn('[custom-actions/claim-complete] remainingBudget decrement failed:', e);
      }
    }

    return NextResponse.json({ success: true, message: 'Marked as claimed.' });
  } catch (error) {
    console.error('[custom-actions/claim-complete]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
