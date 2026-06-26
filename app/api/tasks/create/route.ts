import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { getPerUserReward, getMaxCompletionsForToken } from '@/lib/taskRewards';
import { fetchGDollarPrice } from '@/lib/gdollarPrice';
import { keccak256, toUtf8Bytes } from 'ethers';
import { getAuthFromRequest } from '@/lib/authMiddleware';
import { getUserByWallet } from '@/lib/userAccountLinks';
import {
  ARBITRUM_CHAIN_ID,
  CELO_CHAIN_ID,
  getChainConfig,
  validateChainTokenPair,
} from '@/lib/chainConfig';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            type,
            targetUrl,
            targetUsername,
            targetFid,
            totalBudget,
            expiresInDays,
            creatorFid,
            creatorAddress,
            creatorProfile,
            description,
            castHash,
            channelId,
            miniappUrl,
            miniappAudience,
            miniappFeedbackCastHash,
            miniappFeedbackCastData,
            miniappFeedbackMode,
            minFollowers,
            minNeynarScore,
            proSubscribersOnly,
            minAccountAgeDays,
            nonSpamOnly,
            castData,
            miniappData,
            // X (Twitter) quest fields
            xTargetUsername,
            xTargetUserId,
            xTargetAvatar,
            xTargetFollowers,
            xTweetId,
            xTweetUrl,
            xTweetData,
            minXFollowers,
            chainId: bodyChainId,
            rewardToken: bodyRewardToken,
        } = body;

        const chainId = bodyChainId != null ? Number(bodyChainId) : ARBITRUM_CHAIN_ID;
        const rewardToken = bodyRewardToken === 'G$' ? 'G$' : 'USDC';
        const pairError = validateChainTokenPair(chainId, rewardToken);
        if (pairError) {
            return NextResponse.json({ error: pairError }, { status: 400 });
        }
        const chainConfig = getChainConfig(chainId);

        // Validation
        if (!type || !totalBudget) {
            return NextResponse.json({ error: 'Missing required fields: type, totalBudget' }, { status: 400 });
        }

        const auth = await getAuthFromRequest(req);
        const normalizedCreator = creatorAddress?.toLowerCase();

        if (auth.source === 'browser') {
            if (!normalizedCreator || !auth.walletAddress || auth.walletAddress !== normalizedCreator) {
                return NextResponse.json({ error: 'Unauthorized creator address' }, { status: 401 });
            }
        } else if (!creatorFid) {
            return NextResponse.json({ error: 'Missing required field: creatorFid' }, { status: 400 });
        }

        if (!['follow', 'boost_lite', 'boost', 'quote', 'channel', 'multi', 'miniapp', 'x_follow', 'x_boost_lite', 'x_boost', 'x_bundle'].includes(type)) {
            return NextResponse.json({ error: 'Invalid task type' }, { status: 400 });
        }

        const isGQuest = chainId === CELO_CHAIN_ID;
        const budgetMin = isGQuest ? 1 : 1;
        const budgetMax = isGQuest ? 50000 : 100;
        const budgetLabel = isGQuest ? 'G$' : 'USDC';

        if (totalBudget < budgetMin || totalBudget > budgetMax) {
            return NextResponse.json(
                { error: `Total budget must be between ${budgetMin} and ${budgetMax} ${budgetLabel}` },
                { status: 400 },
            );
        }

        if (!expiresInDays || expiresInDays < 1 || expiresInDays > 7) {
            return NextResponse.json({ error: 'Expiry must be between 1 and 7 days' }, { status: 400 });
        }

        if (
            type === 'miniapp' &&
            miniappFeedbackMode != null &&
            miniappFeedbackMode !== 'comment' &&
            miniappFeedbackMode !== 'quote'
        ) {
            return NextResponse.json({ error: 'miniappFeedbackMode must be comment or quote' }, { status: 400 });
        }

        // Compute from server-side config (do not trust client for limits)
        const gDollarPrice = isGQuest ? await fetchGDollarPrice() : 1;
        const rewardAmount = getPerUserReward(type, rewardToken, gDollarPrice);
        const maxCompletions = getMaxCompletionsForToken(totalBudget, type, rewardToken, gDollarPrice);

        // Only persist feedback mode when the client sets comment or quote; if null/undefined with a
        // feedback cast hash, the quest is open + add only (no feedback step).
        const storedMiniappFeedbackMode: 'comment' | 'quote' | undefined =
            type === 'miniapp' && miniappFeedbackCastHash && miniappFeedbackMode != null
                ? miniappFeedbackMode === 'quote'
                    ? 'quote'
                    : 'comment'
                : undefined;

        // Generate on-chain taskId (bytes32)
        const idSeed = creatorFid ?? normalizedCreator ?? 'anon';
        const rawId = `${idSeed}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const onChainTaskId = keccak256(toUtf8Bytes(rawId));

        let storedCreatorProfile = creatorProfile;
        if (auth.source === 'browser' && normalizedCreator && !storedCreatorProfile) {
            const link = await getUserByWallet(normalizedCreator);
            if (link) {
                storedCreatorProfile = {
                    displayName: link.displayName,
                    username: link.username,
                    pfpUrl: link.pfpUrl,
                };
            }
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');

        const newTask: BountyTask = {
            creatorFid: creatorFid != null ? Number(creatorFid) : undefined,
            creatorAddress: normalizedCreator,
            creatorProfile: storedCreatorProfile,
            type,
            targetUrl,
            targetUsername,
            targetFid,
            description,
            rewardAmount,
            rewardToken,
            chainId: chainId as 42161 | 42220,
            ubiFeeAmount: isGQuest ? chainConfig.ubiFeeAmount : undefined,
            totalBudget,
            remainingBudget: totalBudget,
            completedBy: [],
            completedByWallets: [],
            maxCompletions,
            expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            castHash,
            channelId,
            miniappUrl,
            miniappAudience: type === 'miniapp' ? (miniappAudience || 'all_users') : undefined,
            miniappFeedbackCastHash: type === 'miniapp' ? (miniappFeedbackCastHash || undefined) : undefined,
            miniappFeedbackCastData: type === 'miniapp' ? (miniappFeedbackCastData || undefined) : undefined,
            miniappFeedbackMode: storedMiniappFeedbackMode,
            minFollowers: minFollowers != null && minFollowers > 0 ? minFollowers : undefined,
            minNeynarScore: minNeynarScore != null && minNeynarScore >= 0 ? minNeynarScore : undefined,
            proSubscribersOnly: !!proSubscribersOnly,
            minAccountAgeDays: minAccountAgeDays != null && minAccountAgeDays > 0 ? minAccountAgeDays : undefined,
            nonSpamOnly: !!nonSpamOnly,
            castData: castData || undefined,
            miniappData: miniappData || undefined,
            // X (Twitter) quest fields
            xTargetUsername: xTargetUsername || undefined,
            xTargetUserId: xTargetUserId || undefined,
            xTargetAvatar: xTargetAvatar || undefined,
            xTargetFollowers: xTargetFollowers != null ? xTargetFollowers : undefined,
            xTweetId: xTweetId || undefined,
            xTweetUrl: xTweetUrl || undefined,
            xTweetData: xTweetData || undefined,
            minXFollowers: minXFollowers != null && minXFollowers > 0 ? minXFollowers : undefined,
            // On-chain fields
            status: 'pending_deposit',
            onChainTaskId,
        };

        const result = await tasksCollection.insertOne(newTask);

        return NextResponse.json({
            success: true,
            taskId: result.insertedId,
            onChainTaskId,
            chainId,
            rewardToken,
            ubiFeeAmount: isGQuest ? chainConfig.ubiFeeAmount : undefined,
            feeRecipient: chainConfig.feeRecipient,
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
