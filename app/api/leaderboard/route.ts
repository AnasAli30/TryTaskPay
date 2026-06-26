import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * GET /api/leaderboard
 *
 * Query params (optional):
 * - type: 'earners' | 'creators' — return only that list (for pagination)
 * - skip: number (default 0)
 * - limit: number (default 25, max 100)
 *
 * Returns:
 * - topEarners and/or topCreators (depending on type)
 * - hasMore: boolean (true if more results exist after this page)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type') as 'earners' | 'creators' | null;
        const skip = Math.max(0, parseInt(searchParams.get('skip') ?? '0', 10) || 0);
        const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

        const result: { topEarners?: any[]; topCreators?: any[]; hasMore?: boolean } = {};

        if (!type || type === 'earners') {
            const earnersPipeline: any[] = [
                { $match: { claimStatus: 'claimed', claimAmount: { $gt: 0 } } },
                { $group: { _id: '$userFid', totalEarned: { $sum: '$claimAmount' }, claims: { $sum: 1 }, userUsername: { $first: '$userUsername' }, userDisplayName: { $first: '$userDisplayName' }, userPfpUrl: { $first: '$userPfpUrl' } } },
                { $sort: { totalEarned: -1 } },
                { $skip: skip },
                { $limit: limit + 1 },
            ];
            const earnersRaw = await completionsCollection.aggregate(earnersPipeline).toArray();
            const hasMoreEarners = earnersRaw.length > limit;
            const topEarners = (hasMoreEarners ? earnersRaw.slice(0, limit) : earnersRaw).map((r: any) => ({
                fid: r._id,
                totalEarned: r.totalEarned,
                claims: r.claims,
                userUsername: r.userUsername,
                userDisplayName: r.userDisplayName,
                userPfpUrl: r.userPfpUrl,
            }));
            result.topEarners = topEarners;
            if (type === 'earners') result.hasMore = hasMoreEarners;
            else (result as any).hasMoreEarners = hasMoreEarners;
        }

        if (!type || type === 'creators') {
            const creatorsPipeline: any[] = [
                { $match: { status: { $ne: 'pending_deposit' }, totalBudget: { $gt: 0 } } },
                { $group: { _id: '$creatorFid', totalSpent: { $sum: '$totalBudget' }, taskCount: { $sum: 1 } } },
                { $sort: { totalSpent: -1 } },
                { $skip: skip },
                { $limit: limit + 1 },
            ];
            const creatorsRaw = await tasksCollection.aggregate(creatorsPipeline).toArray();
            const hasMoreCreators = creatorsRaw.length > limit;
            const topCreators = (hasMoreCreators ? creatorsRaw.slice(0, limit) : creatorsRaw).map((r: any) => ({
                fid: r._id,
                totalSpent: r.totalSpent,
                taskCount: r.taskCount,
            }));
            result.topCreators = topCreators;
            if (type === 'creators') result.hasMore = hasMoreCreators;
            else (result as any).hasMoreCreators = hasMoreCreators;
        }

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error('Error building leaderboard:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}

