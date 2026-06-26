import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { TaskCompletion, BountyTask } from '@/lib/types';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tasks/claim-complete
 *
 * Called after the user has successfully claimed on-chain (claim tx confirmed).
 * Marks the completion as claimed in the database so the UI stops showing the claim button.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { taskId, userFid, userAddress, claimTxHash, userUsername, userDisplayName, userPfpUrl } = body as {
            taskId?: string;
            userFid?: number;
            userAddress?: string;
            claimTxHash?: string;
            // Optional snapshot of user profile at claim time
            userUsername?: string;
            userDisplayName?: string;
            userPfpUrl?: string;
        };

        if (!taskId || !userFid) {
            return NextResponse.json(
                { error: 'Missing taskId or userFid' },
                { status: 400 }
            );
        }

        const db = await getDatabase();
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');
        const tasksCollection = db.collection<BountyTask>('tasks');

        const completion = await completionsCollection.findOne({
            taskId,
            userFid,
        });

        if (!completion) {
            return NextResponse.json(
                { error: 'Completion not found' },
                { status: 404 }
            );
        }

        if (completion.claimStatus === 'claimed') {
            // Backfill tx hash for older records if caller now provides it.
            if (claimTxHash && !completion.claimTxHash) {
                await completionsCollection.updateOne(
                    { _id: completion._id } as any,
                    { $set: { claimTxHash } }
                );
            }
            return NextResponse.json({
                success: true,
                message: 'Already marked as claimed.',
            });
        }

        const update: Record<string, unknown> = {
            claimStatus: 'claimed',
            claimedAt: new Date(),
        };
        if (claimTxHash) update.claimTxHash = claimTxHash;
        if (completion.claimAmount != null) update.claimAmount = completion.claimAmount;
        if (userUsername) update.userUsername = userUsername;
        if (userDisplayName) update.userDisplayName = userDisplayName;
        if (userPfpUrl) update.userPfpUrl = userPfpUrl;

        await completionsCollection.updateOne(
            { _id: completion._id } as any,
            { $set: update }
        );

        // Decrement task remainingBudget so UI/leaderboard can show correct remaining (aligned with contract payouts)
        const claimAmount = completion.claimAmount ?? 0;
        if (claimAmount > 0 && completion.taskId) {
            try {
                await tasksCollection.updateOne(
                    { _id: new ObjectId(completion.taskId) } as any,
                    { $inc: { remainingBudget: -claimAmount } }
                );
            } catch (e) {
                console.warn('Failed to decrement task remainingBudget:', e);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Marked as claimed.',
        });
    } catch (error) {
        console.error('Error marking claim complete:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
