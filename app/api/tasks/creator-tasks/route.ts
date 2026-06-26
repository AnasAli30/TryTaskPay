import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ethers } from 'ethers';
import { TASK_ESCROW_ADDRESS } from '@/lib/contracts';
import { getChainConfig, CELO_CHAIN_ID } from '@/lib/chainConfig';
import { getRpcUrl } from '@/lib/chainRpc';

const ESCROW_ABI = ['function getDeposit(address creator, bytes32 taskId) external view returns (uint256)'];

function getEscrowContract(chainId?: number | null) {
    const config = getChainConfig(chainId);
    const rpcUrl = getRpcUrl(config.chainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    return new ethers.Contract(config.escrow.social, ESCROW_ABI, provider);
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/creator-tasks?creatorFid=123
 * 
 * Returns all tasks created by a specific creator with completion stats.
 * Used by the Profile page to show creator dashboard.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const creatorFid = searchParams.get('creatorFid');
        const creatorAddress = searchParams.get('creatorAddress');

        if (!creatorFid && !creatorAddress) {
            return NextResponse.json(
                { error: 'Missing creatorFid or creatorAddress parameter' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

        const filter: Record<string, unknown> = { status: { $ne: 'pending_deposit' } };
        if (creatorFid) {
            const fid = parseInt(creatorFid, 10);
            if (isNaN(fid)) {
                return NextResponse.json({ error: 'Invalid creatorFid' }, { status: 400 });
            }
            filter.creatorFid = fid;
        } else if (creatorAddress) {
            filter.creatorAddress = creatorAddress.toLowerCase();
        }

        const tasks = await tasksCollection
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        // Enrich with completion stats + reclaim info
        const RECLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

        const enriched = await Promise.all(
            tasks.map(async (task) => {
                const taskIdStr = task._id!.toString();

                const [totalCompletions, successCount, failedCount, pendingCount, claimedCount] = await Promise.all([
                    completionsCollection.countDocuments({ taskId: taskIdStr }),
                    completionsCollection.countDocuments({ taskId: taskIdStr, status: 'success' }),
                    completionsCollection.countDocuments({ taskId: taskIdStr, status: 'failed' }),
                    completionsCollection.countDocuments({ taskId: taskIdStr, status: 'pending' }),
                    completionsCollection.countDocuments({ taskId: taskIdStr, claimStatus: 'claimed' }),
                ]);

                // Reclaim eligibility — fetch actual on-chain deposit
                let onChainDepositWei = BigInt(0);
                const taskChainId = task.chainId ?? undefined;
                if (task.onChainTaskId && task.creatorAddress) {
                    try {
                        const contract = getEscrowContract(taskChainId);
                        onChainDepositWei = await contract.getDeposit(task.creatorAddress, task.onChainTaskId);
                    } catch (e) {
                        console.error(`Failed to fetch on-chain deposit for task ${taskIdStr}`, e);
                    }
                }
                const tokenDecimals = getChainConfig(taskChainId).token.decimals;
                const unclaimedAmount = Number(onChainDepositWei) / (10 ** tokenDecimals);
                const verifiedAt = task.verifiedAt ? new Date(task.verifiedAt).toISOString() : null;
                const reclaimEligibleAt = task.verifiedAt
                    ? new Date(new Date(task.verifiedAt).getTime() + RECLAIM_WINDOW_MS).toISOString()
                    : null;
                const canReclaim =
                    task.status === 'verified' &&
                    !task.reclaimedAt &&
                    unclaimedAmount > 0 &&
                    !!task.verifiedAt &&
                    Date.now() >= new Date(task.verifiedAt).getTime() + RECLAIM_WINDOW_MS;

                return {
                    ...task,
                    stats: {
                        totalCompletions,
                        successCount,
                        failedCount,
                        pendingCount,
                        claimedCount,
                    },
                    verifiedAt,
                    reclaimedAt: task.reclaimedAt ? new Date(task.reclaimedAt).toISOString() : null,
                    unclaimedAmount,
                    reclaimEligibleAt,
                    canReclaim,
                };
            })
        );

        return NextResponse.json({ tasks: enriched }, { status: 200 });
    } catch (error) {
        console.error('Error fetching creator tasks:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
