import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/user-completions?userFid=123
 * 
 * Returns all TaskCompletion records for a user with task details.
 * Used by the Profile page to show task statuses.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const userFid = searchParams.get('userFid');
        const userWallet = searchParams.get('userWallet');

        if (!userFid && !userWallet) {
            return NextResponse.json(
                { error: 'Missing userFid or userWallet parameter' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
        const tasksCollection = db.collection<BountyTask>('tasks');

        const filter: Record<string, unknown> = userFid
            ? { userFid: parseInt(userFid, 10) }
            : { userWallet: userWallet!.toLowerCase() };

        const completions = await completionsCollection
            .find(filter)
            .sort({ submittedAt: -1 })
            .limit(200)
            .toArray();

        // Enrich with task details + claimed count for this task
        const enriched = await Promise.all(
            completions.map(async (c) => {
                let task = null;
                try {
                    task = await tasksCollection.findOne({
                        _id: new ObjectId(c.taskId),
                    } as any);
                } catch { }
                let claimedCount = 0;
                if (c.taskId) {
                    claimedCount = await completionsCollection.countDocuments({
                        taskId: c.taskId,
                        claimStatus: 'claimed',
                    });
                }
                return {
                    ...c,
                    task: task ? {
                        _id: task._id?.toString?.() ?? c.taskId,
                        type: task.type,
                        description: task.description,
                        totalBudget: task.totalBudget,
                        rewardToken: task.rewardToken,
                        expiresAt: task.expiresAt,
                        status: task.status,
                        computedRewardPerUser: task.computedRewardPerUser,
                        targetUsername: task.targetUsername,
                        creatorFid: task.creatorFid,
                        castData: task.castData,
                        miniappData: task.miniappData,
                        onChainTaskId: task.onChainTaskId,
                        maxCompletions: task.maxCompletions,
                        completedBy: task.completedBy,
                        claimedCount,
                    } : null,
                };
            })
        );

        return NextResponse.json({ completions: enriched }, { status: 200 });
    } catch (error) {
        console.error('Error fetching user completions:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
