import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { BountyTask } from '@/lib/types';
import { userAlreadyDidQuestForSameMiniapp } from '@/lib/miniappNewUsersOnly';
import {
  getNeynarApiKey,
  logNeynarHttpFailure,
  NEYNAR_API_BASE_URL,
} from '@/lib/neynar';
import { evaluatePublicSpamLabel, NON_SPAM_QUEST_MESSAGE } from '@/lib/farcasterSpamLabel';
import { fetchXFollowerCountByScreenName } from '@/lib/twitterRapidApi';

export type EligibilityResult = { eligible: true } | { eligible: false; message: string };

function hasFarcasterTargeting(task: BountyTask) {
  return (
    (task.minFollowers != null && task.minFollowers > 0) ||
    (task.minNeynarScore != null && task.minNeynarScore >= 0) ||
    !!task.proSubscribersOnly ||
    (task.minAccountAgeDays != null && task.minAccountAgeDays > 0)
  );
}

/**
 * Shared eligibility logic for:
 * - `/api/tasks/check-eligibility`
 * - server-side auto-execution filters (e.g. boost_lite)
 */
export async function checkEligibilityForTask(
  db: Db,
  task: BountyTask,
  userFid: number,
): Promise<EligibilityResult> {
  const fid = Number(userFid);
  if (!Number.isFinite(fid)) return { eligible: false, message: 'Invalid user' };

  // 0) Miniapp "new users only"
  if (await userAlreadyDidQuestForSameMiniapp(db, task, fid)) {
    return {
      eligible: false,
      message: 'This quest is for new users only. You have already completed a quest for this app.',
    };
  }

  // 1) Task-specific block list (only enforced when bot banning is enabled)
  if (task.isBotBanned) {
    const blockedCollection = db.collection('blockedTaskUsers');
    const isBlocked = await blockedCollection.findOne({ taskId: new ObjectId(String(task._id)), fid });
    if (isBlocked) {
      return { eligible: false, message: 'Your account is restricted from participating in this task.' };
    }
  }

  // 2) Non-spam only quests
  if (task.nonSpamOnly) {
    const spamOutcome = await evaluatePublicSpamLabel(fid, 'tasks/eligibility');
    if (spamOutcome === 'spam') {
      return { eligible: false, message: NON_SPAM_QUEST_MESSAGE };
    }
  }

  // 3) X (Twitter) quests: check X account linked + minXFollowers
  const isXTask =
    task.type === 'x_follow' ||
    task.type === 'x_boost_lite' ||
    task.type === 'x_boost' ||
    task.type === 'x_bundle';
  if (isXTask) {
    const apiKey = getNeynarApiKey();
    const bulkUrl = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fid}`;
    const bulkRes = await fetch(bulkUrl, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, accept: 'application/json' },
      cache: 'no-store',
    });

    if (bulkRes.ok) {
      const bulkData = await bulkRes.json();
      const userData = bulkData?.users?.[0];
      const verifiedAccounts = userData?.verified_accounts || [];
      const hasX = verifiedAccounts.some((a: any) => a.platform === 'x' || a.platform === 'twitter');
      if (!hasX) {
        return {
          eligible: false,
          message:
            'You need to link your X (Twitter) account to your Farcaster profile first. Go to Settings → Connected Accounts in Warpcast.',
        };
      }

      if (task.minXFollowers && task.minXFollowers > 0) {
        const xUsername = verifiedAccounts.find((a: any) => a.platform === 'x' || a.platform === 'twitter')
          ?.username;
        if (xUsername) {
          try {
            const xFollowers = await fetchXFollowerCountByScreenName(xUsername);
            if (xFollowers != null && xFollowers < task.minXFollowers) {
              return {
                eligible: false,
                message: `This quest requires at least ${task.minXFollowers} X followers. You have ${xFollowers}.`,
              };
            }
          } catch {
            // If X lookup fails, do not block eligibility (matches existing behavior).
          }
        }
      }
    }

    // For X tasks we don't enforce Farcaster targeting unless creator set Farcaster targeting too.
    if (!hasFarcasterTargeting(task)) return { eligible: true };
  }

  // 4) Farcaster targeting
  if (!hasFarcasterTargeting(task)) return { eligible: true };

  const apiKey = getNeynarApiKey();
  const bulkUrl = `${NEYNAR_API_BASE_URL}/user/bulk/?fids=${fid}`;
  const bulkRes = await fetch(bulkUrl, {
    method: 'GET',
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!bulkRes.ok) {
    await logNeynarHttpFailure(bulkRes, apiKey, bulkUrl, 'tasks/eligibility user/bulk');
    return { eligible: false, message: 'Could not verify your account eligibility. Please try again.' };
  }

  const bulkData = await bulkRes.json();
  const userData = bulkData?.users?.[0];
  if (!userData) {
    return { eligible: false, message: 'Your account could not be found for eligibility check.' };
  }

  const followerCount = userData.follower_count ?? 0;
  const score = userData.score ?? userData.experimental?.neynar_user_score ?? 0;
  const isPro = userData.pro?.status === 'subscribed';
  const registeredAt = userData.registered_at ? new Date(userData.registered_at).getTime() : null;
  const accountAgeDays = registeredAt ? (Date.now() - registeredAt) / (24 * 60 * 60 * 1000) : 0;

  if (task.minNeynarScore != null && task.minNeynarScore >= 0 && score < task.minNeynarScore) {
    return {
      eligible: false,
      message: `This quest requires a Neynar score of at least ${task.minNeynarScore.toFixed(2)}.`,
    };
  }
  if (task.minFollowers != null && task.minFollowers > 0 && followerCount < task.minFollowers) {
    return {
      eligible: false,
      message: `This quest requires at least ${task.minFollowers} followers. You have ${followerCount}.`,
    };
  }
  if (task.proSubscribersOnly && !isPro) {
    return { eligible: false, message: 'This quest is for Pro subscribers only.' };
  }
  if (task.minAccountAgeDays != null && task.minAccountAgeDays > 0 && accountAgeDays < task.minAccountAgeDays) {
    return {
      eligible: false,
      message: `This quest requires an account at least ${task.minAccountAgeDays} days old.`,
    };
  }

  return { eligible: true };
}

