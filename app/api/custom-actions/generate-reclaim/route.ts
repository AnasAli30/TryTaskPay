import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { BountyTask } from '@/lib/types';
import { CUSTOM_TASK_ESCROW_ABI, getCustomTaskEscrowAddress } from '@/lib/contracts';
import {
  CUSTOM_RECLAIM_TYPES,
  ESCROW_SIGNER_PRIVATE_KEY,
  getCustomTaskEip712Domain,
} from '@/lib/customTaskEscrow';

export const dynamic = 'force-dynamic';

/**
 * POST /api/custom-actions/generate-reclaim
 * Signs an EIP-712 reclaim message so the creator can pull unspent USDC after expiry.
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
    const { taskId } = body as { taskId?: string };

    if (!taskId) {
      return NextResponse.json({ error: 'Missing required field: taskId' }, { status: 400 });
    }

    const creatorAddress = session.walletAddress;
    if (!ethers.isAddress(creatorAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 });
    }

    const escrowAddress = getCustomTaskEscrowAddress();
    if (!escrowAddress) {
      return NextResponse.json(
        { error: 'Custom task escrow contract is not configured yet' },
        { status: 503 },
      );
    }

    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');

    const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) } as any);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (task.type !== 'custom_onchain') {
      return NextResponse.json({ error: 'Not a custom on-chain task' }, { status: 400 });
    }
    if ((task.creatorAddress || '').toLowerCase() !== creatorAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Not the task creator' }, { status: 403 });
    }
    if (task.reclaimedAt) {
      return NextResponse.json({ error: 'Task has already been reclaimed' }, { status: 400 });
    }
    if (!task.expiresAt) {
      return NextResponse.json({ error: 'Task has no expiry timestamp' }, { status: 400 });
    }
    if (new Date(task.expiresAt) > new Date()) {
      const msLeft = new Date(task.expiresAt).getTime() - Date.now();
      const hoursLeft = Math.ceil(msLeft / (1000 * 60 * 60));
      return NextResponse.json(
        { error: `Reclaim not available until the task expires. ${hoursLeft}h remaining.` },
        { status: 400 },
      );
    }

    if (!task.onChainTaskId || !task.creatorAddress) {
      return NextResponse.json(
        { error: 'Task missing on-chain data (onChainTaskId or creatorAddress)' },
        { status: 400 },
      );
    }

    const { getRpcUrl } = await import('@/lib/chainRpc');
    const { getChainConfig } = await import('@/lib/chainConfig');
    const taskChainId = task.chainId ?? undefined;
    const rpcUrl = getRpcUrl(taskChainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const escrowContract = new ethers.Contract(
      escrowAddress,
      CUSTOM_TASK_ESCROW_ABI,
      provider,
    );

    const onChainDeposit: bigint = await escrowContract.getDeposit(
      task.creatorAddress,
      task.onChainTaskId,
    );

    if (onChainDeposit <= BigInt(0)) {
      return NextResponse.json(
        { error: 'No unclaimed tokens to reclaim. Contract deposit is 0.' },
        { status: 400 },
      );
    }

    const reclaimAmountWei = onChainDeposit;
    const nonce = Date.now();

    const signer = new ethers.Wallet(ESCROW_SIGNER_PRIVATE_KEY);
    const message = {
      taskId: task.onChainTaskId,
      creator: task.creatorAddress,
      amount: reclaimAmountWei.toString(),
      nonce,
    };

    const signature = await signer.signTypedData(
      getCustomTaskEip712Domain(),
      CUSTOM_RECLAIM_TYPES,
      message,
    );

    return NextResponse.json({
      success: true,
      signature,
      amount: reclaimAmountWei.toString(),
      amountFormatted: Number(onChainDeposit) / (10 ** getChainConfig(taskChainId).token.decimals),
      nonce,
      onChainTaskId: task.onChainTaskId,
      creatorAddress: task.creatorAddress,
    });
  } catch (error) {
    console.error('[custom-actions/generate-reclaim]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
