import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask } from '@/lib/types';
import { CUSTOM_TASK_ESCROW_ABI } from '@/lib/contracts';
import { getCustomEscrowAddress, getTaskChainId } from '@/lib/chainConfig';
import { getRpcUrl } from '@/lib/chainRpc';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/confirm-deposit
 * Verifies CustomTaskPay / GoodCustomTaskPay deposit on-chain and activates the task.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, depositTxHash, creatorAddress } = body as {
      taskId?: string;
      depositTxHash?: string;
      creatorAddress?: string;
    };

    if (!taskId || !depositTxHash) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, depositTxHash' },
        { status: 400 },
      );
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(depositTxHash)) {
      return NextResponse.json({ error: 'Invalid transaction hash format' }, { status: 400 });
    }

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const _id = new ObjectId(taskId);

    const task = await tasksCollection.findOne({ _id } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.type !== 'custom_onchain') {
      return NextResponse.json({ error: 'Not a custom on-chain task' }, { status: 400 });
    }
    if (task.status !== 'pending_deposit') {
      return NextResponse.json(
        { error: `Task already has status: ${task.status}` },
        { status: 400 },
      );
    }

    const taskChainId = getTaskChainId(task);
    const escrowAddress = getCustomEscrowAddress(taskChainId);
    if (!escrowAddress) {
      return NextResponse.json(
        { error: 'Custom task escrow contract is not configured for this chain' },
        { status: 503 },
      );
    }

    const finalCreatorAddress = (creatorAddress || task.creatorAddress || '').toLowerCase();
    if (finalCreatorAddress !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized creator address' }, { status: 403 });
    }

    const existingTx = await tasksCollection.findOne({ depositTxHash } as any);
    if (existingTx) {
      return NextResponse.json({ error: 'Transaction hash has already been used' }, { status: 400 });
    }

    try {
      const provider = new ethers.JsonRpcProvider(getRpcUrl(taskChainId));

      const receipt = await provider.getTransactionReceipt(depositTxHash);
      if (!receipt) {
        return NextResponse.json({ error: 'Transaction not found on-chain' }, { status: 400 });
      }
      if (receipt.status !== 1) {
        return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
      }

      const escrowLower = escrowAddress.toLowerCase();
      const toOk = receipt.to?.toLowerCase() === escrowLower;
      const logsFromEscrow =
        Array.isArray(receipt.logs) &&
        receipt.logs.some((log: { address?: string | null }) =>
          log.address?.toLowerCase() === escrowLower,
        );
      if (!toOk && !logsFromEscrow) {
        return NextResponse.json(
          { error: 'Transaction did not interact with the custom task escrow contract' },
          { status: 400 },
        );
      }

      const escrowContract = new ethers.Contract(
        escrowAddress,
        CUSTOM_TASK_ESCROW_ABI,
        provider,
      );

      const onChainNetAmountWei: bigint = await escrowContract.getDeposit(
        finalCreatorAddress,
        task.onChainTaskId,
      );
      if (onChainNetAmountWei <= BigInt(0)) {
        return NextResponse.json(
          { error: 'Deposit check failed: contract reports 0 deposit for this task' },
          { status: 400 },
        );
      }
    } catch (err) {
      console.error('[custom-actions/confirm-deposit] on-chain verify error:', err);
      return NextResponse.json(
        { error: 'Failed to verify transaction on-chain. Ensure you are on the correct network.' },
        { status: 500 },
      );
    }

    const updateResult = await tasksCollection.updateOne(
      { _id } as any,
      {
        $set: {
          status: 'active',
          depositTxHash,
          creatorAddress: finalCreatorAddress,
        },
      },
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[custom-actions/confirm-deposit]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
