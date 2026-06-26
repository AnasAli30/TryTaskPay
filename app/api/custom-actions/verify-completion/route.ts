import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, CustomActionRequest, TaskCompletion } from '@/lib/types';
import { findMatchingEarnerTxAfterTime } from '@/lib/customActionVerify';
import { checkEligibilityForTask } from '@/lib/taskEligibility';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/verify-completion
 * Auto-scans earner wallet txs after record-open and unlocks claim instantly.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, userFid } = body as {
      taskId?: string;
      userFid?: number;
    };

    if (!taskId) {
      return NextResponse.json({ error: 'Missing required field: taskId' }, { status: 400 });
    }

    const earnerAddress = session.walletAddress.toLowerCase();
    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const actionsCollection = db.collection<CustomActionRequest>('customActionRequests');
    const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
    const opensCollection = db.collection<{ taskId: ObjectId; userWallet: string; openedAt: Date }>(
      'customTaskOpens',
    );
    const _id = new ObjectId(taskId);

    const task = await tasksCollection.findOne({ _id } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.type !== 'custom_onchain') {
      return NextResponse.json({ error: 'Not a custom on-chain task' }, { status: 400 });
    }
    if (task.status !== 'active') {
      return NextResponse.json(
        { error: `Task is not active (current: ${task.status})` },
        { status: 400 },
      );
    }
    if (task.expiresAt && new Date(task.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Task has expired' }, { status: 400 });
    }

    const openRecord = await opensCollection.findOne({ taskId: _id, userWallet: earnerAddress });
    if (!openRecord?.openedAt) {
      return NextResponse.json(
        {
          error: 'Open the task first, complete the action, then verify.',
        },
        { status: 400 },
      );
    }

    const currentCompletions =
      (task.completedBy?.length || 0) + (task.completedByWallets?.length || 0);
    const maxCompletions = task.maxCompletions || 0;
    if (maxCompletions > 0 && currentCompletions >= maxCompletions) {
      return NextResponse.json(
        { error: 'Task has reached maximum number of participants' },
        { status: 400 },
      );
    }

    const existingByWallet = await completionsCollection.findOne({
      taskId,
      userWallet: earnerAddress,
    });
    const existingByFid =
      userFid != null
        ? await completionsCollection.findOne({ taskId, userFid: Number(userFid) })
        : null;
    if (existingByWallet || existingByFid) {
      const existing = existingByWallet || existingByFid;
      return NextResponse.json({
        success: true,
        verified: true,
        alreadyCompleted: true,
        claimAmount: existing?.claimAmount ?? task.computedRewardPerUser,
        claimStatus: existing?.claimStatus ?? 'unclaimed',
        message:
          existing?.claimStatus === 'claimed'
            ? 'Reward already claimed.'
            : 'Task already verified. You can claim your reward.',
      });
    }

    let action: CustomActionRequest | null = null;
    if (task.customActionId) {
      action = await actionsCollection.findOne({
        _id: new ObjectId(task.customActionId),
      });
    }

    if (!action && task.customActionMeta) {
      action = {
        contractAddress: task.customActionMeta.contractAddress,
        functionSelector: task.customActionMeta.functionSelector,
        functionName: task.customActionMeta.functionName,
        trackedEvent: task.customActionMeta.trackedEvent,
        distributionChannels: task.customActionMeta.distributionChannels,
      } as CustomActionRequest;
    }

    if (!action) {
      return NextResponse.json({ error: 'Custom action not found' }, { status: 404 });
    }

    const hasFarcasterTargeting =
      task.nonSpamOnly ||
      (task.minFollowers != null && task.minFollowers > 0) ||
      (task.minNeynarScore != null && task.minNeynarScore >= 0) ||
      (task.minAccountAgeDays != null && task.minAccountAgeDays > 0);

    if (hasFarcasterTargeting && userFid == null) {
      return NextResponse.json(
        { error: 'Farcaster sign-in required for this task targeting rules' },
        { status: 400 },
      );
    }

    if (userFid != null) {
      const eligibility = await checkEligibilityForTask(db, task, Number(userFid));
      if (!eligibility.eligible) {
        return NextResponse.json(
          { success: false, verified: false, message: eligibility.message },
          { status: 200 },
        );
      }
    }

    const sinceMs = new Date(openRecord.openedAt).getTime();
    let verification;
    try {
      verification = await findMatchingEarnerTxAfterTime(earnerAddress, action, sinceMs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not scan wallet transactions.';
      return NextResponse.json(
        { success: false, verified: false, message },
        { status: 200 },
      );
    }

    if (!verification) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          message:
            'No matching transaction found yet. Complete the on-chain action in the app, then try again.',
        },
        { status: 200 },
      );
    }

    const existingTx = await completionsCollection.findOne({
      verifyTxHash: verification.txHash,
    } as any);
    if (existingTx) {
      return NextResponse.json(
        { error: 'This transaction has already been used for another completion' },
        { status: 400 },
      );
    }

    const claimAmount = task.computedRewardPerUser ?? task.rewardAmount ?? 0;
    if (!claimAmount || claimAmount <= 0) {
      return NextResponse.json({ error: 'Task has no reward configured' }, { status: 400 });
    }

    const completion: TaskCompletion = {
      taskId,
      userFid: userFid != null ? Number(userFid) : undefined,
      userWallet: earnerAddress,
      userAddress: earnerAddress,
      creatorFid: task.creatorFid,
      status: 'success',
      claimStatus: 'unclaimed',
      claimAmount,
      submittedAt: new Date(),
      verifyTxHash: verification.txHash,
    };

    await completionsCollection.insertOne(completion);

    if (userFid != null) {
      await tasksCollection.updateOne(
        { _id } as any,
        { $push: { completedBy: Number(userFid) } },
      );
    } else {
      await tasksCollection.updateOne(
        { _id } as any,
        { $push: { completedByWallets: earnerAddress } },
      );
    }

    return NextResponse.json({
      success: true,
      verified: true,
      claimAmount,
      matchedEventSignature: verification.matchedEventSignature,
      verifyTxHash: verification.txHash,
      message: 'Task verified! Your reward is ready to claim.',
    });
  } catch (error) {
    console.error('[custom-actions/verify-completion]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
