import { NextRequest, NextResponse } from 'next/server';
import { rapidApiGet, RAPIDAPI_HOST } from '@/lib/rapidApiClient';

/**
 * GET /api/twitter/search?q=<query>
 * Proxy to RapidAPI Twitter search (People).
 * Uses multi-key fallback + caching via rapidApiClient.
 */
export async function GET(req: NextRequest) {
    try {
        const q = req.nextUrl.searchParams.get('q');
        if (!q || q.trim().length < 2) {
            return NextResponse.json({ error: 'Query too short' }, { status: 400 });
        }

        const res = await rapidApiGet({
            url: `https://${RAPIDAPI_HOST}/search.php`,
            params: { query: q.trim(), search_type: 'People' },
            timeout: 10000,
        });

        const data = res.data;
        if (data?.status !== 'ok' && !data?.timeline) {
            return NextResponse.json({ users: [] });
        }

        // Parse results into a clean format
        const timeline = data.timeline || [];
        const users = timeline.map((entry: any) => ({
            userId: entry.user_id || entry.rest_id || '',
            username: entry.screen_name || '',
            name: entry.name || '',
            avatar: entry.avatar || entry.profile_image_url_https || '',
            followers: entry.sub_count || entry.followers_count || 0,
            verified: entry.blue_verified || false,
            description: entry.desc || entry.description || '',
        })).filter((u: any) => u.username);

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error('Twitter search error:', error?.message);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}
