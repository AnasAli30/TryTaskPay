import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getDatabase } from '@/lib/mongodb';
import type { CustomActionRequest } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Wallet sign-in required' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const creatorAddress = (
      searchParams.get('creatorAddress') || session.walletAddress
    ).toLowerCase();
    const creatorFidRaw = searchParams.get('creatorFid');
    const creatorFid = creatorFidRaw ? parseInt(creatorFidRaw, 10) : undefined;

    if (creatorAddress !== session.walletAddress.toLowerCase()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const db = await getDatabase();
    const collection = db.collection<CustomActionRequest>('customActionRequests');

    const filter: Record<string, unknown> = { creatorAddress };
    if (creatorFid != null && !Number.isNaN(creatorFid)) {
      filter.creatorFid = creatorFid;
    }

    const requests = await collection
      .find(filter)
      .sort({ submittedAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      requests: requests.map((r) => ({
        ...r,
        _id: r._id?.toString?.() ?? r._id,
      })),
    });
  } catch (error) {
    console.error('[custom-actions/mine]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
