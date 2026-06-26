import { NextRequest, NextResponse } from 'next/server';
import { validateCast } from '@/lib/api';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const hash = searchParams.get('hash');

    if (!hash) {
        return NextResponse.json({ error: 'Missing hash' }, { status: 400 });
    }

    const cast = await validateCast(hash);
    if (!cast) {
        return NextResponse.json({ error: 'Cast not found' }, { status: 404 });
    }
    return NextResponse.json({ cast });
}
