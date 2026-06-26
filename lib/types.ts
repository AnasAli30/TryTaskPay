import type { ObjectId } from 'mongodb';

/** Farcaster signed-key request + auto-boost opt-in (Mongo `farcasterUserSigners`). */
export interface FarcasterUserSignerDoc {
  userFid: number;
  /** @deprecated Legacy Neynar rows only; native signers omit this. */
  signerUuid?: string;
  /** Ed25519 public key `0x…` from signed-key request (matches Farcaster API `key`). */
  ed25519PublicKeyHex?: string;
  /** AES-GCM payload (iv + ciphertext); server-only. */
  encryptedEd25519PrivateKey?: string;
  /** Poll token from `POST /v2/signed-key-requests`. */
  signedKeyRequestToken?: string;
  /** Mirror of Farcaster API while not yet `completed`. */
  signedKeyRequestState?: 'pending' | 'approved' | 'completed';
  signerStatus: 'generated' | 'pending_approval' | 'approved' | 'revoked';
  /** When true, server may like+recast on boost_lite via approved signer + hub. */
  autoBoostOptIn: boolean;
  /** Warpcast deeplink from signed-key request (`deeplinkUrl`). */
  signerApprovalUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Idempotent boost_lite auto-reaction runs (Mongo `boostLiteAutoExecutions`). */
export interface BoostLiteAutoExecutionDoc {
  taskId: ObjectId;
  userFid: number;
  castHash: string;
  likeDone: boolean;
  recastDone: boolean;
  lastError?: string;
  updatedAt: Date;
}

export interface UserAccountLink {
  walletAddress: string;
  fid?: number;
  xUsername?: string;
  xUserId?: string;
  displayName?: string;
  username?: string;
  pfpUrl?: string;
  email?: string;
  emailVerified?: boolean;
  walletVerifiedAt: Date;
  farcasterLinkedAt?: Date;
  xLinkedAt?: Date;
  updatedAt: Date;
}

export interface CreatorProfileSnapshot {
  displayName?: string;
  username?: string;
  pfpUrl?: string;
}

export interface CustomActionTaskMeta {
  appName: string;
  appImageUrl?: string;
  rewardBaseUrl: string;
  actionName: string;
  contractAddress: string;
  functionSelector?: string;
  functionName?: string;
  trackedEvent: CustomActionTrackedEvent;
  distributionChannels: CustomActionDistributionChannel[];
}

export interface BountyTask {
    _id?: any;
    creatorFid?: number;
    type:
      | 'follow'
      | 'boost_lite'
      | 'boost'
      | 'quote'
      | 'channel'
      | 'multi'
      | 'miniapp'
      | 'x_follow'
      | 'x_boost_lite'
      | 'x_boost'
      | 'x_bundle'
      | 'custom_onchain';
    status?: 'pending_deposit' | 'active' | 'completed' | 'expired' | 'verified';

    // Target info
    targetUrl?: string;
    targetUsername?: string;
    targetFid?: number;
    castHash?: string;
    channelId?: string;
    miniappUrl?: string;
    /** For miniapp: only users who have not completed a quest with this miniapp URL can do this task */
    miniappAudience?: 'new_users_only' | 'all_users';
    /** For miniapp: cast where users must comment or quote for feedback (hash + optional display data) */
    miniappFeedbackCastHash?: string;
    miniappFeedbackCastData?: { text?: string; authorUsername?: string; authorPfp?: string; authorDisplayName?: string };
    /** How feedback on the cast is verified: comment (reply) vs quote. Defaults to comment when omitted (existing tasks). */
    miniappFeedbackMode?: 'comment' | 'quote';

    /** Optional eligibility (Neynar user/bulk): min followers, min score, pro only, min account age days */
    minFollowers?: number;
    minNeynarScore?: number;
    proSubscribersOnly?: boolean;
    minAccountAgeDays?: number;
    /** When true, only users with Farcaster spam label >= 2 can participate */
    nonSpamOnly?: boolean;

    // X (Twitter) quest fields
    xTargetUsername?: string;       // X handle to follow (Grow)
    xTargetUserId?: string;         // X user ID
    xTargetAvatar?: string;         // X user avatar URL
    xTargetFollowers?: number;      // X user follower count
    xTweetId?: string;              // Tweet ID for Boost/Bundle
    xTweetUrl?: string;             // Full tweet URL
    xTweetData?: {                  // Tweet data stored at creation
        text?: string;
        authorUsername?: string;
        authorName?: string;
        authorAvatar?: string;
        authorVerified?: boolean;
        likeCount?: number;
        retweetCount?: number;
        replyCount?: number;
        quoteCount?: number;
        media?: { url: string; type: string }[];
        createdAt?: string;
    };
    minXFollowers?: number;         // Targeting: min X followers

    // Content
    description?: string;
    castData?: any;
    miniappData?: any;

    // Rewards
    rewardAmount?: number;
    rewardToken?: 'USDC' | 'G$';
    chainId?: 42161 | 42220;
    ubiFeeAmount?: number;
    totalBudget?: number;
    remainingBudget?: number;
    computedRewardPerUser?: number;

    // Limits
    maxCompletions?: number;
    completedBy?: number[]; // Array of FIDs
    completedByWallets?: string[]; // Browser wallet-only participants

    // Timing
    createdAt?: Date;
    expiresAt?: Date;
    verifiedAt?: Date;
    reclaimedAt?: Date;
    reclaimTxHash?: string;

    /** Links to customActionRequests when type is custom_onchain */
    customActionId?: string;
    /** Snapshot of custom action display + on-chain config at launch */
    customActionMeta?: CustomActionTaskMeta;

    // On-chain
    onChainTaskId?: string;
    creatorAddress?: string;
    creatorProfile?: CreatorProfileSnapshot;
    depositTxHash?: string;

    /** Banned for bots (set by admin script) */
    isBotBanned?: boolean;
}

export interface TaskCompletion {
    _id?: any;
    taskId: string;
    userFid?: number;
    userWallet?: string;
    userAddress?: string;
    creatorFid?: number;
    status: 'pending' | 'success' | 'failed';
    claimStatus: 'unclaimed' | 'claimed' | 'reclaimed';
    isBot?: boolean;
    claimAmount?: number;
    claimNonce?: number;
    claimTxHash?: string;
    submittedAt: Date;
    verifyTxHash?: string;
    // Snapshot of user profile at time of claim (to avoid extra Neynar lookups)
    userUsername?: string;
    userDisplayName?: string;
    userPfpUrl?: string;
    claimedAt?: Date;
}

export type CustomActionCategory =
    | 'defi'
    | 'nft'
    | 'gaming'
    | 'social'
    | 'bridge'
    | 'governance'
    | 'payments'
    | 'other';

export type CustomActionReviewStatus = 'pending_review' | 'approved' | 'rejected';

export type CustomActionDistributionChannel = 'farcaster' | 'dapp';

export interface CustomActionTrackedEvent {
    signature: string;
    name?: string;
    logIndex: number;
    address?: string;
}

export interface CustomActionLaunchDraft {
    perUserRewardUsdc: number;
    totalBudgetUsdc: number;
    maxCompletions: number;
    expiresInDays: 1 | 3;
    platformFeeUsdc: number;
    targetingEnabled?: boolean;
    minFollowers?: number;
    minNeynarScore?: number;
    minAccountAgeDays?: number;
    nonSpamOnly?: boolean;
    savedAt: Date;
}

export interface CustomActionRequest {
    _id?: ObjectId;
    creatorFid?: number;
    creatorAddress: string;
    creatorProfile?: CreatorProfileSnapshot;
    status: CustomActionReviewStatus;
    appName: string;
    appImageUrl?: string;
    rewardBaseUrl: string;
    category: CustomActionCategory;
    distributionChannels: CustomActionDistributionChannel[];
    actionName: string;
    rewardDescription: string;
    userFacingDescription?: string;
    exampleTxHash: string;
    chainId: 42161 | 42220;
    contractAddress: string;
    functionSelector?: string;
    functionName?: string;
    trackedEvent: CustomActionTrackedEvent;
    alternateEvents?: CustomActionTrackedEvent[];
    parsedTxSnapshot: Record<string, unknown>;
    submittedAt: Date;
    reviewedAt?: Date;
    rejectionReason?: string;
    launchDraft?: CustomActionLaunchDraft;
    launchedTaskId?: string;
}
