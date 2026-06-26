import { unstable_noStore } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { userAlreadyDidQuestForSameMiniapp } from '@/lib/miniappNewUsersOnly';
import { lookupCastByHashOrUrl } from '@/lib/api';
import {
  fetchWithNeynarFallback,
  getNeynarApiKey,
  logNeynarHttpFailure,
  NEYNAR_API_BASE_URL,
} from '@/lib/neynar';
import { evaluatePublicSpamLabel, NON_SPAM_QUEST_MESSAGE } from '@/lib/farcasterSpamLabel';

/** Avoid Next.js Data Cache + stale Neynar reads for verification. */
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const VERIFY_CACHE_CONTROL =
  'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';

function jsonVerify(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', VERIFY_CACHE_CONTROL);
  return NextResponse.json(data, { ...init, headers });
}

async function checkFollow(sourceFid: number, targetFid: number): Promise<boolean> {
  const url = `${NEYNAR_API_BASE_URL}/user/bulk/`;
  const res = await fetchWithNeynarFallback(`${url}?fids=${targetFid}&viewer_fid=${sourceFid}`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (!res.ok) return false;
  const data = await res.json();
  return !!(data.users[0].viewer_context.following && data.users.length > 0);
}

async function checkLikedCast(castHash: string, viewerFid: number): Promise<boolean> {
  const cast = await lookupCastByHashOrUrl(castHash, 'hash', viewerFid);
  return !!cast?.viewer_context?.liked;
}

async function checkQuotedCast(castHash: string, viewerFid: number): Promise<boolean> {
  const baseUrl = `${NEYNAR_API_BASE_URL}/cast/quotes/`;
  let cursor: string | undefined;
  const apiKey = getNeynarApiKey();

  // Paginate through all quote casts for the target hash
  do {
    const params = new URLSearchParams({
      identifier: castHash,
      type: 'hash',
      viewer_fid: String(viewerFid),
      limit: '50',
    });
    if (cursor) params.set('cursor', cursor);

    const quoteUrl = `${baseUrl}?${params.toString()}`;
    const res = await fetch(quoteUrl, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store',
    });
    console.log(res);
    if (!res.ok) {
      await logNeynarHttpFailure(res, apiKey, quoteUrl, 'tasks/verify cast/quotes');
      return false;
    }

    const data = await res.json();
    const quotes = data.casts ?? data.result?.casts ?? [];

    // Check if any quote was authored by this viewer (your FID)
    if (quotes.some((q: any) => q?.author?.fid === viewerFid)) {
      return true;
    }

    cursor = data?.next?.cursor ?? data?.result?.next?.cursor ?? undefined;
  } while (cursor);

  return false;
}

async function checkCommentedCast(
  identifier: string | undefined,
  viewerFid: number,
): Promise<boolean> {
  if (!identifier) return false;

  // First, resolve the target cast hash (supports both URL and hash identifiers)
  const isUrl = identifier.startsWith('http');
  const targetCast = await lookupCastByHashOrUrl(identifier, isUrl ? 'url' : 'hash', viewerFid);
  const targetHash = targetCast?.hash || (!isUrl ? identifier : undefined);
  if (!targetHash) return false;

  // Use Neynar "Replies and recasts" feed, filtered to replies only
  const url = `${NEYNAR_API_BASE_URL}/feed/user/replies_and_recasts/`;
  let cursor: string | undefined;


  const params = new URLSearchParams({
    fid: String(viewerFid),
    filter: 'replies',
    limit: '10',
    viewer_fid: String(viewerFid),
  });
  if (cursor) params.set('cursor', cursor);

  const options = { method: 'GET', cache: 'no-store' as RequestCache, headers: { 'x-api-key': getNeynarApiKey() } };
  const res = await fetch(`${url}?${params.toString()}`, options);

  if (!res.ok) return false;

  const data = await res.json();
  const casts = data?.casts ?? data?.result?.casts ?? [];
  console.log("replaies -", casts)
  if (casts.some((c: any) => c?.parent_hash === targetHash)) return true;
  return false;
}

/** Resolve miniapp feedback cast to canonical hash for quote API (supports URL or hash). */
async function resolveFeedbackCastHash(
  identifier: string | undefined,
  viewerFid: number,
): Promise<string | undefined> {
  if (!identifier) return undefined;
  const isUrl = identifier.startsWith('http');
  const targetCast = await lookupCastByHashOrUrl(identifier, isUrl ? 'url' : 'hash', viewerFid);
  return targetCast?.hash || (!isUrl ? identifier : undefined);
}

/**
 * Normalize channel identifier: from URL like
 * https://farcaster.xyz/~/channel/vibe-most-wanted → vibe-most-wanted (channel id).
 * If already a slug (no /channel/ in it), return as-is.
 */
function normalizeChannelId(channelIdOrUrl: string): string {
  const lower = channelIdOrUrl.trim().toLowerCase();
  const match = lower.match(/\/channel\/([^/?#]+)/);
  return match ? match[1] : channelIdOrUrl.trim();
}

/**
 * Check if user (fid) is a member of the target channel.
 * Uses GET /v2/farcaster/channel/member/list/?channel_id=X&fid=Y for real-time,
 * non-cached results (the old /channel/followers/ endpoint returned stale/cached data).
 * The `fid` query param lets us check a single user without paginating.
 * Accepts channel id (e.g. taskpay) or full URL (e.g. https://farcaster.xyz/~/channel/taskpay).
 * @see https://docs.neynar.com/reference/fetch-channel-members
 */
async function checkChannelMember(channelId: string | undefined, fid: number): Promise<boolean> {
  unstable_noStore();
  if (!channelId) return false;

  const channelSlug = normalizeChannelId(channelId).toLowerCase();
  const apiKey = getNeynarApiKey();
  const baseUrl = `${NEYNAR_API_BASE_URL}/channel/followers/`;
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      id: channelSlug,
      limit: '100',
    });
    if (cursor) params.set('cursor', cursor);

    const followersUrl = `${baseUrl}?${params.toString()}`;
    const res = await fetchWithNeynarFallback(followersUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) {
      await logNeynarHttpFailure(res, apiKey, followersUrl, 'tasks/verify channel/followers');
      return false;
    }

    const data = await res.json();
    console.log(data)
    const users = data?.users ?? data?.result?.users ?? [];
    if (users.some((u: { fid?: number }) => u?.fid === fid)) {
      return true;
    }

    cursor = data?.next?.cursor ?? data?.result?.next?.cursor ?? undefined;
  } while (cursor);

  return false;
}

/**
 * POST /api/tasks/verify
 * 
 * User must first call verifyTask(taskId) on-chain, then call this API.
 * This API checks for the TaskVerified event, then performs Neynar checks,
 * and creates a TaskCompletion record with status: 'pending'.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, userFid, userAddress, verifyTxHash } = body as {
      taskId?: string;
      userFid?: number;
      userAddress?: string;
      verifyTxHash?: string; // Transaction hash of the on-chain verifyTask call
    };
    const db = await getDatabase();
    const tasksCollection = db.collection<BountyTask>('tasks');
    const miniappOpensCollection = db.collection<{ taskId: ObjectId; userFid: number; openedAt: Date }>('taskMiniappOpens');
    const miniappAddsCollection = db.collection<{ taskId: ObjectId; userFid: number; addedAt: Date }>('taskMiniappAdds');
    const _id = new ObjectId(taskId);

    const task = await tasksCollection.findOne({ _id } as any);
    console.log(task, body)
    if (!task) {
      return jsonVerify({ error: 'Task not found' }, { status: 404 });
    }

    // Check task is active
    if (task.status !== 'active') {
      return jsonVerify({ error: `Task is not active (current: ${task.status})` }, { status: 400 });
    }

    // Check not expired
    if (task.expiresAt && new Date(task.expiresAt) < new Date()) {
      return jsonVerify({ error: 'Task has expired' }, { status: 400 });
    }

    // Check max completions
    const currentCompletions = task.completedBy?.length || 0;
    const maxCompletions = task.maxCompletions || 0;
    if (maxCompletions > 0 && currentCompletions >= maxCompletions) {
      return jsonVerify({ error: 'Task has reached maximum number of participants' }, { status: 400 });
    }

    const fid = Number(userFid);

    // Miniapp "new users only" — shared with check-eligibility
    if (await userAlreadyDidQuestForSameMiniapp(db, task, fid)) {
      console.log(
        "This quest is for new users only. You have already completed a quest for this app"
      )
      return jsonVerify({
        success: false,
        verified: false,
        message: 'This quest is for new users only. You have already completed a quest for this app.',
      }, { status: 200 });
    }

    // Run task verification checks
    let verified = false;
    const checks: {
      follow?: boolean;
      like?: boolean;
      quote?: boolean;
      comment?: boolean;
      recast?: boolean;
      channel?: boolean;
      miniappOpened?: boolean;
      miniappAdded?: boolean;
      miniappComment?: boolean;
      miniappQuote?: boolean;
    } = {};

    // Load existing progress
    const progressCollection = db.collection('taskVerificationProgress');
    const existingProgress = await progressCollection.findOne({ taskId: _id, userFid: fid });
    if (existingProgress?.checks) {
      Object.assign(checks, existingProgress.checks);
    }

    switch (task.type) {
      case 'follow':
        if (task.targetFid) {
          if (!checks.follow) {
            const f = await checkFollow(fid, task.targetFid);
            checks.follow = f;
          }
          verified = !!checks.follow;
        }
        break;
      case 'boost_lite':
        if (task.castHash) {
          // Retries help after server-side auto-reactions (indexer lag).
          const maxAttempts = 4;
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
              await new Promise((r) => setTimeout(r, 1800));
            }
            if (!checks.like) {
              checks.like = await checkLikedCast(task.castHash, fid);
            }
            let recasted_lite = !!checks.recast;
            if (!recasted_lite) {
              const cast = await lookupCastByHashOrUrl(task.castHash, 'hash', fid);
              recasted_lite = !!cast?.viewer_context?.recasted;
              checks.recast = recasted_lite;
            }
            verified = !!checks.like && !!checks.recast;
            if (verified) break;
          }
        }
        break;
      case 'boost':
        if (task.castHash) {
          const [liked, quoted, commented] = await Promise.all([
            checks.like ? true : checkLikedCast(task.castHash, fid),
            checks.quote ? true : checkQuotedCast(task.castHash, fid),
            checks.comment ? true : checkCommentedCast(task.castHash, fid),
          ]);
          checks.like = liked;
          checks.quote = quoted;
          checks.comment = commented;

          let recasted = !!checks.recast;
          if (!recasted) {
            const cast = await lookupCastByHashOrUrl(task.castHash, 'hash', fid);
            recasted = !!cast?.viewer_context?.recasted;
            checks.recast = recasted;
          }

          verified = liked && quoted && commented && recasted;
        }
        break;
      case 'quote':
        if (task.castHash) {
          if (!checks.quote) {
            const q = await checkQuotedCast(task.castHash, fid);
            checks.quote = q;
          }
          verified = !!checks.quote;
        }
        break;
      case 'multi':
        if (task.castHash && task.targetFid) {
          const [isFollowing, liked, quoted, commented] = await Promise.all([
            checks.follow ? true : checkFollow(fid, task.targetFid),
            checks.like ? true : checkLikedCast(task.castHash, fid),
            checks.quote ? true : checkQuotedCast(task.castHash, fid),
            checks.comment ? true : checkCommentedCast(task.castHash, fid),
          ]);
          checks.follow = isFollowing;
          checks.like = liked;
          checks.quote = quoted;
          checks.comment = commented;

          let recasted = !!checks.recast;
          if (!recasted) {
            const cast = await lookupCastByHashOrUrl(task.castHash, 'hash', fid);
            recasted = !!cast?.viewer_context?.recasted;
            checks.recast = recasted;
          }

          verified = isFollowing && liked && quoted && commented && recasted;
        }
        break;
      case 'channel':
        {
          if (!checks.channel) {
            const channelIdOrUrl = task.channelId ?? task.targetUrl;
            const c = await checkChannelMember(channelIdOrUrl, fid);
            checks.channel = c;
          }
          verified = !!checks.channel;
        }
        break;
      case 'miniapp':
        {
          if (!checks.miniappOpened) {
            const opened = await miniappOpensCollection.findOne({ taskId: _id, userFid: fid });
            checks.miniappOpened = !!opened;
          }
          const hasFeedbackCast = !!task.miniappFeedbackCastHash;
          const feedbackMode: 'comment' | 'quote' | null =
            task.miniappFeedbackMode === 'quote'
              ? 'quote'
              : task.miniappFeedbackMode === 'comment'
                ? 'comment'
                : null;
          const feedbackStepRequired = hasFeedbackCast && feedbackMode !== null;
          if (hasFeedbackCast) {
            if (!checks.miniappAdded) {
              const added = await miniappAddsCollection.findOne({ taskId: _id, userFid: fid });
              checks.miniappAdded = !!added;
            }
            if (feedbackStepRequired) {
              if (feedbackMode === 'quote') {
                if (checks.miniappQuote !== true) {
                  const quoteHash = await resolveFeedbackCastHash(task.miniappFeedbackCastHash, fid);
                  checks.miniappQuote = quoteHash ? await checkQuotedCast(quoteHash, fid) : false;
                }
              } else if (checks.miniappComment !== true) {
                checks.miniappComment = await checkCommentedCast(task.miniappFeedbackCastHash, fid);
              }
            } else {
              checks.miniappQuote = true;
              checks.miniappComment = true;
            }
          } else {
            checks.miniappAdded = true;
            checks.miniappComment = true;
            checks.miniappQuote = true;
          }
          const feedbackOk =
            !hasFeedbackCast ||
            !feedbackStepRequired ||
            (feedbackMode === 'quote' ? !!checks.miniappQuote : !!checks.miniappComment);
          verified = !!checks.miniappOpened && (hasFeedbackCast ? !!checks.miniappAdded && feedbackOk : true);
        }
        break;
      case 'x_follow':
      case 'x_boost_lite':
      case 'x_boost':
      case 'x_bundle':
        {
          // Delegate to the twitter verify API
          const origin = req.nextUrl.origin;
          const twitterRes = await fetch(`${origin}/api/twitter/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId, userFid: fid }),
          });
          const twitterData = await twitterRes.json();
          if (twitterData.checks) Object.assign(checks, twitterData.checks);
          verified = !!twitterData.verified;
          if (!verified) {
            // Save progress and return early with the twitter verify response
            await progressCollection.updateOne(
              { taskId: _id, userFid: fid },
              { $set: { checks, updatedAt: new Date() } },
              { upsert: true }
            );
            return jsonVerify({
              success: false,
              verified: false,
              checks,
              message: twitterData.message || 'Complete all X tasks first.',
            }, { status: 200 });
          }
        }
        break;
      default:
        verified = false;
    }

    // Save progress
    await progressCollection.updateOne(
      { taskId: _id, userFid: fid },
      { $set: { checks, updatedAt: new Date() } },
      { upsert: true }
    );

    if (!verified) {
      // Return what checks failed so the user can fix them
      const missing: string[] = [];
      if (task.type === 'follow' || task.type === 'multi') {
        if (!checks.follow) missing.push('Follow the user');
      }
      if (task.type === 'boost_lite') {
        if (!checks.like) missing.push('Like the cast');
        if (!checks.recast) missing.push('Recast the cast');
      }
      if (task.type === 'boost' || task.type === 'multi') {
        if (!checks.like) missing.push('Like the cast');
        if (!checks.recast) missing.push('Recast the cast');
        if (!checks.quote) missing.push('Quote the cast');
        if (!checks.comment) missing.push('Comment on the cast');
      }
      if (task.type === 'quote' && !checks.quote) {
        missing.push('Quote the cast');
      }
      if (task.type === 'channel' && !checks.channel) {
        missing.push('Join the channel');
      }
      if (task.type === 'miniapp') {
        if (!checks.miniappOpened) missing.push('Open the mini app');
        if (task.miniappFeedbackCastHash) {
          const feedbackMode: 'comment' | 'quote' | null =
            task.miniappFeedbackMode === 'quote'
              ? 'quote'
              : task.miniappFeedbackMode === 'comment'
                ? 'comment'
                : null;
          if (!checks.miniappAdded) missing.push('Add the mini app');
          if (feedbackMode === 'quote' && !checks.miniappQuote) {
            missing.push('Quote this cast for feedback');
          } else if (feedbackMode === 'comment' && !checks.miniappComment) {
            missing.push('Comment feedback on the cast');
          }
        }
      }

      return jsonVerify({
        success: false,
        verified: false,
        checks,
        message: missing.length > 0
          ? `You still need to: ${missing.join(', ')}.`
          : 'Could not verify this task yet. Please complete it in Farcaster first.',
      }, { status: 200 });
    }

    // Non-spam only check (same logic as /api/tasks/check-eligibility)
    if (task.nonSpamOnly) {
      const spamOutcome = await evaluatePublicSpamLabel(fid, 'tasks/verify');
      if (spamOutcome === 'spam') {
        return jsonVerify(
          {
            success: false,
            verified: false,
            message: NON_SPAM_QUEST_MESSAGE,
          },
          { status: 200 },
        );
      }
    }

    // Optional targeting: only check when creator set something (Neynar score, followers, pro, account age)
    const hasTargeting =
      (task.minFollowers != null && task.minFollowers > 0) ||
      (task.minNeynarScore != null && task.minNeynarScore >= 0) ||
      task.proSubscribersOnly ||
      (task.minAccountAgeDays != null && task.minAccountAgeDays > 0);

    if (hasTargeting) {
      const apiKey = getNeynarApiKey();
      const bulkUrl = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fid}`;
      const bulkRes = await fetch(bulkUrl, {
        method: 'GET',
        headers: { 'x-api-key': apiKey, accept: 'application/json' },
        cache: 'no-store',
      });
      if (!bulkRes.ok) {
        await logNeynarHttpFailure(bulkRes, apiKey, bulkUrl, 'tasks/verify user/bulk (targeting)');
        return jsonVerify({
          success: false,
          verified: false,
          message: 'Could not verify your account eligibility. Please try again.',
        }, { status: 200 });
      }
      const bulkData = await bulkRes.json();
      const userData = bulkData?.users?.[0];
      if (!userData) {
        return jsonVerify({
          success: false,
          verified: false,
          message: 'Your account could not be found for eligibility check.',
        }, { status: 200 });
      }

      const followerCount = userData.follower_count ?? 0;
      const score = userData.score ?? userData.experimental?.neynar_user_score ?? 0;
      const isPro = userData.pro?.status === 'subscribed';
      const registeredAt = userData.registered_at ? new Date(userData.registered_at).getTime() : null;
      const accountAgeDays = registeredAt ? (Date.now() - registeredAt) / (24 * 60 * 60 * 1000) : 0;

      // Only when creator applied a Neynar score: check user's score meets the task minimum
      if (task.minNeynarScore != null && task.minNeynarScore >= 0 && score < task.minNeynarScore) {
        return jsonVerify({
          success: false,
          verified: false,
          message: `This quest requires a Neynar score of at least ${task.minNeynarScore.toFixed(2)}.`,
        }, { status: 200 });
      }
      if (task.minFollowers != null && task.minFollowers > 0 && followerCount < task.minFollowers) {
        return jsonVerify({
          success: false,
          verified: false,
          message: `This quest requires at least ${task.minFollowers} followers. You have ${followerCount}.`,
        }, { status: 200 });
      }
      if (task.proSubscribersOnly && !isPro) {
        return jsonVerify({
          success: false,
          verified: false,
          message: 'This quest is for Pro subscribers only.',
        }, { status: 200 });
      }
      if (task.minAccountAgeDays != null && task.minAccountAgeDays > 0 && accountAgeDays < task.minAccountAgeDays) {
        return jsonVerify({
          success: false,
          verified: false,
          message: `This quest requires an account at least ${task.minAccountAgeDays} days old.`,
        }, { status: 200 });
      }
    }

    // Task is verified off-chain
    // Return success so frontend can prompt user to call verifyTask() on-chain
    return jsonVerify({
      success: true,
      verified: true,
      onChainTaskId: task.onChainTaskId, // Frontend needs this for the contract call
      message: 'Task verified off-chain! Please sign the transaction to confirm on-chain.',
      checks,
    });
  } catch (error) {
    console.error('Error verifying task:', error);
    return jsonVerify({ error: 'Internal Server Error' }, { status: 500 });
  }
}
