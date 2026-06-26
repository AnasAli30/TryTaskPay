import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/admin-tasks?adminFid=249702&onlyZeroClaims=1
 *
 * Admin-only view of ALL tasks that have a confirmed deposit (status !== 'pending_deposit').
 * Returns latest tasks first, enriched with completion stats (same shape as creator-tasks).
 *
 * Query:
 * - onlyZeroClaims=1 — return only tasks where claims show 0/0 (successCount === 0 and claimedCount === 0).
 *   Filtering uses DB-derived stats on the server after enrichment (not client-side list filtering).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const adminFid = searchParams.get('adminFid');
        const onlyZeroClaims =
            searchParams.get('onlyZeroClaims') === '1' || searchParams.get('onlyZeroClaims') === 'true';

        // Very lightweight gate – only allow the configured admin fid
        if (adminFid !== '249702') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

        // All tasks where deposit is confirmed (exclude pending_deposit)
        const tasks = await tasksCollection
            .find({ status: { $ne: 'pending_deposit' } })
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();

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

                return {
                    ...task,
                    stats: {
                        totalCompletions,
                        successCount,
                        failedCount,
                        pendingCount,
                        claimedCount,
                    },
                };
            })
        );

        const tasksOut = onlyZeroClaims
            ? enriched.filter((t) => t.stats.successCount === 0 && t.stats.claimedCount === 0)
            : enriched;

        return NextResponse.json({ tasks: tasksOut, onlyZeroClaims: onlyZeroClaims || undefined }, { status: 200 });
    } catch (error) {
        console.error('Error fetching admin tasks:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

