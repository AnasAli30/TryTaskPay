import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

/**
 * GET /api/tasks/check-miniapp-quest?miniappUrl=...
 * Returns whether a quest with this miniapp URL was previously posted (excludes pending_deposit).
 * Used in CreateTask to show "Only new users" vs "All users" when hasExisting is true.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const miniappUrl = searchParams.get('miniappUrl')?.trim();
        if (!miniappUrl) {
            return NextResponse.json({ error: 'Missing miniappUrl' }, { status: 400 });
        }

        const db = await getDatabase();
        const tasksCollection = db.collection('tasks');

        const existing = await tasksCollection.findOne({
            miniappUrl,
            status: { $ne: 'pending_deposit' },
        });

        return NextResponse.json({ hasExisting: !!existing });
    } catch (error) {
        console.error('Error checking miniapp quest:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
