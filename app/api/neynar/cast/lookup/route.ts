import { NextRequest, NextResponse } from 'next/server';
import { lookupCastByHashOrUrl } from '@/lib/api';
import { parseViewerFid } from '@/lib/neynar';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const identifier = searchParams.get('identifier');
    const type = searchParams.get('type') as 'url' | 'hash' | null;
    const viewerFid = parseViewerFid(searchParams.get('viewerFid'));

    if (!identifier || !type || !['url', 'hash'].includes(type)) {
        return NextResponse.json(
            { error: 'Missing or invalid identifier or type (use type=url or type=hash)' },
            { status: 400 }
        );
    }

    const cast = await lookupCastByHashOrUrl(
        identifier,
        type,
        viewerFid
    );

    if (!cast) {
        return NextResponse.json({ error: 'Cast not found', cast: null }, { status: 404 });
    }

    return NextResponse.json({ cast });
}
