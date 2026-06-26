import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const viewerFid = searchParams.get('viewerFid');
        const viewerWallet = searchParams.get('viewerWallet');
        const browserMode = searchParams.get('browserMode') === '1';

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');

        const query: any = {
            status: 'active',
            remainingBudget: { $gte: 0.01 },
            expiresAt: { $gt: new Date() },
        };

        if (viewerFid) {
            const vFid = parseInt(viewerFid, 10);
            query.completedBy = { $nin: [vFid] };
        }

        if (viewerWallet) {
            const w = viewerWallet.toLowerCase();
            query.completedByWallets = { $nin: [w] };
        }

        let tasks = await tasksCollection.find(query).limit(50).toArray();

        if (browserMode) {
            tasks = tasks.filter((t) => t.type !== 'miniapp' && t.type !== 'channel');
        }

        return NextResponse.json({ tasks }, { status: 200 });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
