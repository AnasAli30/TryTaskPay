"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faUser,
    faTasks,
    faPaintBrush,
    faCoins,
    faCheckCircle,
    faCircleCheck,
    faClock,
    faTimesCircle,
    faWallet,
    faUsers,
    faChartLine,
    faSpinner,
    faArrowUp,
    faBolt,
    faExternalLink,
    faShareNodes,
    faRotateLeft,
    faCalendarAlt,
    faLock,
    faChevronRight,
    faFilter,
    faShieldHalved,
    faTriangleExclamation,
    faCircleQuestion,
} from "@fortawesome/free-solid-svg-icons";
// Inline platform icons to avoid extra dependency
import axios from "axios";
import { XLogo } from '@/components/icons';
import { useFrame } from "@/components/farcaster-provider";
import { useAccount, usePublicClient, useWalletClient, useConfig } from "wagmi";
import { arbitrum, celo } from "wagmi/chains";
import { switchChain } from "wagmi/actions";
import { getTaskChainUi, getViemPublicClient } from "@/lib/questChainClient";
import { CELO_CHAIN_ID } from "@/lib/chainConfig";
import { getRewardTokenLabel } from "@/lib/questHelpers";
import { encodeFunctionData } from "viem";
import { captureTaskShareImage, TaskShareImageData, captureRewardClaimShareImage, RewardClaimShareImageData } from "@/lib/taskShareImage";
import { REQUIRE_SHARE_TO_UNLOCK_CLAIM, SHARE_TO_UNLOCK_CLAIM_MIN_USDC } from "@/lib/constants";
import { AutoBoostSigner } from "@/components/AutoBoostSigner";
import type { NeynarUser } from "@/types/neynar";
import sdk from '@farcaster/miniapp-sdk';
import { useUserIdentity } from '@/components/hooks/useUserIdentity';
import { useGDollarPrice } from '@/components/hooks/useGDollarPrice';
import { gDollarToUSD } from '@/lib/gdollarPrice';

/** Farcaster Pro verified badge SVG */
function ProBadge({ size = 28 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="#855DCD"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M 17 9 C 16.984699 8.44998 16.8169 7.914431 16.5147 7.45381 C 16.297401 7.122351 16.016399 6.83868 15.6895 6.61875 C 15.4741 6.47382 15.3639 6.206079 15.4143 5.9514 C 15.4908 5.56531 15.4893 5.16623 15.4095 4.777781 C 15.298 4.23797 15.0375 3.74074 14.6586 3.34142 C 14.2584 2.96254 13.762 2.70285 13.2222 2.59046 C 12.8341 2.51075 12.4353 2.5092 12.0495 2.5855 C 11.7944 2.63594 11.5263 2.52522 11.3816 2.30924 C 11.1622 1.982038 10.87893 1.700779 10.54704 1.48361 C 10.08642 1.182205 9.55087 1.013622 9 1 C 8.44998 1.014473 7.91613 1.181355 7.45636 1.48361 C 7.12562 1.701042 6.84379 1.981922 6.62575 2.30818 C 6.4811 2.52463 6.21278 2.6359 5.95742 2.58524 C 5.57065 2.50851 5.17062 2.50951 4.78118 2.59046 C 4.24053 2.70115 3.74244 2.96169 3.34227 3.34142 C 2.96339 3.74159 2.70456 4.23968 2.59472 4.77863 C 2.51504 5.16661 2.51478 5.56517 2.59204 5.9505 C 2.64317 6.20557 2.53289 6.47402 2.31683 6.618879 C 1.98923 6.83852 1.707141 7.12164 1.488719 7.45296 C 1.185611 7.91273 1.016177 8.44913 1 9 C 1.017028 9.55087 1.185611 10.08642 1.488719 10.54704 C 1.70699 10.87813 1.988839 11.1615 2.31614 11.381 C 2.53242 11.5261 2.64304 11.7948 2.59191 12.0501 C 2.51478 12.4353 2.51509 12.8336 2.59472 13.2214 C 2.70541 13.7612 2.96339 14.2584 3.34142 14.6586 C 3.74159 15.0358 4.23882 15.2946 4.77778 15.4061 C 5.16676 15.4872 5.56638 15.4885 5.95297 15.4125 C 6.2069 15.3626 6.4733 15.473 6.61752 15.6879 C 6.8374 16.015499 7.12119 16.2973 7.45381 16.515499 C 7.91358 16.8169 8.44998 16.984699 9 17 C 9.55087 16.986401 10.08642 16.8186 10.54704 16.5172 C 10.87568 16.3022 11.1566 16.023899 11.3751 15.7008 C 11.5233 15.4816 11.7988 15.3721 12.0576 15.4274 C 12.4412 15.5093 12.8397 15.5111 13.2273 15.4308 C 13.7688 15.3184 14.2661 15.0502 14.6577 14.6586 C 15.0494 14.2669 15.3184 13.7697 15.4308 13.2273 C 15.5112 12.8397 15.5093 12.4411 15.427 12.0575 C 15.3716 11.7987 15.4806 11.5231 15.6997 11.3745 C 16.022301 11.1558 16.2999 10.87482 16.515499 10.54619 C 16.8169 10.08642 16.984699 9.55002 17 9 Z"
            />
            <path
                fill="#ffffff"
                fillRule="evenodd"
                stroke="none"
                d="M 5.48206 8.829732 C 5.546341 8.757008 6.096026 8.328334 6.590207 8.831891 C 6.990357 9.239633 7.80531 10.013605 7.80531 10.013605 C 7.80531 10.013605 10.326332 7.31631 11.011629 6.559397 C 11.320887 6.21782 11.875775 6.239667 12.135474 6.515033 C 12.411443 6.807649 12.489538 7.230008 12.164574 7.601331 C 10.947777 8.991708 9.508716 10.452277 8.3795 11.706156 C 8.11062 12.004721 7.595459 12.008714 7.302509 11.735093 C 7.061394 11.509888 6.005327 10.437536 5.502547 9.931531 C 5.003333 9.429114 5.404643 8.887831 5.48206 8.829732 Z"
            />
        </svg>
    );
}

/** Helper: format account age from ISO date string */
function formatAccountAge(isoDate: string): string {
    const registered = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - registered.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days}d`;
    if (days < 365) return `${Math.floor(days / 30)}mo`;
    const years = Math.floor(days / 365);
    const remainMonths = Math.floor((days % 365) / 30);
    return remainMonths > 0 ? `${years}y ${remainMonths}mo` : `${years}y`;
}

/** Neynar score color based on value */
function scoreColor(score: number): string {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.5) return 'text-yellow-600';
    return 'text-red-500';
}
function scoreBg(score: number): string {
    if (score >= 0.8) return 'bg-green-50 border-green-100';
    if (score >= 0.5) return 'bg-yellow-50 border-yellow-100';
    return 'bg-red-50 border-red-100';
}

/** Platform icon helper */
function PlatformIcon({ platform }: { platform: string }) {
    const p = platform.toLowerCase();
    if (p === 'x' || p === 'twitter') {
        return (
            <XLogo size={12} className="shrink-0" />
        );
    }
    return <FontAwesomeIcon icon={faExternalLink} className="text-[10px]" />;
}

type ProfileTab = "user" | "creator" | "admin";

interface TaskCompletionWithTask {
    _id: string;
    taskId: string;
    userFid: number;
    userAddress?: string;
    creatorFid: number;
    status: "pending" | "success" | "failed";
    claimStatus: "unclaimed" | "claimed" | "reclaimed";
    claimAmount?: number;
    claimNonce?: number;
    submittedAt: string;
    verifiedAt?: string;
    verifyTxHash?: string;
    task?: {
        type: string;
        description?: string;
        totalBudget: number;
        rewardToken: string;
        expiresAt: string;
        status: string;
        computedRewardPerUser?: number;
        targetUsername?: string;
        creatorFid: number;
        onChainTaskId?: string;
        castData?: { text: string; authorUsername: string; authorPfp: string; authorDisplayName: string };
        miniappData?: { name: string; icon?: string; developer?: string; url: string };
    } | null;
}

interface CreatorTask {
    _id: string;
    creatorFid: number;
    type: string;
    description?: string;
    totalBudget: number;
    rewardToken: string;
    expiresAt: string;
    createdAt: string;
    status: string;
    maxCompletions?: number;
    computedRewardPerUser?: number;
    remainingBudget?: number;
    onChainTaskId?: string;
    creatorAddress?: string;
    castData?: { text: string; authorUsername: string; authorPfp: string; authorDisplayName: string };
    miniappData?: { name: string; icon?: string; developer?: string; url: string };
    completedBy?: number[]; // Array of FIDs who joined (submitted) this quest
    stats: {
        totalCompletions: number;
        successCount: number;
        failedCount: number;
        pendingCount: number;
        claimedCount: number;
    };
    // Reclaim fields
    verifiedAt?: string | null;
    reclaimedAt?: string | null;
    unclaimedAmount?: number;
    reclaimEligibleAt?: string | null;
    canReclaim?: boolean;
}

// ─── Live countdown hook (same as TaskFeed) ─────────────────────────
function useCountdown(expiresAt: string | null | undefined, expiredLabel = 'Expired') {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiresAt) {
            setTimeLeft('—');
            return;
        }
        const target = new Date(expiresAt).getTime();
        const update = () => {
            const diff = target - Date.now();
            if (diff <= 0) {
                setTimeLeft(expiredLabel);
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / (1000 * 60)) % 60);
            const s = Math.floor((diff / 1000) % 60);
            if (d > 0) setTimeLeft(`${d}d ${h}h ${m}m`);
            else if (h > 0) setTimeLeft(`${h}h ${m}m ${s}s`);
            else setTimeLeft(`${m}m ${s}s`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [expiresAt, expiredLabel]);

    return timeLeft;
}

// ─── Reclaim countdown badge ─────────────────────────────────────────
function ReclaimCountdownBadge({ reclaimEligibleAt }: { reclaimEligibleAt: string }) {
    const countdown = useCountdown(reclaimEligibleAt, 'Ready');
    const isReady = countdown === 'Ready';
    return (
        <div className={`flex items-center gap-1.5 text-xs font-semibold tabular-nums px-3 py-1.5 rounded-lg ${isReady ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
            }`}>
            <FontAwesomeIcon icon={isReady ? faRotateLeft : faClock} className="text-[10px]" />
            {isReady ? 'Reclaim available' : `Reclaim in ${countdown}`}
        </div>
    );
}

// ─── Countdown badge (uses hook, for use in lists) ───────────────────
function CountdownBadge({ expiresAt, className = '' }: { expiresAt: string | null | undefined; className?: string }) {
    const countdown = useCountdown(expiresAt);
    return (
        <span className={`flex items-center gap-1 tabular-nums ${className}`}>
            <FontAwesomeIcon icon={faClock} className="text-[10px] opacity-70" />
            {countdown}
        </span>
    );
}

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { cls: string; icon: any; label: string }> = {
        pending: { cls: 'badge-warning', icon: faClock, label: 'Pending' },
        success: { cls: 'badge-success', icon: faCheckCircle, label: 'Verified' },
        failed: { cls: 'badge-danger', icon: faTimesCircle, label: 'Failed' },
        pending_deposit: { cls: 'badge-warning', icon: faClock, label: 'Awaiting Deposit' },
        active: { cls: 'badge-info', icon: faChartLine, label: 'Active' },
        expired: { cls: 'badge-outline', icon: faClock, label: 'Expired' },
        verified: { cls: 'badge-success', icon: faCheckCircle, label: 'Verified' },
        completed: { cls: 'badge-dark', icon: faCheckCircle, label: 'Completed' },
    };
    const cfg = map[status] || { cls: 'badge-outline', icon: faClock, label: status };
    return (
        <span className={`badge ${cfg.cls}`}>
            <FontAwesomeIcon icon={cfg.icon} />
            {cfg.label}
        </span>
    );

}

// ─── Preview Components ────────────────────────────────────────────
function CastPreview({ castData }: { castData: { text: string; authorUsername: string; authorPfp: string; authorDisplayName: string } }) {
    if (!castData) return null;
    return (
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 space-y-1.5 mt-2">
            <div className="flex items-center gap-2">
                {castData.authorPfp ? (
                    <img src={castData.authorPfp} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                    <div className="w-4 h-4 rounded-full bg-gray-200" />
                )}
                <span className="text-[10px] font-bold text-black truncate">{castData.authorDisplayName}</span>
                <span className="text-[10px] text-gray-400 truncate">@{castData.authorUsername}</span>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2 leading-snug">{castData.text}</p>
        </div>
    );
}

function MiniAppPreview({ miniappData }: { miniappData: { name: string; icon?: string; developer?: string; url: string } }) {
    if (!miniappData) return null;
    return (
        <div className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 flex items-center gap-2 mt-2">
            {miniappData.icon ? (
                <img src={miniappData.icon} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-200 shrink-0" />
            ) : (
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faBolt} className="text-gray-400 text-xs" />
                </div>
            )}
            <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-black truncate">{miniappData.name}</div>
                {miniappData.developer && (
                    <div className="text-[10px] text-gray-400 truncate">by {miniappData.developer}</div>
                )}
            </div>
            <FontAwesomeIcon icon={faExternalLink} className="text-gray-300 text-[10px] shrink-0" />
        </div>
    );
}

// ─── Type Label Helper ─────────────────────────────────────────────
function getTypeLabel(type: string): string {
    const map: Record<string, string> = {
        follow: 'Grow',
        boost: 'Amplify',
        quote: 'Engage',
        channel: 'Community',
        multi: 'Bundle',
        miniapp: 'App',
    };
    return map[type] || type;
}

export default function Profile() {
    const { context, actions } = useFrame();
    const identity = useUserIdentity();
    const user = context?.user;
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const wagmiConfig = useConfig();
    const publicClient = usePublicClient({ chainId: arbitrum.id });
    const { price: gDollarPrice } = useGDollarPrice();
    const [tab, setTab] = useState<ProfileTab>("user");
    const [completions, setCompletions] = useState<TaskCompletionWithTask[]>([]);
    const [creatorTasks, setCreatorTasks] = useState<CreatorTask[]>([]);
    const [adminTasks, setAdminTasks] = useState<CreatorTask[]>([]);
    /** Admin “All tasks”: API filter — only tasks with 0 verified and 0 claims (0/0 on Claims row) */
    const [adminOnlyZeroClaims, setAdminOnlyZeroClaims] = useState(false);
    const [loading, setLoading] = useState(true);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [claimError, setClaimError] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);
    /** Completions that are already claimed on-chain (isNonceUsed) but DB may not be synced yet */
    const [claimedOnChain, setClaimedOnChain] = useState<Record<string, boolean>>({});
    /** Share-after-claim: show share popup only after user successfully claims */
    const [showShareAfterClaimModal, setShowShareAfterClaimModal] = useState(false);
    const [shareAfterClaimCompletion, setShareAfterClaimCompletion] = useState<TaskCompletionWithTask | null>(null);
    const [isSharingAfterClaim, setIsSharingAfterClaim] = useState(false);
    /** Share-to-unlock: show popup first with Share + Claim; Claim disabled until user shares */
    const [showShareToUnlockModal, setShowShareToUnlockModal] = useState(false);
    const [shareToUnlockCompletion, setShareToUnlockCompletion] = useState<TaskCompletionWithTask | null>(null);
    const [hasSharedToUnlock, setHasSharedToUnlock] = useState(false);
    const [isSharingToUnlock, setIsSharingToUnlock] = useState(false);
    /** Reclaim state */
    const [reclaimingId, setReclaimingId] = useState<string | null>(null);
    const [showAutoBoostModal, setShowAutoBoostModal] = useState(false);
    const [portalReady, setPortalReady] = useState(false);
    const [reclaimError, setReclaimError] = useState<string | null>(null);
    const [autoBoostSignerMe, setAutoBoostSignerMe] = useState<any>(null);
    const [isOptingIn, setIsOptingIn] = useState(false);

    // Fetch auto-boost signer state
    useEffect(() => {
        let cancelled = false;
        const fetchSigner = async () => {
            try {
                const res = await sdk.quickAuth.fetch(`/api/farcaster/signer/me`);
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled) setAutoBoostSignerMe(data);
                }
            } catch (e) {
                console.warn('Failed to fetch signer status:', e);
            }
        };
        fetchSigner();
    }, []);

    const handleOptInToggle = async (autoBoostOptIn: boolean) => {
        if (isOptingIn) return;
        setIsOptingIn(true);
        try {
            const res = await sdk.quickAuth.fetch(`/api/farcaster/signer/opt-in`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ autoBoostOptIn }),
            });
            if (res.ok) {
                setAutoBoostSignerMe((prev: any) => prev ? { ...prev, autoBoostOptIn } : prev);
            }
        } catch (e) {
            console.error('Failed to update opt-in:', e);
        } finally {
            setIsOptingIn(false);
        }
    };

    useEffect(() => {
        setPortalReady(true);
    }, []);

    const [joinedByPopupData, setJoinedByPopupData] = useState<{
        completions: Array<{
            userFid: number;
            userUsername: string | null;
            userDisplayName: string | null;
            userPfpUrl: string | null;
            status: 'pending' | 'success' | 'failed';
            claimStatus: 'unclaimed' | 'claimed' | 'reclaimed';
            claimAmount?: number;
            isPro: boolean;
        }>;
        perUser: number;
        token: string;
    } | null>(null);
    const [joinedByPopupLoadingTaskId, setJoinedByPopupLoadingTaskId] = useState<string | null>(null);

    /** Neynar extended profile data */
    const [neynarProfile, setNeynarProfile] = useState<NeynarUser | null>(null);
    const [profileLoading, setProfileLoading] = useState(false);
    /** Farcaster publicSpamLabel (same signal as non-spam-only quests) */
    const [spamLabel, setSpamLabel] = useState<{
        numeric: number | null;
        tier: "non_spam" | "spam" | "unknown";
    } | null>(null);
    const [spamLabelLoading, setSpamLabelLoading] = useState(true);

    // Fetch full Neynar profile on mount
    useEffect(() => {
        if (!user?.fid) return;
        let cancelled = false;
        const fetchProfile = async () => {
            setProfileLoading(true);
            try {
                const res = await axios.get(`/api/neynar/users/bulk?fids=${user.fid}`);
                const users = res.data?.users;
                if (!cancelled && users?.[0]) {
                    setNeynarProfile(users[0]);
                }
            } catch (e) {
                console.error('Failed to fetch Neynar profile:', e);
            } finally {
                if (!cancelled) setProfileLoading(false);
            }
        };
        fetchProfile();
        return () => { cancelled = true; };
    }, [user?.fid]);

    useEffect(() => {
        if (!user?.fid) {
            setSpamLabel(null);
            setSpamLabelLoading(false);
            return;
        }
        let cancelled = false;
        setSpamLabelLoading(true);
        const fetchSpamLabel = async () => {
            try {
                const res = await axios.get(`/api/profile/public-spam-label?fid=${user.fid}`);
                if (!cancelled) {
                    setSpamLabel({
                        numeric: res.data?.numeric ?? null,
                        tier: res.data?.tier ?? "unknown",
                    });
                }
            } catch {
                if (!cancelled) {
                    setSpamLabel({ numeric: null, tier: "unknown" });
                }
            } finally {
                if (!cancelled) setSpamLabelLoading(false);
            }
        };
        fetchSpamLabel();
        return () => {
            cancelled = true;
        };
    }, [user?.fid]);

    useEffect(() => {
        if (identity.fid || identity.walletAddress || user?.fid) loadData();
    }, [user?.fid, identity.fid, identity.walletAddress, tab, adminOnlyZeroClaims]);

    // Check contract hasClaimedTask(claimer, taskId) so we hide the claim button if already claimed
    useEffect(() => {
        if (tab !== "user" || !address || !publicClient || completions.length === 0) return;
        const check = async () => {
            const next: Record<string, boolean> = {};
            for (const c of completions) {
                if (c.status !== "success" || c.claimStatus === "claimed") continue;
                const onChainTaskId = c.task?.onChainTaskId;
                if (!onChainTaskId) continue;
                const isCustom = c.task?.type === 'custom_onchain';
                const chainUi = getTaskChainUi(c.task ?? {});
                if (!chainUi.escrowAddress) continue;
                try {
                    const chainClient = getViemPublicClient(chainUi.chainId);
                    const claimed = await chainClient.readContract({
                        address: chainUi.escrowAddress,
                        abi: chainUi.escrowAbi,
                        functionName: "hasClaimedTask",
                        args: [address as `0x${string}`, onChainTaskId as `0x${string}`],
                    });
                    if (claimed) {
                        next[c._id] = true;
                        try {
                            const claimCompleteUrl = isCustom
                                ? '/api/custom-actions/claim-complete'
                                : '/api/tasks/claim-complete';
                            await axios.post(claimCompleteUrl, {
                                taskId: c.taskId,
                                userFid: c.userFid,
                                userAddress: address,
                            });
                        } catch {
                            // DB sync best-effort
                        }
                    }
                } catch {
                    // ignore read errors
                }
            }
            if (Object.keys(next).length > 0) setClaimedOnChain((prev) => ({ ...prev, ...next }));
        };
        check();
    }, [tab, address, publicClient, completions]);

    const loadData = async () => {
        const fid = identity.fid ?? user?.fid;
        const wallet = identity.walletAddress;
        if (!fid && !wallet) return;
        setLoading(true);
        try {
            if (tab === "user") {
                const q = fid ? `userFid=${fid}` : `userWallet=${wallet}`;
                const res = await axios.get(`/api/tasks/user-completions?${q}`);
                setCompletions(res.data.completions || []);
            } else if (tab === "creator") {
                const q = fid
                    ? `creatorFid=${fid}`
                    : `creatorAddress=${wallet}`;
                const res = await axios.get(`/api/tasks/creator-tasks?${q}`);
                setCreatorTasks(res.data.tasks || []);
            } else if (tab === "admin" && fid === 249702) {
                const q = adminOnlyZeroClaims ? "&onlyZeroClaims=1" : "";
                const res = await axios.get(`/api/tasks/admin-tasks?adminFid=${fid}${q}`);
                setAdminTasks(res.data.tasks || []);
            }
        } catch (e) {
            console.error("Error loading profile data:", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchJoinedUsersForTask = async (task: CreatorTask) => {
        const taskIdStr = (task as any)?._id?.toString?.() ?? (task as any)?._id;
        if (!taskIdStr) return;
        if (joinedByPopupLoadingTaskId === taskIdStr) return;

        setJoinedByPopupLoadingTaskId(taskIdStr);
        try {
            const res = await axios.get(`/api/tasks/joined-users?taskId=${encodeURIComponent(taskIdStr)}`);
            const completions = res.data?.completions ?? [];
            const perUser = typeof res.data?.perUser === 'number' ? res.data.perUser : (task.computedRewardPerUser ?? 0);
            const token = res.data?.token ?? task.rewardToken ?? 'USDC';
            setJoinedByPopupData({ completions, perUser, token });
        } catch (e) {
            console.error('Failed to load joined users:', e);
        } finally {
            setJoinedByPopupLoadingTaskId(null);
        }
    };

    /** Run the claim tx; on success we show the share-after-claim modal. */
    const doActualClaim = async (completion: TaskCompletionWithTask) => {
        if (!user?.fid || !address || !walletClient) return;

        setClaimingId(completion.taskId);
        setClaimError(null);
        const isCustom = completion.task?.type === 'custom_onchain';
        try {
            const generateClaimUrl = isCustom
                ? '/api/custom-actions/generate-claim'
                : '/api/tasks/generate-claim';
            const res = await axios.post(generateClaimUrl, {
                taskId: completion.taskId,
                userFid: user.fid,
                ...(isCustom ? {} : { userAddress: address }),
            });

            const { signature, amount, nonce, onChainTaskId, creatorAddress } = res.data;

            const chainUi = getTaskChainUi(completion.task ?? {});
            if (!chainUi.escrowAddress) {
                throw new Error('Escrow contract is not configured for this chain');
            }

            try {
                await switchChain(wagmiConfig, { chainId: chainUi.chainId });
            } catch (switchErr) {
                console.warn('[Profile] chain switch before claim', switchErr);
            }

            const activeChain = chainUi.chainId === CELO_CHAIN_ID ? celo : arbitrum;

            const { id } = await walletClient.sendCalls({
                account: address as `0x${string}`,
                calls: [{
                    to: chainUi.escrowAddress,
                    data: encodeFunctionData({
                        abi: chainUi.escrowAbi,
                        functionName: 'claim',
                        args: [
                            chainUi.tokenAddress,
                            onChainTaskId as `0x${string}`,
                            creatorAddress as `0x${string}`,
                            BigInt(amount),
                            BigInt(nonce),
                            signature as `0x${string}`,
                        ],
                    }),
                }],
            });

            const receipt = await walletClient.waitForCallsStatus({ id });

            if (receipt.status === 'success') {
                // sendCalls often returns tx hash in receipts[] (not always root transactionHash)
                const txHash =
                    (receipt as any)?.transactionHash ??
                    (Array.isArray((receipt as any)?.receipts) && (receipt as any).receipts.length > 0
                        ? (receipt as any).receipts[(receipt as any).receipts.length - 1]?.transactionHash
                        : undefined);
                try {
                    const claimCompleteUrl = isCustom
                        ? '/api/custom-actions/claim-complete'
                        : '/api/tasks/claim-complete';
                    await axios.post(claimCompleteUrl, {
                        taskId: completion.taskId,
                        userFid: user.fid,
                        userAddress: address,
                        claimTxHash: txHash,
                        ...(isCustom ? {} : {
                            userUsername: user.username,
                            userDisplayName: (user as any)?.display_name || (user as any)?.displayName,
                            userPfpUrl: (user as any)?.pfp_url || (user as any)?.pfpUrl,
                        }),
                    });
                } catch (e) {
                    console.warn("Failed to mark claim in DB:", e);
                }
                setClaimedOnChain((prev) => ({ ...prev, [completion._id]: true }));
                loadData();
                setShowShareToUnlockModal(false);
                setShareToUnlockCompletion(null);
                setHasSharedToUnlock(false);
                setShareAfterClaimCompletion(completion);
                setShowShareAfterClaimModal(true);
            } else {
                throw new Error('Claim transaction failed');
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || "Failed to claim";
            setClaimError(msg);
        } finally {
            setClaimingId(null);
        }
    };

    const handleClaim = (completion: TaskCompletionWithTask) => {
        if (!user?.fid || !address || !walletClient) {
            setClaimError("Please connect your wallet first.");
            return;
        }
        setClaimError(null);
        const reward = completion.task?.computedRewardPerUser ?? 0;
        const useShareToUnlock = REQUIRE_SHARE_TO_UNLOCK_CLAIM && reward > SHARE_TO_UNLOCK_CLAIM_MIN_USDC;
        if (useShareToUnlock) {
            setShareToUnlockCompletion(completion);
            setHasSharedToUnlock(false);
            setShowShareToUnlockModal(true);
        } else {
            doActualClaim(completion);
        }
    };

    // ─── Share handler (reusable for both tabs) ──────────────
    const handleShareFromProfile = async (taskData: any, taskId: string, isCreatorView = false) => {
        if (!actions?.composeCast) return;
        setSharingId(taskId);
        try {
            const reward = taskData.totalBudget ?? taskData.computedRewardPerUser ?? 0;
            const tokenLabel = getRewardTokenLabel(taskData);

            // Get the actual creator profile
            let creatorUsername = user?.username || 'user';
            let creatorPfpUrl = (user as any)?.pfpUrl || (user as any)?.pfp_url || '';
            let creatorDisplayName = (user as any)?.displayName || (user as any)?.display_name || user?.username || 'Creator';

            // If sharing from Earnings tab, fetch the real task creator's profile
            if (!isCreatorView && taskData.creatorFid) {
                try {
                    const profileRes = await axios.get(`/api/neynar/users/bulk?fids=${taskData.creatorFid}`);
                    const creatorProfile = profileRes.data?.users?.[0];
                    if (creatorProfile) {
                        creatorUsername = creatorProfile.username || creatorUsername;
                        creatorPfpUrl = creatorProfile.pfp_url || creatorPfpUrl;
                        creatorDisplayName = creatorProfile.display_name || creatorProfile.username || creatorDisplayName;
                    }
                } catch (e) {
                    console.warn('Failed to fetch creator profile:', e);
                }
            }

            // Also fetch target profile if needed
            let targetDisplayName = taskData.targetUsername;
            let targetPfpUrl = '';
            if (taskData.targetFid) {
                try {
                    const tRes = await axios.get(`/api/neynar/users/bulk?fids=${taskData.targetFid}`);
                    const tProfile = tRes.data?.users?.[0];
                    if (tProfile) {
                        targetDisplayName = tProfile.display_name || tProfile.username || taskData.targetUsername;
                        targetPfpUrl = tProfile.pfp_url || '';
                    }
                } catch (e) { /* ignore */ }
            }

            const imageData: TaskShareImageData = {
                taskType: taskData.type || 'follow',
                taskDescription: taskData.description || `${getTypeLabel(taskData.type)} quest`,
                rewardAmount: reward,
                creatorUsername,
                creatorPfpUrl,
                creatorDisplayName,
                targetUsername: taskData.targetUsername,
                targetDisplayName,
                targetPfpUrl,
                castText: taskData.castData?.text,
                castAuthorUsername: taskData.castData?.authorUsername,
                castAuthorDisplayName: taskData.castData?.authorDisplayName,
                castAuthorPfpUrl: taskData.castData?.authorPfp,
                miniappName: taskData.miniappData?.name,
                miniappIcon: taskData.miniappData?.icon,
                miniappDeveloper: taskData.miniappData?.developer,
                completedCount: taskData.stats?.successCount ?? taskData.completedBy?.length,
                maxCompletions: taskData.maxCompletions,
                expiresAt: taskData.expiresAt || null,
            };

            const imageBlob = await captureTaskShareImage(imageData);
            const formData = new FormData();
            formData.append('file', imageBlob, `taskpay-quest-${Date.now()}.png`);
            const uploadRes = await fetch('/api/ipfs/upload-image', { method: 'POST', body: formData });
            const uploadResult = await uploadRes.json();
            if (!uploadResult.success || !uploadResult.ipfsUrl) throw new Error('IPFS upload failed');

            const SHARE_TEXTS = [
                `This quest pays ${reward} ${tokenLabel} on @taskpay 🔥\n\nDo the task, get paid. Your turn 👇`,
                `${reward} ${tokenLabel} up for grabs — @taskpay is paying for engagement 💰\n\nDon't sleep on it 👇`,
                `Found a paid quest on @taskpay: ${reward} ${tokenLabel} reward 🚀 \n\nComplete it & claim. 👇`,
                `@taskpay is paying ${reward} ${tokenLabel} for this quest 💎 Real rewards, real simple. Try it 👇`,
            ];
            const castText = SHARE_TEXTS[Math.floor(Math.random() * SHARE_TEXTS.length)];
            const params = new URLSearchParams({ imageUrl: uploadResult.ipfsUrl });
            const shareUrl = `${window.location.origin}?${params.toString()}`;
            const res = await actions.composeCast({ text: castText, embeds: [shareUrl] });
            if (!res) {
                return false;
            }
            return true
        } catch (err) {
            console.error('Share quest error:', err);
        } finally {
            setSharingId(null);
        }
    };

    /** Share reward-claim card (same flow as "Share after claim success"). Used in share-to-unlock and share-after-claim modals. */
    const handleShareRewardClaim = async (completion: TaskCompletionWithTask) => {
        if (!actions?.composeCast || !user) return;
        const claimAmount = completion.task?.computedRewardPerUser ?? 0;
        const totalEarnedNow = userStats.totalEarned + claimAmount;
        const userDisplayName = (user as any)?.display_name ?? (user as any)?.displayName ?? user?.username ?? "User";
        const userUsername = user?.username ?? "user";
        const userPfpUrl = (user as any)?.pfp_url ?? (user as any)?.pfpUrl ?? "";

        const imageData: RewardClaimShareImageData = {
            userDisplayName,
            userUsername,
            userPfpUrl,
            completedCount: userStats.total,
            totalEarned: totalEarnedNow,
            inProgressCount: userStats.pending,
            justClaimedAmount: claimAmount,
            questDescription: completion.task?.description,
            taskType: completion.task?.type,
            targetUsername: completion.task?.targetUsername,
            castText: completion.task?.castData?.text,
            castAuthorUsername: completion.task?.castData?.authorUsername,
            castAuthorDisplayName: completion.task?.castData?.authorDisplayName,
            castAuthorPfpUrl: completion.task?.castData?.authorPfp,
            miniappName: completion.task?.miniappData?.name,
            miniappIcon: completion.task?.miniappData?.icon,
            miniappDeveloper: completion.task?.miniappData?.developer,
        };

        const imageBlob = await captureRewardClaimShareImage(imageData);
        const formData = new FormData();
        formData.append("file", imageBlob, `taskpay-claim-${Date.now()}.png`);
        const uploadRes = await fetch("/api/ipfs/upload-image", { method: "POST", body: formData });
        const uploadResult = await uploadRes.json();
        if (!uploadResult.success || !uploadResult.ipfsUrl) throw new Error("IPFS upload failed");

        const params = new URLSearchParams({ imageUrl: uploadResult.ipfsUrl });
        const shareUrl = `${window.location.origin}?${params.toString()}`;

        const claimToken = getRewardTokenLabel(completion.task ?? {});
        const claimFormatted = claimToken === 'G$' ? Math.round(claimAmount).toLocaleString() : claimAmount.toFixed(4);
        const REWARD_CLAIM_CAST_TEXTS = totalEarnedNow > 0
            ? [
                `Just claimed ${claimFormatted} ${claimToken} on @taskpay 💰\n\nTotal earned so far.\nQuest done — your turn 👇`,
                `Another one ✅\n\n${claimFormatted} ${claimToken} in the bag.\nEarned on @taskpay.\nCome get yours 🔥`,
                `Paid to engage.\n+${claimFormatted} ${claimToken} just now.\n\nAll-time on @taskpay👇`,
                `Quest complete. ${claimToken} claimed.\n\nKeep earning on @taskpay.\nStart earning 👇`,
            ]
            : [
                `Just claimed ${claimFormatted} ${claimToken} on @taskpay 🔥\n\nComplete quests, get paid. Your turn 👇`,
                `Bagged ${claimFormatted} ${claimToken} on @taskpay 💎\n\nReal rewards for real engagement. Try it 👇`,
                `Claimed. Paid. Done.\n${claimFormatted} ${claimToken} via @taskpay.\nStop scrolling, start earning 👇`,
            ];

        const castText = REWARD_CLAIM_CAST_TEXTS[Math.floor(Math.random() * REWARD_CLAIM_CAST_TEXTS.length)];
        const res = await actions.composeCast({ text: castText, embeds: [shareUrl] });
        console.log(res)
        if (res.cast == null) {
            return false;
        }
        return true;
    };

    /** Reclaim unclaimed tokens for a creator task */
    const handleReclaim = async (task: CreatorTask) => {
        if (!user?.fid || !address || !walletClient) {
            setReclaimError('Please connect your wallet first.');
            return;
        }
        setReclaimingId(task._id);
        setReclaimError(null);
        try {
            const res = await axios.post('/api/tasks/generate-reclaim', {
                taskId: task._id,
                creatorFid: user.fid,
                creatorAddress: address,
            });

            const { signature, amount, nonce, onChainTaskId, creatorAddress: taskCreatorAddr } = res.data;

            const chainUi = getTaskChainUi(task);
            if (!chainUi.escrowAddress) {
                throw new Error('Escrow contract is not configured for this chain');
            }

            try {
                await switchChain(wagmiConfig, { chainId: chainUi.chainId });
            } catch (switchErr) {
                console.warn('[Profile] chain switch before reclaim', switchErr);
            }

            const { id } = await walletClient.sendCalls({
                account: address as `0x${string}`,
                calls: [{
                    to: chainUi.escrowAddress,
                    data: encodeFunctionData({
                        abi: chainUi.escrowAbi,
                        functionName: 'claim',
                        args: [
                            chainUi.tokenAddress,
                            onChainTaskId as `0x${string}`,
                            taskCreatorAddr as `0x${string}`,
                            BigInt(amount),
                            BigInt(nonce),
                            signature as `0x${string}`,
                        ],
                    }),
                }],
            });

            const receipt = await walletClient.waitForCallsStatus({ id });

            if (receipt.status === 'success') {
                const txHash = (receipt as any)?.transactionHash;
                try {
                    await axios.post('/api/tasks/reclaim-complete', {
                        taskId: task._id,
                        creatorFid: user.fid,
                        reclaimTxHash: txHash,
                    });
                } catch (e) {
                    console.warn('Failed to mark reclaim in DB:', e);
                }
                loadData();
            } else {
                throw new Error('Reclaim transaction failed');
            }
        } catch (e: any) {
            const msg = e?.response?.data?.error || e?.message || 'Failed to reclaim';
            setReclaimError(msg);
        } finally {
            setReclaimingId(null);
        }
    };

    // ─── Stats ─────────────────────────────────────────────────
    const userStats = {
        total: completions.length,
        pending: completions.filter((c) => c.status === "pending").length,
        success: completions.filter((c) => c.status === "success").length,
        totalEarned: completions
            .filter((c) => c.claimStatus === "claimed")
            .reduce((sum, c) => sum + (c.claimAmount || 0), 0),
    };

    const creatorStats = {
        totalTasks: creatorTasks.length,
        totalBudget: creatorTasks.reduce((sum, t) => sum + t.totalBudget, 0),
        totalCompletions: creatorTasks.reduce((sum, t) => sum + t.stats.totalCompletions, 0),
        totalSuccess: creatorTasks.reduce((sum, t) => sum + t.stats.successCount, 0),
    };

    const neynarScore = neynarProfile?.experimental?.neynar_user_score ?? neynarProfile?.score ?? null;
    const isPro = neynarProfile?.pro?.status === 'subscribed' || neynarProfile?.pro?.status === 'active';
    const bio = neynarProfile?.profile?.bio?.text || '';
    const verifiedAccounts = neynarProfile?.verified_accounts || [];
    const registeredAt = neynarProfile?.registered_at;

    return (
        <div className="min-h-screen text-black pb-32 w-full max-w-full">
            {/* Header */}
            <div className="p-5 pt-6 space-y-4">
                {/* Profile Avatar + Name Row (spam label compact, top-right) */}
                <div className="flex items-start gap-3">
                    {/* Avatar with Pro Badge */}
                    <div className="relative shrink-0">
                        {(user as any)?.pfpUrl || (user as any)?.pfp_url ? (
                            <img
                                src={(user as any).pfpUrl || (user as any).pfp_url}
                                alt=""
                                className="w-16 h-16 rounded-full ring-2 ring-gray-100 shadow-md object-cover"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
                                <FontAwesomeIcon icon={faUser} className="text-xl text-gray-300" />
                            </div>
                        )}
                        {/* Pro badge at bottom-right of avatar */}
                        {isPro && (
                            <div className="absolute -bottom-1 -right-1 z-10" title="Farcaster Pro">
                                <ProBadge size={24} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0 flex items-start justify-between gap-2 pt-0.5">
                        {/* Name + username */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <h1 className="text-lg font-bold truncate">
                                    {neynarProfile?.display_name || (user as any)?.displayName || (user as any)?.display_name || user?.username || "Anonymous"}
                                </h1>
                                {isPro && (
                                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md uppercase tracking-wide shrink-0">PRO</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 truncate">@{neynarProfile?.username || user?.username || "user"} · FID {user?.fid}</p>
                            {address && (
                                <p className="text-xs text-gray-300 font-mono mt-0.5 truncate">
                                    {address.slice(0, 6)}…{address.slice(-4)}
                                </p>
                            )}
                        </div>

                        {/* Farcaster spam label — compact, right column */}
                        <div className="shrink-0 max-w-[48%] min-w-0 sm:max-w-[11.5rem]">
                            {spamLabelLoading ? (
                                <div className="w-[6.5rem] h-[2.85rem] rounded-lg bg-gray-100/90 border border-gray-100 animate-pulse" />
                            ) : (
                                spamLabel && (
                                    <div
                                        title={
                                            spamLabel.numeric === null
                                                ? "Farcaster did not return a label."
                                                : spamLabel.numeric === 0
                                                  ? "Spam label 0 — likely to engage in spammy behavior."
                                                  : "Spam label 2+ — unlikely to engage in spammy behavior."
                                        }
                                        className={`rounded-lg border px-2 py-1.5 text-left ${
                                            spamLabel.tier === "non_spam"
                                                ? "bg-emerald-50/90 border-emerald-100"
                                                : spamLabel.tier === "spam"
                                                  ? "bg-rose-50/90 border-rose-100"
                                                  : "bg-gray-50 border-gray-100"
                                        }`}
                                    >
                                        <div className="flex items-start gap-1.5">
                                           
                                            <div className="min-w-0">
                                                <div className="text-[9px] font-bold text-gray-700 leading-tight">
                                                    Spam label
                                                </div>
                                                <p
                                                    className={`text-[9px] leading-snug mt-0.5 ${
                                                        spamLabel.numeric === null
                                                            ? "text-gray-500"
                                                            : spamLabel.numeric === 0
                                                              ? "text-rose-800/95"
                                                              : "text-emerald-800/95"
                                                    }`}
                                                >
                                                    {spamLabel.numeric === null ? (
                                                        <>Unavailable</>
                                                    ) : (
                                                        <>
                                                            <span className="font-mono font-bold tabular-nums">
                                                                {spamLabel.numeric}
                                                            </span>
                                                            {spamLabel.numeric === 0
                                                                ? " (likely to engage in spammy behavior)"
                                                                : " (unlikely to engage in spammy behavior)"}
                                                        </>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>


                {/* Follower / Following / Neynar Score / Age Row */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 text-sm">
                        <span className="font-bold text-black">{neynarProfile?.follower_count?.toLocaleString() ?? '—'}</span>
                        <span className="text-gray-400">Followers</span>
                    </div>
                    <span className="text-gray-200">·</span>
                    <div className="flex items-center gap-1 text-sm">
                        <span className="font-bold text-black">{neynarProfile?.following_count?.toLocaleString() ?? '—'}</span>
                        <span className="text-gray-400">Following</span>
                    </div>

                    {neynarScore !== null && neynarScore !== undefined && (
                        <>
                            <span className="text-gray-200">·</span>
                            <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border ${scoreBg(neynarScore)}`}>
                                <span className={scoreColor(neynarScore)}>{(neynarScore)}</span>
                                <span className="text-gray-400 font-normal">Neynar</span>
                            </div>
                        </>
                    )}

                    {registeredAt && (
                        <>
                            <span className="text-gray-200">·</span>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                <FontAwesomeIcon icon={faCalendarAlt} className="text-[10px]" />
                                <span>{formatAccountAge(registeredAt)}</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Verified Accounts */}
                {verifiedAccounts.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {verifiedAccounts.map((va, i) => (
                            <div
                                key={`${va.platform}-${i}`}
                                className="inline-flex items-center gap-1.5 text-xs font-medium bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 text-gray-600"
                            >
                                <PlatformIcon platform={va.platform} />
                                <span className="truncate max-w-[120px]">{va.username}</span>
                                <FontAwesomeIcon icon={faCheckCircle} className="text-[10px] text-blue-500" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Auto-Boost Section */}

                <div className="w-full relative">
                    {autoBoostSignerMe &&
                        autoBoostSignerMe.signerStatus === 'approved' &&
                        autoBoostSignerMe.ed25519PublicKeyHex &&
                        !autoBoostSignerMe.needsReconnect ? (
                        <div className="w-full flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-white border border-gray-100 shadow-sm transition-all text-left">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-cyan-50 flex flex-col items-center justify-center shrink-0 border border-cyan-100">
                                    <FontAwesomeIcon icon={faBolt} className="text-cyan-600 text-lg" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-gray-900 tracking-tight">Auto-Quest ⚡</p>
                                    <p className="text-[11px] text-gray-500 truncate leading-relaxed">
                                        Auto complete Boost quests
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center shrink-0">
                                <button
                                    type="button"
                                    disabled={isOptingIn}
                                    onClick={() => handleOptInToggle(!autoBoostSignerMe.autoBoostOptIn)}
                                    className={`relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 ${autoBoostSignerMe.autoBoostOptIn ? 'bg-cyan-500' : 'bg-gray-200'} ${isOptingIn ? 'opacity-50' : ''}`}
                                >
                                    <span className={`pointer-events-none inline-block h-[20px] w-[20px] transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoBoostSignerMe.autoBoostOptIn ? 'translate-x-[20px]' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowAutoBoostModal(true)}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md hover:shadow-lg transition-all active:scale-[0.99] group text-left relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="flex items-center gap-3 min-w-0 relative z-10">
                                <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                                    <FontAwesomeIcon icon={faBolt} className="text-cyan-400 text-lg group-hover:scale-110 transition-transform" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-white tracking-tight">Enable Auto-Quest ⚡</p>
                                    <p className="text-[11px] text-slate-400 truncate">
                                        Let Taskpay tap & verify for you
                                    </p>
                                </div>
                            </div>
                            <div className="relative z-10 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors border border-slate-700">
                                <FontAwesomeIcon icon={faChevronRight} className="text-slate-300 text-[11px] shrink-0" />
                            </div>
                        </button>
                    )}
                </div>


                {/* Tab Switcher */}
                <div className="flex bg-gray-100/60 rounded-[14px] p-1 gap-1 shadow-inner backdrop-blur-md relative border border-gray-200/50">
                    {[
                        { id: "user", label: "Earnings", icon: faTasks },
                        { id: "creator", label: "My Quests", icon: faPaintBrush },
                        ...(user?.fid === 249702 ? [{ id: "admin", label: "All Tasks", icon: faCoins }] : [])
                    ].map((t) => {
                        const isSelected = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                onClick={() => setTab(t.id as ProfileTab)}
                                className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors z-10 focus:outline-none flex items-center justify-center gap-2 ${isSelected ? "text-black" : "text-gray-500 hover:text-gray-800"}`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="profileTab"
                                        className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/5 z-[-1]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                                <FontAwesomeIcon icon={t.icon} className={isSelected ? 'text-black' : 'opacity-70'} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="px-4">
                {tab === "user" ? (
                    <div className="space-y-4 animate-fade-in">
                        {/* User Stats */}
                        <div className="grid grid-cols-3 gap-3 stagger-children">
                            <StatCard label="Completed" value={userStats.total} />
                            <StatCard label="Earned" value={`$${userStats.totalEarned.toFixed(2)}`} color="text-green-600" />
                            <StatCard label="In Progress" value={userStats.pending} color="text-orange-500" />
                        </div>

                        {/* 3-day claim warning */}
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <FontAwesomeIcon icon={faClock} className="text-amber-500 text-xs mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-700 leading-relaxed">
                                <span className="font-bold">Claim within 3 days</span> after verification — creators can reclaim unclaimed rewards after that.
                            </p>
                        </div>

                        {/* Task List */}
                        {loading ? (
                            <LoadingState />
                        ) : completions.length === 0 ? (
                            <EmptyState icon={faTasks} primary="No earnings yet" secondary="Start completing quests to earn G$ & USDC" />
                        ) : (
                            <div className="space-y-3 stagger-children">
                                {completions.map((c) => (
                                    <div key={c._id} className="card p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                                                    {getTypeLabel(c.task?.type || 'unknown')}
                                                </span>
                                                {c.task?.targetUsername && (
                                                    <span className="text-xs text-gray-300">· @{c.task.targetUsername}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => c.task && handleShareFromProfile(c.task, c._id)}
                                                    disabled={sharingId === c._id}
                                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${sharingId === c._id
                                                        ? 'bg-gray-100 text-gray-300 cursor-wait'
                                                        : 'bg-gray-50 border border-gray-100 text-gray-400 hover:text-black hover:bg-gray-100 active:scale-90'
                                                        }`}
                                                    title="Share this quest"
                                                >
                                                    <FontAwesomeIcon icon={sharingId === c._id ? faSpinner : faShareNodes} className={`text-[10px] ${sharingId === c._id ? 'animate-spin' : ''}`} />
                                                </button>
                                                {c.verifyTxHash === 'auto-boost' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-100">
                                                        <FontAwesomeIcon icon={faBolt} className="text-[8px]" />
                                                        Server completed
                                                    </span>
                                                )}
                                                <StatusBadge status={c.status} />
                                            </div>
                                        </div>

                                        <p className="text-sm font-medium text-black">
                                            {c.task?.description || `Quest by FID ${c.creatorFid}`}
                                        </p>

                                        {/* Previews */}
                                        {c.task?.castData && <CastPreview castData={c.task.castData} />}
                                        {c.task?.miniappData && <MiniAppPreview miniappData={c.task.miniappData} />}

                                        <div className="flex items-center justify-center text-xs text-gray-400">
                                            {c.status === "pending" &&
                                                c.task?.expiresAt &&
                                                new Date(c.task.expiresAt).getTime() <= Date.now() ? (
                                                <span className="text-amber-600 font-medium">Verification in progress…</span>
                                            ) : c.task?.status === "verified" ? (
                                                <></>
                                            ) : (
                                                <>
                                                    <p className="mr-2">Claim in </p>
                                                    <CountdownBadge
                                                        expiresAt={c.task?.expiresAt}
                                                        className={!c.task?.expiresAt || new Date(c.task.expiresAt).getTime() <= Date.now() ? 'text-gray-400' : 'text-orange-500'}
                                                    />
                                                    {c.task?.computedRewardPerUser != null && (
                                                        <span className="font-semibold text-green-600 ml-1">
                                                            {getRewardTokenLabel(c.task) === 'G$' ? Math.round(c.task.computedRewardPerUser).toLocaleString() : c.task.computedRewardPerUser.toFixed(4)} {getRewardTokenLabel(c.task)}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        {/* Claim Button: only if success, not yet claimed, not reclaimed (DB or on-chain) */}
                                        {c.status === "success" && c.claimStatus !== "claimed" && c.claimStatus !== "reclaimed" && !claimedOnChain[c._id] && (
                                            <button
                                                onClick={() => handleClaim(c)}
                                                disabled={claimingId === c.taskId}
                                                className="btn btn-primary w-full py-3 disabled:opacity-50"
                                            >
                                                {claimingId === c.taskId ? (
                                                    <>
                                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                        Claiming…
                                                    </>
                                                ) : (
                                                    <>
                                                        <FontAwesomeIcon icon={faWallet} />
                                                        Claim {getRewardTokenLabel(c.task ?? {}) === 'G$' ? Math.round(c.task?.computedRewardPerUser ?? 0).toLocaleString() : (c.task?.computedRewardPerUser?.toFixed(4) || "")} {getRewardTokenLabel(c.task ?? {})}
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {(c.claimStatus === "claimed" || claimedOnChain[c._id]) && (
                                            <div className="text-center text-xs font-semibold text-green-600 py-2.5 bg-green-50 rounded-xl border border-green-100">
                                                ✅ Claimed {(() => { const t = getRewardTokenLabel(c.task ?? {}); const amt = c.claimAmount ?? c.task?.computedRewardPerUser ?? 0; return t === 'G$' ? Math.round(amt).toLocaleString() : amt.toFixed(4); })()} {getRewardTokenLabel(c.task ?? {})}
                                            </div>
                                        )}

                                        {c.claimStatus === "reclaimed" && (
                                            <div className="text-center text-xs font-semibold text-red-500 py-2.5 bg-red-50 rounded-xl border border-red-100 flex items-center justify-center gap-1.5">
                                                <FontAwesomeIcon icon={faTimesCircle} className="text-[10px]" />
                                                Too late — creator reclaimed this reward
                                            </div>
                                        )}

                                        {c.verifyTxHash === 'auto-boost' && (
                                            <p className="text-[10px] text-gray-400 text-center leading-snug pt-2 mt-1 border-t border-gray-100">
                                                <FontAwesomeIcon icon={faBolt} className="text-cyan-500 mr-1 text-[9px]" />
                                                Like & recast done by TaskPay with your signer.
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : tab === "creator" ? (
                    <div className="space-y-4 animate-fade-in">
                        {/* Creator Stats */}
                        <div className="grid grid-cols-2 gap-3 stagger-children">
                            <StatCard label="Launched" value={creatorStats.totalTasks} />
                            <StatCard label="Spent" value={`$${creatorStats.totalBudget.toFixed(2)}`} />
                            <StatCard label="Engagements" value={creatorStats.totalCompletions} />
                            <StatCard label="Verified" value={creatorStats.totalSuccess} color="text-green-600" />
                        </div>

                        {/* Your quests */}
                        {loading ? (
                            <LoadingState />
                        ) : creatorTasks.length === 0 ? (
                            <EmptyState icon={faPaintBrush} primary="No launches yet" secondary="Create your first quest and grow your audience" />
                        ) : (
                            <div className="space-y-3 stagger-children">
                                {creatorTasks.map((task) => {
                                    const maxC = task.maxCompletions || 0;
                                    const successPct = maxC > 0 ? Math.min((task.stats.successCount / maxC) * 100, 100) : 0;
                                    const claimedPct = task.stats.successCount > 0
                                        ? Math.min((task.stats.claimedCount / task.stats.successCount) * 100, 100)
                                        : 0;
                                    const isJoinedLoading = joinedByPopupLoadingTaskId === task._id;

                                    return (
                                        <div key={task._id} className="card p-4 space-y-3">
                                            {/* Header */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                                                    {getTypeLabel(task.type)}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleShareFromProfile({ ...task, creatorFid: user?.fid }, task._id, true)}
                                                        disabled={sharingId === task._id}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${sharingId === task._id
                                                            ? 'bg-gray-100 text-gray-300 cursor-wait'
                                                            : 'bg-gray-50 border border-gray-100 text-gray-400 hover:text-black hover:bg-gray-100 active:scale-90'
                                                            }`}
                                                        title="Share this quest"
                                                    >
                                                        <FontAwesomeIcon icon={sharingId === task._id ? faSpinner : faShareNodes} className={`text-[10px] ${sharingId === task._id ? 'animate-spin' : ''}`} />
                                                    </button>
                                                    <StatusBadge status={task.status} />
                                                </div>
                                            </div>

                                            {/* Title */}
                                            <p className="text-sm font-medium text-black">
                                                {task.description || `${getTypeLabel(task.type)} quest`}
                                            </p>

                                            {/* Previews */}
                                            {task.castData && <CastPreview castData={task.castData} />}
                                            {task.miniappData && <MiniAppPreview miniappData={task.miniappData} />}

                                            {/* Budget + Timer */}
                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span className="font-semibold text-black">{getRewardTokenLabel(task) === 'G$' ? Math.round(task.totalBudget).toLocaleString() : task.totalBudget} {getRewardTokenLabel(task)}</span>
                                                <CountdownBadge
                                                    expiresAt={task.expiresAt}
                                                    className={new Date(task.expiresAt).getTime() <= Date.now() ? 'text-gray-400' : 'text-orange-500'}
                                                />
                                            </div>

                                            {/* Progress: Verified / Max */}
                                            {maxC > 0 && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="text-gray-400">
                                                            <FontAwesomeIcon icon={faUsers} className="mr-1" />
                                                            {task.stats.successCount}/{maxC} verified
                                                        </span>
                                                        <span className="font-semibold text-gray-500">{Math.round(successPct)}%</span>
                                                    </div>
                                                    <div className="progress-track">
                                                        <div className="progress-fill-success" style={{ width: `${successPct}%` }} />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Stats Grid */}
                                            <div className="grid grid-cols-4 gap-1.5">
                                                <MiniStat label="Total" value={task.stats.totalCompletions} />
                                                <MiniStat label="✓" value={task.stats.successCount} color="text-green-600" bg="bg-green-50" />
                                                <MiniStat label="✗" value={task.stats.failedCount} color="text-red-500" bg="bg-red-50" />
                                                <MiniStat label="⏳" value={task.stats.pendingCount} color="text-orange-500" bg="bg-orange-50" />
                                            </div>

                                            {/* Joined users (creator detail) */}
                                            {task.stats.totalCompletions > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => fetchJoinedUsersForTask(task)}
                                                    disabled={isJoinedLoading}
                                                    className="group w-full bg-gradient-to-br from-slate-50 to-gray-50 rounded-2xl p-3 border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm active:scale-[0.99]"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                                                            <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                                                            Who joined this quest
                                                        </span>
                                                        {isJoinedLoading ? (
                                                            <FontAwesomeIcon icon={faSpinner} className="text-[9px] text-gray-300 opacity-70 animate-spin" />
                                                        ) : (
                                                            <FontAwesomeIcon icon={faArrowUp} className="text-[9px] text-gray-300 opacity-70 rotate-90 group-hover:opacity-100 transition-all" />
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex -space-x-2">
                                                            {(task.completedBy || []).slice(0, 5).map((fid, i) => (
                                                                <div
                                                                    key={`${fid}-${i}`}
                                                                    className="w-7 h-7 rounded-full ring-2 ring-white bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center"
                                                                >
                                                                    <FontAwesomeIcon icon={faUser} className="text-[8px] text-gray-400" />
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${task.stats.successCount > 0 && task.stats.claimedCount === task.stats.successCount
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-100'
                                                            }`}>
                                                            <FontAwesomeIcon
                                                                icon={task.stats.claimedCount === task.stats.successCount ? faCircleCheck : faClock}
                                                                className="text-[9px]"
                                                            />
                                                            <span>
                                                                {task.stats.claimedCount}/{task.stats.successCount} claimed
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            )}

                                            {/* Reward + Claimed */}
                                            {task.computedRewardPerUser && (
                                                <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-2.5 text-center border border-gray-100">
                                                    Per user: <span className="text-green-600 font-semibold">{getRewardTokenLabel(task) === 'G$' ? Math.round(task.computedRewardPerUser).toLocaleString() : task.computedRewardPerUser.toFixed(4)} {getRewardTokenLabel(task)}</span>
                                                    {" · "}
                                                    Paid out: <span className="font-semibold text-black">{task.stats.claimedCount}/{task.stats.successCount}</span>
                                                </div>
                                            )}

                                            {/* ── Reclaim Section ── */}
                                            {task.reclaimedAt ? (
                                                <div className="text-center text-xs font-semibold text-green-600 py-2.5 bg-green-50 rounded-xl border border-green-100 flex items-center justify-center gap-1.5">
                                                    <FontAwesomeIcon icon={faCheckCircle} className="text-[10px]" />
                                                    Reclaimed {getRewardTokenLabel(task) === 'G$' ? Math.round(task.unclaimedAmount ?? 0).toLocaleString() : (task.unclaimedAmount ?? 0).toFixed(4)} {getRewardTokenLabel(task)}
                                                </div>
                                            ) : task.canReclaim && (task.unclaimedAmount ?? 0) > 0 ? (
                                                <button
                                                    onClick={() => handleReclaim(task)}
                                                    disabled={reclaimingId === task._id}
                                                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
                                                >
                                                    {reclaimingId === task._id ? (
                                                        <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Reclaiming…</>
                                                    ) : (
                                                        <><FontAwesomeIcon icon={faRotateLeft} /> Reclaim {getRewardTokenLabel(task) === 'G$' ? Math.round(task.unclaimedAmount ?? 0).toLocaleString() : (task.unclaimedAmount ?? 0).toFixed(4)} {getRewardTokenLabel(task)}</>
                                                    )}
                                                </button>
                                            ) : task.reclaimEligibleAt && !task.reclaimedAt && (task.unclaimedAmount ?? 0) > 0 ? (
                                                <div className="space-y-1.5">
                                                    <ReclaimCountdownBadge reclaimEligibleAt={task.reclaimEligibleAt} />
                                                    <div className="text-[10px] text-gray-400 text-center">
                                                        {getRewardTokenLabel(task) === 'G$' ? Math.round(task.unclaimedAmount ?? 0).toLocaleString() : (task.unclaimedAmount ?? 0).toFixed(4)} {getRewardTokenLabel(task)} unclaimed · reclaimable after countdown
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    // Admin tab: show all funded tasks from all creators (admin-only)
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-xs uppercase tracking-[0.18em] text-gray-400 font-semibold mb-1">
                                    Admin View
                                </div>
                                <h2 className="text-base font-bold text-black flex items-center gap-1.5">
                                    <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
                                    All Funded Tasks
                                </h2>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAdminOnlyZeroClaims((v) => !v)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                        adminOnlyZeroClaims
                                            ? "bg-amber-50 border-amber-200 text-amber-800"
                                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                    }`}
                                    title="Show only tasks with 0 verified completions and 0 claims (filtered on server)"
                                >
                                    <FontAwesomeIcon icon={faFilter} className="text-[10px]" />
                                    0/0 claims only
                                </button>
                                <div className="font-mono text-xs text-gray-400">
                                    Total: <span className="font-semibold text-black">{adminTasks.length}</span>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <LoadingState />
                        ) : adminTasks.length === 0 ? (
                            <EmptyState
                                icon={faCoins}
                                primary="No funded tasks yet"
                                secondary="Quests will show here once deposits are confirmed"
                            />
                        ) : (
                            <div className="space-y-3 stagger-children">
                                {adminTasks.map((task) => {
                                    const maxC = task.maxCompletions || 0;
                                    const successPct = maxC > 0 ? Math.min((task.stats.successCount / maxC) * 100, 100) : 0;
                                    const claimedPct = task.stats.successCount > 0
                                        ? Math.min((task.stats.claimedCount / task.stats.successCount) * 100, 100)
                                        : 0;

                                    const taskId = (task as any)._id?.toString?.() || '';

                                    return (
                                        <div key={taskId} className="card p-4 space-y-3">
                                            {/* Header row: type + status + creator + copy ID */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-xs uppercase tracking-wider text-gray-400 font-bold">
                                                            {getTypeLabel(task.type)}
                                                        </span>
                                                        {task.status && (
                                                            <StatusBadge status={task.status} />
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-black line-clamp-2">
                                                        {task.description || "Untitled quest"}
                                                    </p>
                                                    {task.castData?.text && (
                                                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                                                            “{task.castData.text}”
                                                        </p>
                                                    )}
                                                    {task.miniappData?.name && (
                                                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-1">
                                                            App: <span className="font-semibold text-gray-600">{task.miniappData.name}</span>
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (!taskId) return;
                                                            navigator.clipboard?.writeText(taskId).catch(() => { });
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 text-[11px] font-mono text-gray-500 hover:bg-gray-100 flex items-center gap-1"
                                                        title="Copy Task ID"
                                                    >
                                                        <FontAwesomeIcon icon={faArrowUp} className="rotate-90 text-[9px]" />
                                                        {taskId.slice(0, 6)}…{taskId.slice(-4)}
                                                    </button>
                                                    <div className="text-[10px] text-gray-400">
                                                        FID <span className="font-semibold text-gray-600">{task.creatorFid}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reward / budget row */}
                                            <div className="grid grid-cols-3 gap-2 text-[11px] bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                                                <div>
                                                    <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
                                                        Total Budget
                                                    </div>
                                                    <div className="font-bold text-xs text-black">
                                                        {task.rewardToken === 'G$' ? Math.round(task.totalBudget || 0).toLocaleString() : (task.totalBudget || 0).toFixed(2)} {task.rewardToken || "USDC"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
                                                        Per User
                                                    </div>
                                                    <div className="font-bold text-xs text-green-600">
                                                        {task.rewardToken === 'G$' ? Math.round(task.computedRewardPerUser || 0).toLocaleString() : (task.computedRewardPerUser || 0).toFixed(4)} {task.rewardToken || "USDC"}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wide">
                                                        Remaining
                                                    </div>
                                                    <div className="font-bold text-xs text-black">
                                                        {task.rewardToken === 'G$'
                                                            ? Math.round((task as any).remainingBudget ?? 0).toLocaleString()
                                                            : ((task as any).remainingBudget?.toFixed
                                                                ? (task as any).remainingBudget.toFixed(2)
                                                                : ((task as any).remainingBudget ?? 0).toString())} {task.rewardToken || "USDC"}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* How many users did this task (same idea as TaskFeed: completions / verified / pending / claimed) */}
                                            <div className="text-[11px] text-gray-500 pt-1 space-y-0.5">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-gray-700">
                                                        {task.stats.totalCompletions} users did this task
                                                    </span>
                                                    <span className="text-gray-400">·</span>
                                                    <span className="flex items-center gap-1">
                                                        <FontAwesomeIcon icon={faCheckCircle} className="text-[9px] text-green-500" />
                                                        <span className="font-mono">{task.stats.successCount} verified</span>
                                                    </span>
                                                    <span className="text-gray-400">·</span>
                                                    <span className="flex items-center gap-1">
                                                        <FontAwesomeIcon icon={faClock} className="text-[9px] text-amber-500" />
                                                        <span className="font-mono">{task.stats.pendingCount} pending</span>
                                                    </span>
                                                    <span className="text-gray-400">·</span>
                                                    <span className="flex items-center gap-1">
                                                        <FontAwesomeIcon icon={faWallet} className="text-[9px] text-amber-500" />
                                                        <span className="font-mono">{task.stats.claimedCount} claims</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Progress bars */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px] text-gray-400">
                                                    <span>Completions</span>
                                                    <span className="font-mono">
                                                        {task.stats.successCount}/{maxC || '∞'}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-black transition-all"
                                                        style={{ width: `${successPct}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                                                    <span>Claims</span>
                                                    <span className="font-mono">
                                                        {task.stats.claimedCount}/{task.stats.successCount}
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-green-500 transition-all"
                                                        style={{ width: `${claimedPct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Timing */}
                                            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
                                                <div className="flex items-center gap-1.5">
                                                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                                                    {task.expiresAt ? (
                                                        new Date(task.expiresAt).getTime() <= Date.now() ? (
                                                            <span className="font-semibold text-amber-600">
                                                                Quest expired — <span className="underline decoration-amber-400">time to verify this task</span>
                                                            </span>
                                                        ) : (
                                                            <span className="flex items-center gap-1">
                                                                Ends in
                                                                <CountdownBadge
                                                                    expiresAt={task.expiresAt}
                                                                    className="text-orange-500"
                                                                />
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span>Ends —</span>
                                                    )}
                                                </div>
                                                {task.onChainTaskId && (
                                                    <div className="font-mono text-[10px] text-gray-400">
                                                        On-chain ID:{" "}
                                                        <span className="text-gray-600">
                                                            {task.onChainTaskId.slice(0, 6)}…{task.onChainTaskId.slice(-4)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Joined users popup (creator detail) */}
            {joinedByPopupData && (
                <JoinedUsersPopup
                    completions={joinedByPopupData.completions}
                    perUser={joinedByPopupData.perUser}
                    token={joinedByPopupData.token}
                    onClose={() => setJoinedByPopupData(null)}
                />
            )}

            {/* Share-to-unlock: show first when REQUIRE_SHARE_TO_UNLOCK_CLAIM; user must share to unlock Claim button */}
            {REQUIRE_SHARE_TO_UNLOCK_CLAIM && showShareToUnlockModal && shareToUnlockCompletion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                                <FontAwesomeIcon icon={faLock} className="text-2xl text-amber-600" />
                            </div>
                            <h3 className="text-xl font-black text-black mb-0.5">Share to unlock & claim</h3>
                            <p className="text-gray-500 text-sm mb-1">
                                Share your reward to unlock the Claim button, then claim{" "}
                                <span className="font-bold text-green-600">
                                    {(() => { const t = getRewardTokenLabel(shareToUnlockCompletion.task ?? {}); const amt = shareToUnlockCompletion.task?.computedRewardPerUser ?? 0; return t === 'G$' ? Math.round(amt).toLocaleString() : amt.toFixed(4); })()} {getRewardTokenLabel(shareToUnlockCompletion.task ?? {})}
                                </span>
                                .
                            </p>
                            <p className="text-gray-400 text-xs mb-4">Post to feed first — then Claim will be enabled</p>
                        </div>
                        <div className="space-y-3">
                            <button
                                type="button"
                                disabled={isSharingToUnlock}
                                onClick={async () => {
                                    if (!shareToUnlockCompletion) return;
                                    setIsSharingToUnlock(true);
                                    try {
                                        const ok = await handleShareRewardClaim(shareToUnlockCompletion);
                                        if (ok) setHasSharedToUnlock(true);
                                    } catch (err) {
                                        console.error("Share-to-unlock error:", err);
                                    } finally {
                                        setIsSharingToUnlock(false);
                                    }
                                }}
                                className={`w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isSharingToUnlock ? "bg-gray-400 cursor-wait" : "bg-black hover:bg-gray-800"}`}
                            >
                                {isSharingToUnlock ? (
                                    <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Sharing...</>
                                ) : (
                                    <><FontAwesomeIcon icon={faShareNodes} /> Share to unlock</>
                                )}
                            </button>
                            <button
                                type="button"
                                disabled={!hasSharedToUnlock || claimingId === shareToUnlockCompletion.taskId}
                                onClick={() => {
                                    if (!shareToUnlockCompletion) return;
                                    doActualClaim(shareToUnlockCompletion);
                                }}
                                className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${hasSharedToUnlock && claimingId !== shareToUnlockCompletion.taskId ? "bg-green-600 hover:bg-green-700 text-white" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                            >
                                {claimingId === shareToUnlockCompletion.taskId ? (
                                    <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Claiming…</>
                                ) : hasSharedToUnlock ? (
                                    <><FontAwesomeIcon icon={faWallet} /> Claim {getRewardTokenLabel(shareToUnlockCompletion.task ?? {})}</>
                                ) : (
                                    <><FontAwesomeIcon icon={faLock} className="text-sm" /> Claim (unlock by sharing)</>
                                )}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => { setShowShareToUnlockModal(false); setShareToUnlockCompletion(null); setHasSharedToUnlock(false); }}
                            className="w-full py-2.5 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-colors"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            )}

            {/* Share-after-claim: show only after user successfully claims */}
            {showShareAfterClaimModal && shareAfterClaimCompletion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-5 animate-fade-in">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-600" />
                            </div>
                            <h3 className="text-xl font-black text-black mb-0.5">Claim successful</h3>
                            <p className="text-gray-500 text-sm mb-1">
                                You just claimed{" "}
                                <span className="font-bold text-green-600">
                                    {(() => { const t = getRewardTokenLabel(shareAfterClaimCompletion.task ?? {}); const amt = shareAfterClaimCompletion.task?.computedRewardPerUser ?? 0; return t === 'G$' ? Math.round(amt).toLocaleString() : amt.toFixed(4); })()} {getRewardTokenLabel(shareAfterClaimCompletion.task ?? {})}
                                </span>
                                . Share it?
                            </p>
                            <p className="text-gray-400 text-xs mb-4">Post your win and bring more people to @taskpay</p>
                        </div>
                        <button
                            type="button"
                            disabled={isSharingAfterClaim}
                            onClick={async () => {
                                if (!shareAfterClaimCompletion) return;
                                setIsSharingAfterClaim(true);
                                try {
                                    await handleShareRewardClaim(shareAfterClaimCompletion);
                                    setShowShareAfterClaimModal(false);
                                    setShareAfterClaimCompletion(null);
                                } catch (err) {
                                    console.error("Share-after-claim error:", err);
                                } finally {
                                    setIsSharingAfterClaim(false);
                                }
                            }}
                            className={`w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${isSharingAfterClaim ? "bg-gray-400 cursor-wait" : "bg-black hover:bg-gray-800"}`}
                        >
                            {isSharingAfterClaim ? (
                                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Sharing...</>
                            ) : (
                                <><FontAwesomeIcon icon={faShareNodes} /> Share to feed</>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => { setShowShareAfterClaimModal(false); setShareAfterClaimCompletion(null); }}
                            className="w-full py-2.5 rounded-xl text-gray-500 font-medium text-sm hover:bg-gray-100 transition-colors"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            )}

            {portalReady &&
                createPortal(
                    <AnimatePresence>
                        {showAutoBoostModal && (
                            <motion.div
                                key="auto-boost-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:pb-4 bg-black/55 backdrop-blur-sm"
                                onClick={() => setShowAutoBoostModal(false)}
                            >
                                <motion.div
                                    key="auto-boost-sheet"
                                    initial={{ y: 24, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 16, opacity: 0 }}
                                    transition={{ type: "spring", damping: 26, stiffness: 320 }}
                                    className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden max-h-[min(88vh,640px)] flex flex-col mb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:mb-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="h-1 bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-500 shrink-0" />
                                    <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0">
                                        <div className="flex items-start justify-between gap-3 mb-1">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-100 to-teal-50 flex items-center justify-center shrink-0 shadow-sm ring-1 ring-cyan-500/10">
                                                    <FontAwesomeIcon icon={faBolt} className="text-cyan-600 text-lg" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h2 className="text-lg font-black text-black tracking-tight">Auto-boost</h2>
                                                    <p className="text-[11px] text-gray-400 font-medium">Farcaster signer ·</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                aria-label="Close"
                                                onClick={() => setShowAutoBoostModal(false)}
                                                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors shrink-0"
                                            >
                                                <FontAwesomeIcon icon={faTimesCircle} className="text-sm text-gray-500" />
                                            </button>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <AutoBoostSigner variant="plain" />
                                        </div>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body,
                )}

            {/* Error toast */}
            {claimError && (
                <div
                    className="fixed bottom-28 left-4 right-4 bg-red-500 text-white text-sm font-medium p-4 rounded-2xl z-50 text-center shadow-xl animate-slide-up cursor-pointer"
                    onClick={() => setClaimError(null)}
                >
                    {claimError}
                </div>
            )}
            {reclaimError && (
                <div
                    className="fixed bottom-28 left-4 right-4 bg-red-500 text-white text-sm font-medium p-4 rounded-2xl z-50 text-center shadow-xl animate-slide-up cursor-pointer"
                    onClick={() => setReclaimError(null)}
                >
                    {reclaimError}
                </div>
            )}
        </div>
    );
}

function JoinedUsersPopup({
    completions,
    perUser,
    token,
    onClose,
}: {
    completions: Array<{
        userFid: number;
        userUsername: string | null;
        userDisplayName: string | null;
        userPfpUrl: string | null;
        status: 'pending' | 'success' | 'failed';
        claimStatus: 'unclaimed' | 'claimed' | 'reclaimed';
        claimAmount?: number;
        isPro: boolean;
    }>;
    perUser: number;
    token: string;
    onClose: () => void;
}) {
    const total = completions.length;
    const claimed = completions.filter((c) => c.claimStatus === 'claimed').length;
    const verified = completions.filter((c) => c.status === 'success').length;
    const pending = completions.filter((c) => c.status === 'pending').length;
    const failed = completions.filter((c) => c.status === 'failed').length;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

                <div className="p-5 space-y-4 pb-8 sm:pb-5 max-h-[74vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-sm">
                                <FontAwesomeIcon icon={faUsers} className="text-sm text-emerald-600" />
                            </div>
                            <div className="leading-tight">
                                <div className="text-[13px] font-black text-black">Quest joiners</div>
                                <div className="text-[11px] text-gray-400">{total} joined</div>
                            </div>
                        </div>

                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
                            aria-label="Close"
                        >
                            <FontAwesomeIcon icon={faTimesCircle} className="text-xs text-gray-500" />
                        </button>
                    </div>

                    {/* Per-user value pill */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 px-2.5 py-1 rounded-lg">
                            <FontAwesomeIcon icon={faCoins} className="text-[10px] text-amber-500" />
                            <span className="text-[11px] font-bold text-amber-700">
                                {perUser.toFixed(4)} {token}
                            </span>
                            <span className="text-[9px] text-amber-500/70 font-medium">per user</span>
                        </div>
                    </div>

                    {/* Small stats row */}
                    <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                        <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Verified</div>
                            <div className="font-bold text-sm text-black">{verified}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Pending</div>
                            <div className="font-bold text-sm text-black">{pending}</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-2 border border-gray-100">
                            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Failed</div>
                            <div className="font-bold text-sm text-black">{failed}</div>
                        </div>
                    </div>

                    {/* Claim progress bar */}
                    <div className="flex-shrink-0 space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span className="flex items-center gap-1">
                                <FontAwesomeIcon icon={faCircleCheck} className="text-[9px] text-emerald-500" />
                                Claimed
                            </span>
                            <span className="font-mono">{claimed}/{total}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
                                style={{ width: `${total > 0 ? (claimed / total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>

                    {/* User list */}
                    <div className="space-y-2 overflow-y-auto flex-1 pr-1 -mr-1">
                        {completions.map((c, i) => {
                            const avatarRing =
                                c.claimStatus === 'claimed'
                                    ? 'ring-emerald-300'
                                    : c.claimStatus === 'reclaimed'
                                        ? 'ring-red-200'
                                        : c.status === 'success'
                                            ? 'ring-amber-200'
                                            : 'ring-amber-200';

                            const claimBadge =
                                c.claimStatus === 'claimed'
                                    ? {
                                        bg: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200',
                                        label: 'Claimed',
                                        icon: faCircleCheck,
                                    }
                                    : c.claimStatus === 'reclaimed'
                                        ? {
                                            bg: 'bg-red-500 text-white shadow-sm shadow-red-200',
                                            label: 'Reclaimed',
                                            icon: faTimesCircle,
                                        }
                                        : c.status === 'success'
                                            ? {
                                                bg: 'bg-amber-100 text-amber-700 border border-amber-200',
                                                label: 'Verified (unclaimed)',
                                                icon: faClock,
                                            }
                                            : c.status === 'failed'
                                                ? {
                                                    bg: 'bg-red-100 text-red-700 border border-red-200',
                                                    label: 'Failed',
                                                    icon: faTimesCircle,
                                                }
                                                : {
                                                    bg: 'bg-amber-50 text-amber-700 border border-amber-100',
                                                    label: 'Pending',
                                                    icon: faClock,
                                                };

                            const displayName = c.userDisplayName || c.userUsername || `FID ${c.userFid}`;
                            const username = c.userUsername ? `@${c.userUsername}` : '@user';

                            return (
                                <div
                                    key={`${c.userFid}-${i}`}
                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${c.claimStatus === 'claimed'
                                        ? 'bg-emerald-50/60 border-emerald-200/50'
                                        : c.claimStatus === 'reclaimed'
                                            ? 'bg-red-50/60 border-red-200/50'
                                            : c.status === 'success'
                                                ? 'bg-amber-50/40 border-amber-200/40'
                                                : 'bg-amber-50/25 border-amber-200/30'
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        {c.userPfpUrl ? (
                                            <img
                                                src={c.userPfpUrl}
                                                alt=""
                                                className={`w-9 h-9 rounded-full object-cover ring-2 shadow-sm ${avatarRing}`}
                                            />
                                        ) : (
                                            <div
                                                className={`w-9 h-9 rounded-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-orange-100 ring-2 shadow-sm ${avatarRing}`}
                                            >
                                                <FontAwesomeIcon icon={faUser} className="text-[10px] text-gray-400" />
                                            </div>
                                        )}
                                        {c.isPro && (
                                            <div className="absolute -bottom-1 -right-1 z-10" title="Farcaster Pro">
                                                <ProBadge size={14} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-black truncate">{displayName}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{username}</p>
                                        <p className="text-[9px] text-gray-500 font-mono truncate">
                                            FID {c.userFid}
                                        </p>
                                    </div>

                                    {/* Claim badge */}
                                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${claimBadge.bg}`}>
                                        <FontAwesomeIcon icon={claimBadge.icon} className="text-[9px]" />
                                        <span>{claimBadge.label}</span>
                                    </div>
                                </div>
                            );
                        })}

                        {completions.length === 0 && (
                            <div className="text-center py-6 text-gray-400 text-xs">No joiners yet</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="card p-4">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`text-xl font-bold ${color || 'text-black'}`}>{value}</div>
        </div>
    );
}

function MiniStat({ label, value, color, bg }: { label: string; value: number; color?: string; bg?: string }) {
    return (
        <div className={`text-center rounded-lg py-2 ${bg || 'bg-gray-50'}`}>
            <div className={`text-[10px] ${color || 'text-gray-400'}`}>{label}</div>
            <div className={`font-bold text-sm ${color || 'text-black'}`}>{value}</div>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        </div>
    );
}

function EmptyState({ icon, primary, secondary }: { icon: any; primary: string; secondary: string }) {
    return (
        <div className="text-center py-12">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <FontAwesomeIcon icon={icon} className="text-xl text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">{primary}</p>
            <p className="text-gray-300 text-sm mt-1">{secondary}</p>
        </div>
    );
}
