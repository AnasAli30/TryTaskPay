import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { TaskCompletion } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const fidRaw = searchParams.get('fid');
        const type = searchParams.get('type') === 'creators' ? 'creators' : 'earners';

        if (!fidRaw) {
            return NextResponse.json({ error: 'Missing fid parameter' }, { status: 400 });
        }

        const fid = parseInt(fidRaw, 10);
        if (!Number.isFinite(fid) || fid <= 0) {
            return NextResponse.json({ error: 'Invalid fid parameter' }, { status: 400 });
        }

        const db = await getDatabase();
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
        const tasksCollection = db.collection('tasks');

        if (type === 'creators') {
            const createdTasks = await tasksCollection
                .find({ creatorFid: fid, status: { $ne: 'pending_deposit' } })
                .project({ _id: 1, type: 1, description: 1, totalBudget: 1, createdAt: 1, status: 1 })
                .sort({ createdAt: -1 })
                .limit(100)
                .toArray();

            const creatorTasks = createdTasks.map((t: any) => ({
                taskId: String(t._id),
                taskType: t.type ?? null,
                taskDescription: t.description ?? null,
                amount: Number(t.totalBudget || 0),
                createdAt: t.createdAt ?? null,
                status: t.status ?? null,
            }));

            const totalSpent = creatorTasks.reduce((sum, t) => sum + (t.amount || 0), 0);

            return NextResponse.json({
                fid,
                totalSpent,
                taskCount: creatorTasks.length,
                creatorTasks,
            });
        }

        const claimed = await completionsCollection
            .find({ userFid: fid, claimStatus: 'claimed', claimAmount: { $gt: 0 } })
            .sort({ claimedAt: -1, submittedAt: -1 })
            .limit(100)
            .toArray();

        const taskIds = Array.from(
            new Set(
                claimed
                    .map((c: any) => c.taskId)
                    .filter((id: any) => typeof id === 'string' && id.length > 0),
            ),
        );

        const taskObjectIds = taskIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
        const tasks = taskObjectIds.length > 0
            ? await tasksCollection
                .find({ _id: { $in: taskObjectIds } })
                .project({ _id: 1, type: 1, description: 1, miniappData: 1, targetUsername: 1, castData: 1 })
                .toArray()
            : [];

        const taskMap = new Map<string, any>();
        for (const t of tasks) {
            taskMap.set(String((t as any)._id), t);
        }

        const earnings = claimed.map((c: any) => {
            const t = taskMap.get(String(c.taskId));
            return {
                taskId: c.taskId,
                taskType: t?.type ?? null,
                taskDescription: t?.description ?? null,
                amount: Number(c.claimAmount || 0),
                claimedAt: c.claimedAt ?? c.submittedAt ?? null,
                submittedAt: c.submittedAt ?? null,
                claimTxHash: c.claimTxHash ?? null,
            };
        });

        const totalEarned = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);

        return NextResponse.json({
            fid,
            totalEarned,
            claims: earnings.length,
            earnings,
        });
    } catch (error) {
        console.error('Error fetching leaderboard user details:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
