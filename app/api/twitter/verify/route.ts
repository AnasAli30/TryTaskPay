import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { getNeynarApiKey, NEYNAR_API_BASE_URL } from '@/lib/neynar';
import { fetchXFollowerCountByScreenName } from '@/lib/twitterRapidApi';
import { rapidApiGet, RAPIDAPI_HOST } from '@/lib/rapidApiClient';
import { getUserByWallet } from '@/lib/userAccountLinks';

/** Timeline item is a retweet of `tweetId` if it references the original tweet id. */
function timelineItemRetweetsTweet(t: any, tweetId: string): boolean {
    const target = String(tweetId).trim();
    const rid = t?.retweeted?.id ?? t?.retweeted_tweet?.tweet_id;
    if (rid == null) return false;
    return String(rid) === target;
}

/**
 * Timeline item is a quote post of `tweetId` (user quoted that status).
 * twitter-api45 uses quoted.tweet_id, quoted_status_id_str, quoted_status, etc.
 */
function timelineItemQuotesTweet(t: any, tweetId: string): boolean {
    const target = String(tweetId).trim();
    const ids = [
        t?.quoted_status_id_str,
        t?.quoted_status_id,
        t?.quoted?.tweet_id,
        t?.quoted?.id,
        t?.quoted_status?.id_str,
        t?.quoted_status?.id,
        t?.quoted_status?.tweet_id,
        t?.quoted_tweet?.tweet_id,
        t?.quoted_tweet?.id_str,
        t?.quoted_tweet?.id,
    ];
    return ids.some((id) => id != null && String(id).trim() === target);
}

async function fetchUserTimelinePage(screenname: string, cursor?: string) {
    const params: Record<string, string> = { screenname };
    if (cursor) params.cursor = cursor;
    return rapidApiGet({
        url: `https://${RAPIDAPI_HOST}/timeline.php`,
        params,
        timeout: 15000,
    });
}

/**
 * Resolve X username from Farcaster FID via Neynar verified_accounts.
 */
async function resolveXUsername(fid?: number, userWallet?: string): Promise<string | null> {
    if (userWallet) {
        const link = await getUserByWallet(userWallet);
        if (link?.xUsername) return link.xUsername;
    }
    if (fid == null) return null;
    const apiKey = getNeynarApiKey();
    const url = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fid}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'x-api-key': apiKey, accept: 'application/json' },
        cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user = data?.users?.[0];
    if (!user) return null;

    // Check verified_accounts for X/Twitter
    const verified = user.verified_accounts || [];
    const xAccount = verified.find(
        (a: any) => a.platform === 'x' || a.platform === 'twitter'
    );
    return xAccount?.username || null;
}

/**
 * Check if userA follows userB on X.
 */
async function checkXFollow(userA: string, userB: string): Promise<boolean> {
    try {
        console.log('Checking if @' + userA + ' follows @' + userB);
        const res = await rapidApiGet({
            url: `https://${RAPIDAPI_HOST}/checkfollow.php`,
            params: { user: userA, follows: userB },
            timeout: 10000,
        });
        // API returns { status: "Following" } or { status: "Not Following" }
        console.log('checkXFollow response:', res.data);
        return res.data?.is_follow === true;
    } catch (e: any) {
        console.error('checkXFollow error:', e?.message);
        return false;
    }
}

/**
 * Check if user retweeted a specific tweet (same approach as quote check: timeline.php).
 * Scans pinned + timeline pages for retweeted.id / retweeted_tweet.tweet_id === target.
 */
async function checkXRetweet(screenname: string, tweetId: string): Promise<boolean> {
    try {
        console.log('Checking if @' + screenname + ' retweeted tweet ' + tweetId + ' (timeline)');
        const target = String(tweetId).trim();
        let cursor: string | undefined;
        const maxPages = 5;

        for (let page = 0; page < maxPages; page++) {
            const res = await fetchUserTimelinePage(screenname, cursor);
            const data = res.data;
            const pinned = data?.pinned;
            const timeline: any[] = Array.isArray(data?.timeline) ? data.timeline : [];

            if (pinned && timelineItemRetweetsTweet(pinned, target)) {
                console.log('checkXRetweet: match in pinned');
                return true;
            }
            if (timeline.some((t) => timelineItemRetweetsTweet(t, target))) {
                console.log('checkXRetweet: match in timeline page', page);
                return true;
            }

            cursor = data?.next_cursor;
            if (!cursor || timeline.length === 0) break;
        }
        return false;
    } catch (e: any) {
        console.error('checkXRetweet error:', e?.message);
        return false;
    }
}

/**
 * Check if user commented (replied) on the target tweet.
 * Fetches user's recent replies and checks if any have in_reply_to_status_id matching.
 */
async function checkXComment(screenname: string, tweetId: string): Promise<boolean> {
    try {
        const res = await rapidApiGet({
            url: `https://${RAPIDAPI_HOST}/replies.php`,
            params: { screenname },
            timeout: 10000,
        });
        const replies = res.data?.timeline || res.data?.replies || [];
        console.log('checkXComment replies:', replies);
        return replies.some(
            (r: any) =>
                r.in_reply_to_status_id_str === tweetId ||
                r.in_reply_to_status_id === tweetId ||
                r.conversation_id_str === tweetId ||
                r.conversation_id === tweetId
        );
    } catch (e: any) {
        console.error('checkXComment error:', e?.message);
        return false;
    }
}

/**
 * Check if user quoted the target tweet (timeline.php: pinned + paginated, same as retweet).
 * Previously only the first page was scanned and IDs were compared with === (type mismatch).
 */
async function checkXQuote(screenname: string, tweetId: string): Promise<boolean> {
    try {
        console.log('Checking if @' + screenname + ' quoted tweet ' + tweetId + ' (timeline)');
        const target = String(tweetId).trim();
        let cursor: string | undefined;
        const maxPages = 5;

        for (let page = 0; page < maxPages; page++) {
            const res = await fetchUserTimelinePage(screenname, cursor);
            const data = res.data;
            const pinned = data?.pinned;
            const timeline: any[] = Array.isArray(data?.timeline) ? data.timeline : [];

            if (pinned && timelineItemQuotesTweet(pinned, target)) {
                console.log('checkXQuote: match in pinned');
                return true;
            }
            if (timeline.some((t) => timelineItemQuotesTweet(t, target))) {
                console.log('checkXQuote: match in timeline page', page);
                return true;
            }

            cursor = data?.next_cursor;
            if (!cursor || timeline.length === 0) break;
        }
        return false;
    } catch (e: any) {
        console.error('checkXQuote error:', e?.message);
        return false;
    }
}

/**
 * POST /api/twitter/verify
 * Performs X verification checks for a task.
 * Body: { taskId, userFid?, userWallet? }
 * Uses multi-key fallback + caching via rapidApiClient.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { taskId, userFid, userWallet } = body;

        if (!taskId || (userFid == null && !userWallet)) {
            return NextResponse.json({ error: 'Missing taskId and userFid or userWallet' }, { status: 400 });
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');
        const _id = new ObjectId(taskId);
        const task = await tasksCollection.findOne({ _id } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const fid = userFid != null ? Number(userFid) : undefined;
        const wallet = typeof userWallet === 'string' ? userWallet.toLowerCase() : undefined;

        // 1. Resolve X username — browser OAuth first, then Neynar verified_accounts
        const xUsername = await resolveXUsername(fid, wallet);
        if (!xUsername) {
            return NextResponse.json({
                success: false,
                verified: false,
                checks: {},
                message: wallet
                    ? 'Connect your X account in Profile to complete X quests.'
                    : 'You need to link your X (Twitter) account to your Farcaster profile first. Go to Settings → Connected Accounts in Warpcast.',
            });
        }

        // 2. Load existing progress
        const progressCollection = db.collection('taskVerificationProgress');
        const progressKey = fid != null
            ? { taskId: _id, userFid: fid }
            : { taskId: _id, userWallet: wallet };
        const existingProgress = await progressCollection.findOne(progressKey);
        const checks: Record<string, boolean> = {};
        if (existingProgress?.checks) {
            Object.assign(checks, existingProgress.checks);
        }

        let verified = false;

        switch (task.type) {
            case 'x_follow': {
                if (task.xTargetUsername) {
                    if (!checks.x_follow) {
                        checks.x_follow = await checkXFollow(xUsername, task.xTargetUsername);
                    }
                    verified = !!checks.x_follow;
                }
                break;
            }
            case 'x_boost_lite': {
                if (task.xTweetId) {
                    // No reliable API check for Like with current providers.
                    // Treat like as "manual done" and only verify repost (retweet).
                    if (!checks.x_like) checks.x_like = true;
                    if (!checks.x_retweet) checks.x_retweet = await checkXRetweet(xUsername, task.xTweetId);
                    verified = !!checks.x_retweet;
                }
                break;
            }
            case 'x_boost': {
                if (task.xTweetId) {
                    const [retweeted, commented, quoted] = await Promise.all([
                        checks.x_retweet ? true : checkXRetweet(xUsername, task.xTweetId),
                        checks.x_comment ? true : checkXComment(xUsername, task.xTweetId),
                        checks.x_quote ? true : checkXQuote(xUsername, task.xTweetId),
                    ]);
                    checks.x_retweet = retweeted;
                    checks.x_comment = commented;
                    checks.x_quote = quoted;
                    // Like is auto-passed when all 3 are done
                    checks.x_like = retweeted && commented && quoted;
                    verified = retweeted && commented && quoted;
                }
                break;
            }
            case 'x_bundle': {
                if (task.xTargetUsername && task.xTweetId) {
                    const [following, retweeted, commented, quoted] = await Promise.all([
                        checks.x_follow ? true : checkXFollow(xUsername, task.xTargetUsername),
                        checks.x_retweet ? true : checkXRetweet(xUsername, task.xTweetId),
                        checks.x_comment ? true : checkXComment(xUsername, task.xTweetId),
                        checks.x_quote ? true : checkXQuote(xUsername, task.xTweetId),
                    ]);
                    checks.x_follow = following;
                    checks.x_retweet = retweeted;
                    checks.x_comment = commented;
                    checks.x_quote = quoted;
                    checks.x_like = retweeted && commented && quoted;
                    verified = following && retweeted && commented && quoted;
                }
                break;
            }
        }

        // Save progress
        await progressCollection.updateOne(
            progressKey,
            { $set: { checks, updatedAt: new Date(), ...(fid != null ? { userFid: fid } : { userWallet: wallet }) } },
            { upsert: true }
        );

        if (!verified) {
            const missing: string[] = [];
            if ((task.type === 'x_follow' || task.type === 'x_bundle') && !checks.x_follow) {
                missing.push(`Follow @${task.xTargetUsername} on X`);
            }
            if (task.type === 'x_boost_lite') {
                if (!checks.x_retweet) missing.push('Repost the post');
            }
            if (task.type === 'x_boost' || task.type === 'x_bundle') {
                if (!checks.x_retweet) missing.push('Retweet the post');
                if (!checks.x_comment) missing.push('Comment on the post');
                if (!checks.x_quote) missing.push('Quote the post');
            }

            return NextResponse.json({
                success: false,
                verified: false,
                checks,
                message: missing.length > 0
                    ? `You still need to: ${missing.join(', ')}.`
                    : 'Could not verify this task yet. Please complete it on X first.',
            });
        }

        // X username for eligibility targeting — check minXFollowers
        if (task.minXFollowers && task.minXFollowers > 0) {
            try {
                const followers = await fetchXFollowerCountByScreenName(xUsername);
                if (followers != null && followers < task.minXFollowers) {
                    return NextResponse.json({
                        success: false,
                        verified: false,
                        checks,
                        message: `This quest requires at least ${task.minXFollowers} X followers. You have ${followers}.`,
                    });
                }
            } catch (e) {
                console.error('Failed to check X follower count:', e);
            }
        }

        return NextResponse.json({
            success: true,
            verified: true,
            checks,
            onChainTaskId: task.onChainTaskId,
            message: 'Task verified off-chain! Please sign the transaction to confirm on-chain.',
        });
    } catch (error: any) {
        console.error('Twitter verify error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
