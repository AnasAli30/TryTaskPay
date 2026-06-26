import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tasks/reclaim-complete
 *
 * Called after the creator has successfully reclaimed unclaimed tokens on-chain.
 * Marks the task as reclaimed and updates all unclaimed success completions to 'reclaimed'.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { taskId, creatorFid, reclaimTxHash } = body as {
            taskId?: string;
            creatorFid?: number;
            reclaimTxHash?: string;
        };

        if (!taskId || !creatorFid) {
            return NextResponse.json(
                { error: 'Missing taskId or creatorFid' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

        const task = await tasksCollection.findOne({
            _id: new ObjectId(taskId),
        } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        if (task.creatorFid !== Number(creatorFid)) {
            return NextResponse.json({ error: 'Not the task creator' }, { status: 403 });
        }

        if (task.reclaimedAt) {
            return NextResponse.json({
                success: true,
                message: 'Already marked as reclaimed.',
            });
        }

        // Mark the task as reclaimed
        const taskUpdate: Record<string, unknown> = {
            reclaimedAt: new Date(),
        };
        if (reclaimTxHash) taskUpdate.reclaimTxHash = reclaimTxHash;

        await tasksCollection.updateOne(
            { _id: new ObjectId(taskId) } as any,
            { $set: taskUpdate }
        );

        // Mark all unclaimed success completions as 'reclaimed' so users can't claim anymore
        await completionsCollection.updateMany(
            {
                taskId,
                status: 'success',
                claimStatus: { $ne: 'claimed' },
            } as any,
            {
                $set: {
                    claimStatus: 'reclaimed',
                },
            }
        );

        return NextResponse.json({
            success: true,
            message: 'Task marked as reclaimed. Unclaimed completions updated.',
        });
    } catch (error) {
        console.error('Error marking reclaim complete:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
