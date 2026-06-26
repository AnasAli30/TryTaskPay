import { NextRequest, NextResponse } from 'next/server';
import { searchUser } from '@/lib/api';
import { parseViewerFid } from '@/lib/neynar';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const viewerFid = parseViewerFid(searchParams.get('viewerFid'));

    if (!q) {
        return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    const users = await searchUser(q, viewerFid);
    return NextResponse.json({ users });
}
