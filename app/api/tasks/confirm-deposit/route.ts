import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { ObjectId } from 'mongodb';
import { ethers } from 'ethers';
import { TASK_ESCROW_ABI } from '@/lib/contracts';
import { getSocialEscrowAddress, getTaskChainId } from '@/lib/chainConfig';
import { getRpcUrl } from '@/lib/chainRpc';
import { notifyAllUsersNewQuest } from '@/lib/notifyNewQuest';
import { autoExecuteBoostLiteForAll } from '@/lib/boostLiteAutoExecuteAll';

/** Allow long boost_lite auto-boost runs on Vercel (raise on Pro; hobby max is often 10s). */
export const maxDuration = 300;

/**
 * POST /api/tasks/confirm-deposit
 * Called after the on-chain deposit tx succeeds.
 * Updates the task with depositTxHash and sets status to 'active'.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { taskId, depositTxHash, creatorAddress } = body;

        if (!taskId || !depositTxHash) {
            return NextResponse.json(
                { error: 'Missing required fields: taskId, depositTxHash' },
                { status: 400 }
            );
        }

        // Basic tx hash validation
        if (!/^0x[a-fA-F0-9]{64}$/.test(depositTxHash)) {
            return NextResponse.json(
                { error: 'Invalid transaction hash format' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const _id = new ObjectId(taskId);

        const task = await tasksCollection.findOne({ _id } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        if (task.status !== 'pending_deposit') {
            return NextResponse.json(
                { error: `Task already has status: ${task.status}` },
                { status: 400 }
            );
        }

        // Prevent reusing the same transaction hash for another task
        const existingTx = await tasksCollection.findOne({ depositTxHash } as any);
        if (existingTx) {
            return NextResponse.json(
                { error: 'Transaction hash has already been used' },
                { status: 400 }
            );
        }

        // --- Strict On-Chain Verification ---
        try {
            const taskChainId = getTaskChainId(task);
            const escrowAddress = getSocialEscrowAddress(taskChainId);
            const provider = new ethers.JsonRpcProvider(getRpcUrl(taskChainId));

            // 1. Fetch transaction receipt
            const receipt = await provider.getTransactionReceipt(depositTxHash);
            if (!receipt) {
                return NextResponse.json({ error: 'Transaction not found on-chain' }, { status: 400 });
            }

            // 2. Check success status
            if (receipt.status !== 1) {
                return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
            }

            // 3. Check interaction target (direct call to escrow, or logs from escrow e.g. batched / AA)
            const escrowLower = escrowAddress.toLowerCase();
            const toOk = receipt.to?.toLowerCase() === escrowLower;
            const logsFromEscrow =
                Array.isArray(receipt.logs) &&
                receipt.logs.some((log: { address?: string }) => log.address?.toLowerCase() === escrowLower);
            if (!toOk && !logsFromEscrow) {
                return NextResponse.json(
                    { error: 'Transaction did not interact with the correct escrow contract' },
                    { status: 400 }
                );
            }

            const escrowContract = new ethers.Contract(escrowAddress, TASK_ESCROW_ABI, provider);


            // 5. Double-check the actual current reading of getDeposit(creator, taskId)
            const finalCreatorAddress = creatorAddress || task.creatorAddress;
            if (!finalCreatorAddress) {
                return NextResponse.json({ error: 'Missing creator address to verify deposit' }, { status: 400 });
            }

            const onChainNetAmountWei: bigint = await escrowContract.getDeposit(finalCreatorAddress, task.onChainTaskId);
            if (onChainNetAmountWei <= BigInt(0)) {
                return NextResponse.json({ error: 'Deposit check failed: Contract reports 0 deposit for this task' }, { status: 400 });
            }

        } catch (err) {
            console.error('Error verifying on-chain transaction:', err);
            return NextResponse.json({ error: 'Failed to verify transaction on-chain. Please ensure you are using the correct network.' }, { status: 500 });
        }
        // --- End Verification ---

        const updateResult = await tasksCollection.updateOne(
            { _id } as any,
            {
                $set: {
                    status: 'active',
                    depositTxHash,
                    creatorAddress: creatorAddress || task.creatorAddress,
                },
            }
        );

        if (updateResult.modifiedCount === 0) {
            return NextResponse.json(
                { error: 'Failed to update task' },
                { status: 500 }
            );
        }

        // Fire-and-forget: notify all mini-app users about the new quest if budget >= 5 USDC
        if ((task.totalBudget || 0) >= 5) {
            notifyAllUsersNewQuest(task).catch((err) =>
                console.error('[confirm-deposit] Notification error:', err)
            );
        }

        // boost_lite: run auto-boost after response. Plain fire-and-forget is often killed on Vercel once
        // the response is sent; waitUntil keeps the serverless invocation alive until the job settles.
        if (task.type === 'boost_lite') {
            console.log(
                '[confirm-deposit] scheduling auto-boost for all opted-in users (waitUntil) taskId:',
                taskId,
            );
            waitUntil(
                autoExecuteBoostLiteForAll(_id).catch((err) =>
                    console.error('[confirm-deposit] Auto-boost error:', err),
                ),
            );
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('Error confirming deposit:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
