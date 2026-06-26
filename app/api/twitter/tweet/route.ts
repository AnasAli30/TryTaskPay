import { NextRequest, NextResponse } from 'next/server';
import { rapidApiGet, RAPIDAPI_HOST } from '@/lib/rapidApiClient';

/**
 * GET /api/twitter/tweet?id=<tweetId>
 * Proxy to RapidAPI tweet.php to fetch tweet details.
 * Accepts either a tweet ID or a full X/Twitter URL.
 * Uses multi-key fallback + caching via rapidApiClient.
 */
export async function GET(req: NextRequest) {
    try {
        let tweetId = req.nextUrl.searchParams.get('id') || '';
        
        // Extract tweet ID from URL if a full URL was passed
        const urlMatch = tweetId.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        if (urlMatch) {
            tweetId = urlMatch[1];
        }

        if (!tweetId || !/^\d+$/.test(tweetId.trim())) {
            return NextResponse.json({ error: 'Invalid tweet ID' }, { status: 400 });
        }

        const res = await rapidApiGet({
            url: `https://${RAPIDAPI_HOST}/tweet.php`,
            params: { id: tweetId.trim() },
            timeout: 10000,
        });

        const data = res.data;
        if (!data || data.error) {
            return NextResponse.json({ error: 'Tweet not found' }, { status: 404 });
        }

        // Normalize the response
        const tweet = {
            id: data.tweet_id || data.id || tweetId,
            text: data.text || '',
            authorUsername: data.author?.screen_name || data.screen_name || '',
            authorName: data.author?.name || data.name || '',
            authorAvatar: data.author?.avatar || data.author?.profile_image_url_https || '',
            authorVerified: data.author?.blue_verified || false,
            likeCount: data.favorites || data.favorite_count || 0,
            retweetCount: data.retweets || data.retweet_count || 0,
            replyCount: data.replies || data.reply_count || 0,
            quoteCount: data.quotes || data.quote_count || 0,
            media: (data.media?.photo || []).map((m: any) => ({
                url: m.media_url_https || m.url || '',
                type: 'photo',
            })).concat(
                (data.media?.video || []).map((m: any) => ({
                    url: m.poster || m.media_url_https || '',
                    type: 'video',
                }))
            ),
            createdAt: data.created_at || '',
            url: `https://x.com/${data.author?.screen_name || 'i'}/status/${data.tweet_id || tweetId}`,
        };

        return NextResponse.json({ tweet });
    } catch (error: any) {
        console.error('Twitter tweet fetch error:', error?.message);
        return NextResponse.json({ error: 'Failed to fetch tweet' }, { status: 500 });
    }
}
