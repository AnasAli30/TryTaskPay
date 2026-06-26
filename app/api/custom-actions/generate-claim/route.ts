import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask, TaskCompletion } from '@/lib/types';
import {
  CUSTOM_CLAIM_TYPES,
  ESCROW_SIGNER_PRIVATE_KEY,
  getCustomTaskEip712Domain,
} from '@/lib/customTaskEscrow';
import { getTaskChainId } from '@/lib/chainConfig';
import { toTokenWei } from '@/lib/chainRpc';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/generate-claim
 * Signs an EIP-712 claim message for a verified custom task completion.
 */
export async function POST(req: NextRequest) {
  try {
    if (!ESCROW_SIGNER_PRIVATE_KEY) {
      return NextResponse.json({ error: 'Server signer not configured' }, { status: 500 });
    }

    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, userFid } = body as { taskId?: string; userFid?: number };

    if (!taskId) {
      return NextResponse.json({ error: 'Missing required field: taskId' }, { status: 400 });
    }

    const userAddress = session.walletAddress;
    if (!ethers.isAddress(userAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
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
    if (task.status !== 'active' && task.status !== 'completed' && task.status !== 'verified') {
      return NextResponse.json(
        { error: `Task is not claimable (current: ${task.status})` },
        { status: 400 },
      );
    }

    const completion =
      userFid != null
        ? await completionsCollection.findOne({ taskId, userFid: Number(userFid) })
        : await completionsCollection.findOne({ taskId, userWallet: userAddress.toLowerCase() });

    if (!completion) {
      return NextResponse.json(
        { error: 'No completion record found. Verify your on-chain action first.' },
        { status: 404 },
      );
    }

    if (completion.status !== 'success') {
      return NextResponse.json(
        { error: `Completion status is ${completion.status}. Cannot claim.` },
        { status: 400 },
      );
    }

    if (completion.claimStatus === 'claimed') {
      return NextResponse.json({ error: 'Reward already claimed' }, { status: 400 });
    }

    if (completion.claimStatus === 'reclaimed') {
      return NextResponse.json({ error: 'Unclaimed funds were reclaimed by the creator' }, { status: 400 });
    }

    const claimAmount = completion.claimAmount ?? task.computedRewardPerUser ?? task.rewardAmount;
    if (!claimAmount || claimAmount <= 0) {
      return NextResponse.json({ error: 'No reward amount configured' }, { status: 400 });
    }

    if (!task.onChainTaskId || !task.creatorAddress) {
      return NextResponse.json(
        { error: 'Task missing on-chain data (onChainTaskId or creatorAddress)' },
        { status: 400 },
      );
    }

    const taskChainId = getTaskChainId(task);
    const claimAmountWei = toTokenWei(claimAmount, taskChainId);
    const nonce = Date.now();

    const signer = new ethers.Wallet(ESCROW_SIGNER_PRIVATE_KEY);
    const message = {
      taskId: task.onChainTaskId,
      creator: task.creatorAddress,
      claimer: userAddress,
      amount: claimAmountWei.toString(),
      nonce,
    };

    const signature = await signer.signTypedData(
      getCustomTaskEip712Domain(taskChainId),
      CUSTOM_CLAIM_TYPES,
      message,
    );

    await completionsCollection.updateOne(
      { _id: completion._id } as any,
      {
        $set: {
          claimNonce: nonce,
          claimAmount,
          userAddress: userAddress.toLowerCase(),
        },
      },
    );

    return NextResponse.json({
      success: true,
      signature,
      amount: claimAmountWei.toString(),
      amountFormatted: claimAmount,
      nonce,
      onChainTaskId: task.onChainTaskId,
      creatorAddress: task.creatorAddress,
      chainId: taskChainId,
      rewardToken: task.rewardToken ?? 'USDC',
    });
  } catch (error) {
    console.error('[custom-actions/generate-claim]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
