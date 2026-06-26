import { NextRequest, NextResponse } from 'next/server';
import { fetchCastsForUser } from '@/lib/api';
import { parseViewerFid } from '@/lib/neynar';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get('fid');
    const viewerFid = parseViewerFid(searchParams.get('viewerFid'));

    if (!fid) {
        return NextResponse.json({ error: 'Missing fid' }, { status: 400 });
    }

    const casts = await fetchCastsForUser(parseInt(fid, 10), viewerFid);
    return NextResponse.json({ casts });
}
