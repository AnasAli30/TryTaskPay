import { NextRequest, NextResponse } from 'next/server';
import { getPublicSpamLabelDisplay } from '@/lib/farcasterSpamLabel';

export const dynamic = 'force-dynamic';

/**
 * GET /api/profile/public-spam-label?fid=123
 * Returns Farcaster publicSpamLabel tier for profile UI (same source as non-spam quest checks).
 */
export async function GET(req: NextRequest) {
  try {
    const fidRaw = new URL(req.url).searchParams.get('fid');
    const fid = fidRaw ? parseInt(fidRaw, 10) : NaN;
    if (!Number.isFinite(fid) || !Number.isInteger(fid) || fid <= 0) {
      return NextResponse.json({ error: 'Invalid fid' }, { status: 400 });
    }

    const data = await getPublicSpamLabelDisplay(fid);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('public-spam-label:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
