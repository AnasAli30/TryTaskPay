import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tasks/verified-tasks
 *
 * Returns all tasks that have at least one verified (success) completion.
 * Uses completedBy FIDs from task docs and resolves profiles via Neynar.
 */
export async function GET(req: NextRequest) {
    try {
        const db = await getDatabase();
        const taskCompletionsCollection = db.collection<TaskCompletion>('taskCompletions');
        const tasksCollection = db.collection<BountyTask>('tasks');

        // Distinct taskIds that have at least one success completion
        const verifiedTaskIds = await taskCompletionsCollection.distinct('taskId', {
            status: 'success',
        });

        const totalVerified = verifiedTaskIds.length;
        const totalCreated = await tasksCollection.countDocuments({});

        if (verifiedTaskIds.length === 0) {
            return NextResponse.json({ tasks: [], totalVerified: 0, totalCreated }, { status: 200 });
        }

        const taskIds = verifiedTaskIds
            .filter((id) => id != null && String(id).length > 0)
            .slice(0, 200);

        // Fetch all tasks
        const taskDocs = await Promise.all(
            taskIds.map(async (taskIdStr) => {
                try {
                    return await tasksCollection.findOne({
                        _id: new ObjectId(taskIdStr),
                    } as any);
                } catch {
                    return null;
                }
            })
        );

        // Collect ALL unique FIDs from completedBy + creatorFid
        const allFids = new Set<number>();
        for (const task of taskDocs) {
            if (!task) continue;
            if (typeof task.creatorFid === 'number') allFids.add(task.creatorFid);
            if (Array.isArray(task.completedBy)) {
                for (const fid of task.completedBy) {
                    if (typeof fid === 'number') allFids.add(fid);
                }
            }
        }

        // Batch-resolve all profiles via Neynar (groups of 100)
        const profileMap: Record<number, any> = {};
        const fidArray = Array.from(allFids);
        const baseUrl = req.nextUrl.origin;

        const batches: number[][] = [];
        for (let i = 0; i < fidArray.length; i += 100) {
            batches.push(fidArray.slice(i, i + 100));
        }

        await Promise.all(
            batches.map(async (batch) => {
                try {
                    const res = await fetch(
                        `${baseUrl}/api/neynar/users/bulk?fids=${batch.join(',')}`,
                        { cache: 'no-store' }
                    );
                    if (res.ok) {
                        const data = await res.json();
                        for (const u of data.users || []) {
                            if (typeof u.fid === 'number') profileMap[u.fid] = u;
                        }
                    }
                } catch (e) {
                    console.error('Neynar bulk fetch error', e);
                }
            })
        );

        // Fetch claim statuses for all tasks at once
        const allClaimDocs = await taskCompletionsCollection
            .find({
                taskId: { $in: taskIds.map(String) },
                status: 'success',
            })
            .project({ taskId: 1, userFid: 1, claimStatus: 1 })
            .toArray();

        // Build per-task claim map
        const claimByTask: Record<string, Record<number, string>> = {};
        for (const doc of allClaimDocs) {
            const tid = String((doc as any).taskId);
            if (!claimByTask[tid]) claimByTask[tid] = {};
            claimByTask[tid][(doc as any).userFid] = (doc as any).claimStatus || 'unclaimed';
        }

        // Enrich tasks
        const enriched = taskIds.map((taskIdStr, idx) => {
            const task = taskDocs[idx];
            if (!task) return null;

            const tid = String(taskIdStr);
            const completedByFids: number[] = task.completedBy || [];
            const taskClaimMap = claimByTask[tid] || {};

            const completions = completedByFids.map((fid) => {
                const profile = profileMap[fid];
                return {
                    userFid: fid,
                    userUsername: profile?.username || null,
                    userDisplayName: profile?.display_name || null,
                    userPfpUrl: profile?.pfp_url || null,
                    claimStatus: taskClaimMap[fid] || 'unclaimed',
                };
            });

            const claimedCount = completions.filter((c) => c.claimStatus === 'claimed').length;

            return {
                _id: task._id?.toString?.() ?? taskIdStr,
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
                completions,
            };
        });

        const tasks = enriched.filter(Boolean);
        tasks.sort((a: any, b: any) => (b.claimedCount ?? 0) - (a.claimedCount ?? 0));

        return NextResponse.json({ tasks, totalVerified, totalCreated }, { status: 200 });
    } catch (error) {
        console.error('Error fetching verified tasks:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
