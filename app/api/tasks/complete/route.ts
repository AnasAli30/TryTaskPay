import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ethers } from 'ethers';
import { TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI } from '@/lib/contracts';

/**
 * POST /api/tasks/complete
 * 
 * Called after the user has successfully called verifyTask() on-chain.
 * Takes the verifyTxHash and saves the completion to the database.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { taskId, userFid, userWallet, userAddress, verifyTxHash } = body as {
            taskId?: string;
            userFid?: number;
            userWallet?: string;
            userAddress?: string;
            verifyTxHash?: string;
        };

        console.log(body)
        if (!taskId || !verifyTxHash || (userFid == null && !userWallet)) {
            return NextResponse.json({ error: 'Missing taskId, verifyTxHash, and userFid or userWallet' }, { status: 400 });
        }

        const normalizedWallet = userWallet?.toLowerCase();

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
        const _id = new ObjectId(taskId);

        const task = await tasksCollection.findOne({ _id } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Check max completions
        const currentCompletions = (task.completedBy?.length || 0) + (task.completedByWallets?.length || 0);
        const maxCompletions = task.maxCompletions || 0;
        if (maxCompletions > 0 && currentCompletions >= maxCompletions) {
            return NextResponse.json({ error: 'Task has reached maximum number of participants' }, { status: 400 });
        }

        // Check if user already submitted a completion
        const existingCompletion = userFid != null
            ? await completionsCollection.findOne({ taskId, userFid })
            : await completionsCollection.findOne({ taskId, userWallet: normalizedWallet });

        if (existingCompletion) {
            // If already exists, just return success (idempotent)
            return NextResponse.json({
                success: true,
                status: existingCompletion.status,
                message: 'Task submission already recorded.',
            });
        }

        // --- Bot Funder Check ---
        if (userAddress) {
            try {
                const BOT_FUNDER_ADDRESSES = [
                    '0x6304541f6b91D1B0508F2eCF4B80fEad713C1A22'.toLowerCase()
                ];

                if (BOT_FUNDER_ADDRESSES.includes(userAddress.toLowerCase())) {
                    console.log(`Bot blocked: user address ${userAddress} is a known bot funder (fid ${userFid})`);
                    const blockedCollection = db.collection('blockedTaskUsers');
                    await blockedCollection.updateOne(
                        { taskId: new ObjectId(taskId), fid: userFid },
                        { $set: { taskId: new ObjectId(taskId), fid: userFid, blockedAt: new Date(), reason: 'bot_funded' } },
                        { upsert: true }
                    );
                    return NextResponse.json(
                        { error: 'Your account is restricted from participating in this specific task.' },
                        { status: 403 }
                    );
                }

                const url = `https://arbitrum.blockscout.com/api/v2/addresses/${userAddress}/transactions?sort=block_number&order=asc`;
                const res = await fetch(url, { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    const items = data?.items ?? [];
                    if (items.length > 0) {
                        const firstTx = items[0];
                        if (firstTx?.from?.hash && BOT_FUNDER_ADDRESSES.includes(firstTx.from.hash.toLowerCase())) {
                            console.log(`Bot blocked during completion for fid ${userFid} and address ${userAddress}`);
                            const blockedCollection = db.collection('blockedTaskUsers');
                            await blockedCollection.updateOne(
                                { taskId: new ObjectId(taskId), fid: userFid },
                                { $set: { taskId: new ObjectId(taskId), fid: userFid, blockedAt: new Date(), reason: 'bot_funded' } },
                                { upsert: true }
                            );
                            return NextResponse.json(
                                { error: 'Your account is restricted from participating in this specific task.' },
                                { status: 403 }
                            );
                        }
                    }
                }
            } catch (err) {
                console.error(`Error checking blockscout for address ${userAddress}:`, err);
            }
        }
        // --- End Bot Funder Check ---

        // Prevent reusing the same transaction hash for another completion
        const existingTx = await completionsCollection.findOne({ verifyTxHash } as any);
        if (existingTx) {
            return NextResponse.json(
                { error: 'Transaction hash has already been used by another submission' },
                { status: 400 }
            );
        }

        // --- Strict On-Chain Verification ---
        try {
            const ARBITRUM_RPC = 'https://arbitrum-one-rpc.publicnode.com';
            const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC);

            // 1. Fetch transaction receipt
            const receipt = await provider.getTransactionReceipt(verifyTxHash);
            if (!receipt) {
                return NextResponse.json({ error: 'Transaction not found on-chain' }, { status: 400 });
            }

            // 2. Check success status
            if (receipt.status !== 1) {
                return NextResponse.json({ error: 'Transaction failed on-chain' }, { status: 400 });
            }

            // 3. Check interaction target
            if (!receipt.to || receipt.to.toLowerCase() !== TASK_ESCROW_ADDRESS.toLowerCase()) {
                return NextResponse.json({ error: 'Transaction did not interact with the correct escrow contract' }, { status: 400 });
            }

            // 4. Verify TaskVerified event with matching taskId
            const escrowContract = new ethers.Contract(TASK_ESCROW_ADDRESS, TASK_ESCROW_ABI, provider);

            let foundMatch = false;
            for (const log of receipt.logs) {
                try {
                    // This will throw if the log doesn't match the ABI
                    const parsedLog = escrowContract.interface.parseLog({
                        topics: [...log.topics],
                        data: log.data
                    });
                    if (parsedLog && parsedLog.name === 'TaskVerified') {
                        const eventTaskId = parsedLog.args.taskId;
                        if (eventTaskId === task.onChainTaskId) {
                            foundMatch = true;
                            // You could also check if eventVerifier === userAddress here if desired
                            break;
                        }
                    }
                } catch (e) {
                    // Ignore parsing errors for other logs
                }
            }

            if (!foundMatch) {
                return NextResponse.json({ error: 'Could not find a valid TaskVerified event matching this task ID in the transaction' }, { status: 400 });
            }
        } catch (err) {
            console.error('Error verifying on-chain transaction:', err);
            return NextResponse.json({ error: 'Failed to verify transaction on-chain. Please ensure you are using the correct network.' }, { status: 500 });
        }
        // --- End Verification ---

        // Create completion record
        const completion: TaskCompletion = {
            taskId,
            userFid: userFid != null ? Number(userFid) : undefined,
            userWallet: normalizedWallet,
            userAddress: userAddress || normalizedWallet || undefined,
            creatorFid: task.creatorFid,
            status: 'pending',
            claimStatus: 'unclaimed',
            submittedAt: new Date(),
            verifyTxHash,
        };

        await completionsCollection.insertOne(completion);

        if (userFid != null) {
            await tasksCollection.updateOne(
                { _id } as any,
                { $push: { completedBy: Number(userFid) } },
            );
        } else if (normalizedWallet) {
            await tasksCollection.updateOne(
                { _id } as any,
                { $push: { completedByWallets: normalizedWallet } },
            );
        }

        return NextResponse.json({
            success: true,
            status: 'pending',
            message: 'Task submitted! Your reward will be available after admin verification.',
        });
    } catch (error) {
        console.error('Error completing task:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
