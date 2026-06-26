"use client";

import React, { useState, useCallback, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus, faRocket, faQuoteRight, faHashtag, faLayerGroup, faBolt, faSearch, faTimes, faInfoCircle, faHeart, faRetweet, faExclamationCircle, faCheck, faSpinner, faCoins, faClock, faUsers, faSeedling, faPenToSquare, faFire, faStar, faHouse, faComment, faShareNodes, faBullseye, faCalendarDays, faRightLeft, faWallet, faShieldHalved, faArrowsRotate } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { useAppMode } from '@/components/app-mode-provider';
import { useUserIdentity } from '@/components/hooks/useUserIdentity';
import { useAppActions } from '@/components/hooks/useAppActions';
import { useFrame } from '@/components/farcaster-provider';
import { useAccount, useWalletClient, usePublicClient, useConfig } from 'wagmi';
import { parseUnits, encodeFunctionData, formatUnits } from 'viem';
import { switchChain } from 'wagmi/actions';
import {
  USDC_ABI,
  USDC_ADDRESS,
  TASK_ESCROW_ABI,
  TASK_ESCROW_ADDRESS,
  PLATFORM_FEE_ADDRESS,
  PLATFORM_FEE_USDC,
  G_DOLLAR_ABI,
  UBI_SCHEME_ADDRESS,
} from '@/lib/contracts';
import { getPerUserRewardUSDC, getMaxCompletions, getMaxCompletionsForToken, getPerUserReward, formatTokenAmount } from '@/lib/taskRewards';
import { useGDollarPrice } from '@/components/hooks/useGDollarPrice';
import { gDollarToUSD } from '@/lib/gdollarPrice';
import { APP_URL } from '@/lib/constants';
import { arbitrum, celo } from 'wagmi/chains';
import { CELO_CHAIN_ID } from '@/lib/chainConfig';
import { getQuestChainUi, type RewardChainChoice } from '@/lib/questChainClient';
import { captureTaskShareImage, TaskShareImageData } from '@/lib/taskShareImage';
import { XLogo, FarcasterLogo } from '@/components/icons';

type TaskType =
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
    | 'x_bundle';

import { pickEscrowDepositTxHash } from '@/components/Promote/createTaskUtils';
import { parseViewerFid } from '@/lib/neynar';
import { ensureBrowserWalletClient } from '@/lib/ensureBrowserWallet';

function getFrameDisplayName(frame: any): string {
    return frame?.name ?? frame?.manifest?.frame?.name ?? frame?.manifest?.miniapp?.name ?? frame?.title ?? 'MiniApp';
}

function getFrameDeveloper(frame: any): { name: string; pfp: string } {
    const author = frame?.author;
    const name = author?.display_name ?? author?.username ?? 'Developer';
    const pfp = author?.pfp_url ?? '';
    return { name, pfp };
}

export type CreateTaskWizardStep = 'type' | 'details' | 'budget' | 'all';

export interface CreateTaskSummary {
    platform: 'farcaster' | 'x';
    selectedType: TaskType;
    totalBudget: number;
    expiresInDays: number;
    perUserReward: number;
    estimatedReach: number;
    totalCost: number;
    targetLabel?: string;
    tokenSymbol?: string;
}

export interface CreateTaskHandle {
    validateDetails: () => string | null;
}

export const QUEST_TYPE_LABELS: Record<TaskType, string> = {
    follow: 'Grow',
    boost_lite: 'Boost',
    boost: 'Amplify',
    quote: 'Engage',
    channel: 'Community',
    multi: 'Bundle',
    miniapp: 'Mini App',
    x_follow: 'Grow',
    x_boost_lite: 'Boost Lite',
    x_boost: 'Boost',
    x_bundle: 'Bundle',
};

interface CreateTaskProps {
    onQuestCreated?: () => void;
    platform?: 'farcaster' | 'x';
    wizardStep?: CreateTaskWizardStep;
    dashboard?: boolean;
    onSummaryChange?: (summary: CreateTaskSummary) => void;
}

const CreateTask = forwardRef<CreateTaskHandle, CreateTaskProps>(function CreateTask(
    { onQuestCreated, platform: externalPlatform, wizardStep = 'all', dashboard = false, onSummaryChange },
    ref,
) {
    const { context, actions } = useFrame();
    const appActions = useAppActions();
    const { isBrowser } = useAppMode();
    const identity = useUserIdentity();
    const user = context?.user;
    const viewerFid = identity.fid ?? user?.fid;
    const { address } = useAccount();
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();
    const wagmiConfig = useConfig();
    const effectiveAddress =
        address ??
        (isBrowser && identity.walletAddress ? (identity.walletAddress as `0x${string}`) : undefined);
    const [selectedType, setSelectedType] = useState<TaskType>('follow');
    const [internalPlatform, setInternalPlatform] = useState<'farcaster' | 'x'>('farcaster');
    const platform = externalPlatform || internalPlatform;

    useEffect(() => {
        if (externalPlatform) {
            setSelectedType(externalPlatform === 'farcaster' ? 'follow' : 'x_follow');
        }
    }, [externalPlatform]);

    const [totalBudget, setTotalBudget] = useState(10);
    const [rewardChain, setRewardChain] = useState<RewardChainChoice>('celo');
    const questChain = getQuestChainUi(rewardChain);
    const { price: gDollarPrice } = useGDollarPrice();
    const isGQuest = questChain.tokenSymbol === 'G$';

    // Token balance (USDC or G$)
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
    const [isCheckingBalance, setIsCheckingBalance] = useState(false);
    const [isSwapping, setIsSwapping] = useState(false);

    const ARB_USDC_CAIP19 = 'eip155:42161/erc20:0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
    const BASE_USDC_CAIP19 = 'eip155:8453/erc20:0x0000000000000000000000000000000000000000';


    const fetchUsdcBalance = async () => {
        if (!effectiveAddress || !publicClient) return;
        setIsCheckingBalance(true);
        try {
            const raw = await publicClient.readContract({
                address: questChain.tokenAddress,
                abi: questChain.tokenAbi,
                functionName: 'balanceOf',
                args: [effectiveAddress],
            });
            setUsdcBalance(parseFloat(formatUnits(raw as bigint, questChain.tokenDecimals)));
        } catch (e) {
            console.error('Failed to fetch token balance', e);
        } finally {
            setIsCheckingBalance(false);
        }
    };

    useEffect(() => {
        fetchUsdcBalance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveAddress, rewardChain]);
    const [isLoading, setIsLoading] = useState(false);

    // Deposit flow state
    type DepositStep = 'idle' | 'batching' | 'waiting_tx' | 'creating_db' | 'done' | 'error';
    type SequentialTxKey = 'approve' | 'deposit' | 'fee';
    type SequentialTxStatus = 'pending' | 'wallet' | 'confirming' | 'done';
    type DepositTxMode = 'batch' | 'sequential' | null;

    const SEQUENTIAL_TX_PENDING: Record<SequentialTxKey, SequentialTxStatus> = {
        approve: 'pending',
        deposit: 'pending',
        fee: 'pending',
    };

    const [depositStep, setDepositStep] = useState<DepositStep>('idle');
    const [depositError, setDepositError] = useState<string | null>(null);
    const [depositTxMode, setDepositTxMode] = useState<DepositTxMode>(null);
    const [sequentialTxStep, setSequentialTxStep] = useState<Record<SequentialTxKey, SequentialTxStatus>>(SEQUENTIAL_TX_PENDING);

    // Form States
    const [targetUsername, setTargetUsername] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    const [targetUrl, setTargetUrl] = useState('');
    const [userCasts, setUserCasts] = useState<any[]>([]);
    const [selectedCast, setSelectedCast] = useState<any>(null);
    const [isFetchingCasts, setIsFetchingCasts] = useState(false);
    const [showMyPostsModal, setShowMyPostsModal] = useState(false);
    const [linkVerifyError, setLinkVerifyError] = useState<string | null>(null);
    const [isVerifyingLink, setIsVerifyingLink] = useState(false);
    /** When opening "Pick from my casts", which field we're selecting for */
    const [selectingCastFor, setSelectingCastFor] = useState<'boost' | 'miniappFeedback' | null>(null);

    // Miniapp: feedback cast — verify via comment or quote
    const [miniappFeedbackMode, setMiniappFeedbackMode] = useState<'comment' | 'quote'>('comment');
    const [miniappFeedbackCastUrl, setMiniappFeedbackCastUrl] = useState('');
    const [selectedMiniappFeedbackCast, setSelectedMiniappFeedbackCast] = useState<any>(null);
    const [miniappFeedbackLinkError, setMiniappFeedbackLinkError] = useState<string | null>(null);
    const [isVerifyingMiniappFeedbackLink, setIsVerifyingMiniappFeedbackLink] = useState(false);

    // Miniapp: URL input + frame search
    const [frameSearchQuery, setFrameSearchQuery] = useState('');
    const [frameResults, setFrameResults] = useState<any[]>([]);
    const [selectedFrame, setSelectedFrame] = useState<any>(null);
    const [isSearchingFrames, setIsSearchingFrames] = useState(false);
    const [miniappEditName, setMiniappEditName] = useState('');
    const [miniappEditDescription, setMiniappEditDescription] = useState('');
    const [miniappAudience, setMiniappAudience] = useState<'new_users_only' | 'all_users'>('all_users');
    const [miniappHasExisting, setMiniappHasExisting] = useState(false);
    const [miniappCheckingExisting, setMiniappCheckingExisting] = useState(false);

    const [expiresInDays, setExpiresInDays] = useState(1);
    const [showQuestCreatedModal, setShowQuestCreatedModal] = useState(false);
    const [sharingQuest, setSharingQuest] = useState(false);

    // Targeting (optional eligibility) — on/off then criteria
    const [targetingEnabled, setTargetingEnabled] = useState(false);
    const [minFollowers, setMinFollowers] = useState<number | ''>('');
    const [minNeynarScore, setMinNeynarScore] = useState<number | ''>('');
    const [minAccountAgeDays, setMinAccountAgeDays] = useState<number | ''>('');
    const [nonSpamOnly, setNonSpamOnly] = useState(false);

    // X (Twitter) quest state
    const [xSearchQuery, setXSearchQuery] = useState('');
    const [xSearchResults, setXSearchResults] = useState<any[]>([]);
    const [isSearchingX, setIsSearchingX] = useState(false);
    const [selectedXUser, setSelectedXUser] = useState<any>(null);
    const [xTweetUrl, setXTweetUrl] = useState('');
    const [xTweetData, setXTweetData] = useState<any>(null);
    const [isFetchingTweet, setIsFetchingTweet] = useState(false);
    const [xTweetError, setXTweetError] = useState<string | null>(null);
    const [minXFollowers, setMinXFollowers] = useState<number | ''>('');

    const searchUserTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const verifyLinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Budget of the task we just created; used for share image so it doesn't get overwritten when form resets to 10 after 3s */
    const createdTaskBudgetRef = useRef<number>(10);

    useEffect(() => {
        if (selectedType !== 'miniapp' || !selectedFrame?.frames_url) {
            setMiniappHasExisting(false);
            return;
        }
        let cancelled = false;
        setMiniappCheckingExisting(true);
        axios.get(`/api/tasks/check-miniapp-quest?miniappUrl=${encodeURIComponent(selectedFrame.frames_url)}`)
            .then((res) => { if (!cancelled) setMiniappHasExisting(!!res.data?.hasExisting); })
            .catch(() => { if (!cancelled) setMiniappHasExisting(false); })
            .finally(() => { if (!cancelled) setMiniappCheckingExisting(false); });
        return () => { cancelled = true; };
    }, [selectedType, selectedFrame?.frames_url]);

    const looksLikeCastUrl = (s: string) => {
        const t = s.trim();
        return (
            (t.includes('farcaster.xyz/') && t.split('/').length >= 4) ||
            (t.includes('farcaster.xyz/') && t.split('/').length >= 4) ||
            /^0x[a-fA-F0-9]{40}$/.test(t)
        );
    };

    const handleSearchUser = useCallback(async (q: string) => {
        if (!q) {
            setSearchResults([]);
            return;
        }
        setIsLoading(true);
        try {
            const params = new URLSearchParams({ q });
            const parsedViewerFid = parseViewerFid(viewerFid);
            if (parsedViewerFid != null) params.set('viewerFid', String(parsedViewerFid));
            const res = await axios.get(`/api/neynar/search?${params}`);
            setSearchResults(res.data.users || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [viewerFid]);

    const onUsernameChange = (value: string) => {
        setTargetUsername(value);
        if (searchUserTimeoutRef.current) clearTimeout(searchUserTimeoutRef.current);
        if (!value) {
            setSearchResults([]);
            return;
        }
        searchUserTimeoutRef.current = setTimeout(() => handleSearchUser(value), 300);
    };

    const handleFetchMyCasts = async (forCast: 'boost' | 'miniappFeedback' = 'boost') => {
        const fcFid = identity.fid ?? user?.fid;
        if (!fcFid) return;
        setSelectingCastFor(forCast);
        setShowMyPostsModal(true);
        setIsFetchingCasts(true);
        setUserCasts([]);
        try {
            const params = new URLSearchParams({ fid: String(fcFid) });
            const parsedViewerFid = parseViewerFid(fcFid);
            if (parsedViewerFid != null) params.set('viewerFid', String(parsedViewerFid));
            const res = await axios.get(`/api/neynar/casts?${params}`);
            setUserCasts(res.data.casts || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingCasts(false);
        }
    };

    const handleSelectCast = (cast: any) => {
        const url = `https://farcaster.xyz/${cast.author?.username ?? 'user'}/${cast.hash?.substring(0, 10) ?? ''}`;
        if (selectingCastFor === 'miniappFeedback') {
            setSelectedMiniappFeedbackCast(cast);
            setMiniappFeedbackCastUrl(url);
            setMiniappFeedbackLinkError(null);
        } else {
            setSelectedCast(cast);
            setTargetUrl(url);
            setLinkVerifyError(null);
        }
        setSelectingCastFor(null);
        setUserCasts([]);
        setShowMyPostsModal(false);
    };

    const verifyLinkWithValue = useCallback(async (raw: string) => {
        const trimmed = raw?.trim();
        if (!trimmed) return;
        const isUrl = trimmed.startsWith('http') || (trimmed.includes('/') && !/^0x[a-fA-F0-9]{40}$/.test(trimmed));
        const type = isUrl ? 'url' : 'hash';
        setLinkVerifyError(null);
        setIsVerifyingLink(true);
        try {
            const params = new URLSearchParams({ identifier: trimmed, type });
            const parsedViewerFid = parseViewerFid(viewerFid);
            if (parsedViewerFid != null) params.set('viewerFid', String(parsedViewerFid));
            const res = await axios.get(`/api/neynar/cast/lookup?${params}`);
            const cast = res.data?.cast;
            if (cast) {
                setSelectedCast(cast);
                setTargetUrl(trimmed);
            } else {
                setLinkVerifyError('Please provide a correct post link.');
                setSelectedCast(null);
            }
        } catch (e: any) {
            const msg = e.response?.data?.error ?? 'Cast not found. Please provide a correct post link.';
            setLinkVerifyError(msg);
            setSelectedCast(null);
        } finally {
            setIsVerifyingLink(false);
        }
    }, [viewerFid]);

    const verifyMiniappFeedbackLink = useCallback(async (raw: string) => {
        const trimmed = raw?.trim();
        if (!trimmed) return;
        setMiniappFeedbackLinkError(null);
        setIsVerifyingMiniappFeedbackLink(true);
        try {
            const isUrl = trimmed.startsWith('http') || (trimmed.includes('/') && !/^0x[a-fA-F0-9]{40}$/.test(trimmed));
            const type = isUrl ? 'url' : 'hash';
            const params = new URLSearchParams({ identifier: trimmed, type });
            const parsedViewerFid = parseViewerFid(viewerFid);
            if (parsedViewerFid != null) params.set('viewerFid', String(parsedViewerFid));
            const res = await axios.get(`/api/neynar/cast/lookup?${params}`);
            const cast = res.data?.cast;
            if (cast) {
                setSelectedMiniappFeedbackCast(cast);
                setMiniappFeedbackCastUrl(trimmed);
            } else {
                setMiniappFeedbackLinkError('Please provide a correct post link.');
                setSelectedMiniappFeedbackCast(null);
            }
        } catch (e: any) {
            const msg = e.response?.data?.error ?? 'Cast not found. Please provide a correct post link.';
            setMiniappFeedbackLinkError(msg);
            setSelectedMiniappFeedbackCast(null);
        } finally {
            setIsVerifyingMiniappFeedbackLink(false);
        }
    }, [viewerFid]);

    const onPostUrlChange = useCallback((value: string) => {
        setTargetUrl(value);
        setLinkVerifyError(null);

        if (verifyLinkTimeoutRef.current) {
            clearTimeout(verifyLinkTimeoutRef.current);
            verifyLinkTimeoutRef.current = null;
        }

        const trimmed = value.trim();
        if (!trimmed) {
            setSelectedCast(null);
            return;
        }

        if (!looksLikeCastUrl(trimmed)) {
            setSelectedCast(null);
            return;
        }

        verifyLinkTimeoutRef.current = setTimeout(() => {
            verifyLinkTimeoutRef.current = null;
            verifyLinkWithValue(trimmed);
        }, 600);
    }, [verifyLinkWithValue]);

    const handleSearchFrames = async () => {
        const q = frameSearchQuery?.trim();
        if (!q) return;
        setIsSearchingFrames(true);
        setFrameResults([]);
        try {
            const res = await axios.get(`/api/neynar/frames?q=${encodeURIComponent(q)}&limit=10`);
            setFrameResults(res.data.frames || []);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSearchingFrames(false);
        }
    };

    // X (Twitter) search handler — manual search button, not auto
    const handleSearchXUsers = async () => {
        const q = xSearchQuery.trim();
        if (!q || q.length < 2) return;
        setIsSearchingX(true);
        setXSearchResults([]);
        try {
            const res = await axios.get(`/api/twitter/search?q=${encodeURIComponent(q)}`);
            setXSearchResults(res.data.users || []);
        } catch (e) {
            console.error('X user search error:', e);
        } finally {
            setIsSearchingX(false);
        }
    };

    // X tweet URL → fetch tweet data
    const handleFetchTweet = async (url: string) => {
        const trimmed = url.trim();
        if (!trimmed) return;
        // Extract tweet ID from URL
        const match = trimmed.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
        if (!match) {
            setXTweetError('Please enter a valid X/Twitter post URL (e.g. https://x.com/user/status/123)');
            return;
        }
        setIsFetchingTweet(true);
        setXTweetError(null);
        setXTweetData(null);
        try {
            const res = await axios.get(`/api/twitter/tweet?id=${match[1]}`);
            if (res.data?.tweet) {
                setXTweetData(res.data.tweet);
            } else {
                setXTweetError('Tweet not found. Please check the URL.');
            }
        } catch (e) {
            console.error('Tweet fetch error:', e);
            setXTweetError('Failed to fetch tweet. Please check the URL and try again.');
        } finally {
            setIsFetchingTweet(false);
        }
    };

    const getDetailsValidationError = useCallback((): string | null => {
        const needsUser = selectedType === 'follow' || selectedType === 'multi';
        const needsCast = selectedType === 'boost_lite' || selectedType === 'boost' || selectedType === 'quote' || selectedType === 'multi';
        const needsMiniappUrl = selectedType === 'miniapp';
        const needsChannelUrl = selectedType === 'channel';
        const needsXUser = selectedType === 'x_follow' || selectedType === 'x_bundle';
        const needsXTweet =
            selectedType === 'x_boost_lite' ||
            selectedType === 'x_boost' ||
            selectedType === 'x_bundle';

        if (needsUser && !selectedUser) return 'Please select a user to follow.';
        if (needsCast && !selectedCast) return 'Please select a post (or choose from your posts).';
        if (needsMiniappUrl && !targetUrl && !selectedFrame?.frames_url) {
            return 'Please enter a MiniApp URL or search and select one.';
        }
        if (needsMiniappUrl && !selectedMiniappFeedbackCast) {
            return miniappFeedbackMode === 'quote'
                ? 'Please add a cast link for feedback (users will quote that post to verify).'
                : 'Please add a cast link for feedback (users will comment there).';
        }
        if (needsChannelUrl && !targetUrl?.trim()) return 'Please enter a channel URL.';
        if (needsXUser && !selectedXUser) return 'Please search and select an X user to follow.';
        if (needsXTweet && !xTweetData) return 'Please enter a tweet URL and fetch the tweet data.';
        return null;
    }, [
        selectedType,
        selectedUser,
        selectedCast,
        targetUrl,
        selectedFrame,
        selectedMiniappFeedbackCast,
        miniappFeedbackMode,
        selectedXUser,
        xTweetData,
    ]);

    useImperativeHandle(ref, () => ({
        validateDetails: getDetailsValidationError,
    }), [getDetailsValidationError]);

    useEffect(() => {
        if (!onSummaryChange) return;

        let targetLabel: string | undefined;
        if (selectedUser?.username) targetLabel = `@${selectedUser.username}`;
        else if (selectedCast?.author?.username) targetLabel = `Cast by @${selectedCast.author.username}`;
        else if (selectedXUser?.username) targetLabel = `@${selectedXUser.username}`;
        else if (xTweetData?.author?.username) targetLabel = `Tweet by @${xTweetData.author.username}`;
        else if (selectedFrame?.name) targetLabel = selectedFrame.name;
        else if (targetUrl?.trim()) targetLabel = targetUrl.trim();

        onSummaryChange({
            platform,
            selectedType,
            totalBudget,
            expiresInDays,
            perUserReward: getPerUserReward(selectedType, questChain.tokenSymbol, gDollarPrice),
            estimatedReach: getMaxCompletionsForToken(totalBudget, selectedType, questChain.tokenSymbol, gDollarPrice),
            totalCost: totalBudget + questChain.feeAmount,
            targetLabel,
            tokenSymbol: questChain.tokenSymbol,
        });
    }, [
        onSummaryChange,
        platform,
        selectedType,
        totalBudget,
        expiresInDays,
        selectedUser,
        selectedCast,
        selectedXUser,
        xTweetData,
        selectedFrame,
        rewardChain,
        questChain.feeAmount,
        questChain.tokenSymbol,
        gDollarPrice,
    ]);

    const handleCreateTask = async () => {
        let txAddress = address as `0x${string}` | undefined;
        let txWalletClient = walletClient;

        if ((!txAddress || !txWalletClient) && isBrowser) {
            const ensured = await ensureBrowserWalletClient(wagmiConfig, identity.walletAddress ?? undefined);
            if (ensured) {
                txAddress = ensured.address;
                txWalletClient = ensured.walletClient as typeof walletClient;
            }
        }

        if (!txAddress || !txWalletClient) {
            setDepositError(
                isBrowser && identity.siweVerified
                    ? 'Wallet not ready for transactions. Reconnect via the profile menu in the top nav, then try again.'
                    : 'Please connect your wallet first.',
            );
            return;
        }

        setDepositStep('batching');
        setDepositError(null);
        setDepositTxMode(null);
        setSequentialTxStep(SEQUENTIAL_TX_PENDING);

        try {
            const needsUser = selectedType === 'follow' || selectedType === 'multi';
            const needsCast = selectedType === 'boost_lite' || selectedType === 'boost' || selectedType === 'quote' || selectedType === 'multi';
            const needsMiniappUrl = selectedType === 'miniapp';
            const needsChannelUrl = selectedType === 'channel';
            const isXTask =
                selectedType === 'x_follow' ||
                selectedType === 'x_boost_lite' ||
                selectedType === 'x_boost' ||
                selectedType === 'x_bundle';
            const needsXUser = selectedType === 'x_follow' || selectedType === 'x_bundle';
            const needsXTweet =
                selectedType === 'x_boost_lite' ||
                selectedType === 'x_boost' ||
                selectedType === 'x_bundle';

            const estimatedCompletions = getMaxCompletionsForToken(totalBudget, selectedType, questChain.tokenSymbol, gDollarPrice);

            const chainUi = getQuestChainUi(rewardChain);
            const activeChain = rewardChain === 'celo' ? celo : arbitrum;

            if (!Number.isFinite(totalBudget) || totalBudget < chainUi.budgetMin || totalBudget > chainUi.budgetMax) {
                setDepositError(`Total budget must be between ${chainUi.budgetMin} and ${chainUi.budgetMax} ${chainUi.tokenSymbol}.`);
                setDepositStep('idle');
                return;
            }

            const detailsError = getDetailsValidationError();
            if (detailsError) {
                setDepositError(detailsError);
                setDepositStep('idle');
                return;
            }

            // Step 1: Create task in DB first to get the backend-generated onChainTaskId
            setDepositStep('creating_db');

            const miniappUrlValue = selectedType === 'miniapp' ? (selectedFrame?.frames_url ?? targetUrl?.trim()) : undefined;

            // Build embedded cast data for feed preview
            const castDataPayload = selectedCast ? {
                text: selectedCast.text || '',
                authorUsername: selectedCast.author?.username || '',
                authorPfp: selectedCast.author?.pfp_url || '',
                authorDisplayName: selectedCast.author?.display_name || selectedCast.author?.username || '',
            } : undefined;

            // Build embedded miniapp data for feed preview (API + user edits)
            const miniappDataPayload = (selectedType === 'miniapp' && (selectedFrame || miniappUrlValue)) ? {
                name: miniappEditName,
                description: miniappEditDescription,
                icon: selectedFrame?.icon_url ?? selectedFrame?.icon ?? selectedFrame?.image ?? undefined,
                image: selectedFrame?.image_url ?? selectedFrame?.image ?? undefined,
                button_title: selectedFrame?.button_title || 'Open',
                developer: selectedFrame ? getFrameDeveloper(selectedFrame).name : undefined,
                url: miniappUrlValue || '',
            } : undefined;

            const typeDescriptions: Record<string, string> = {
                follow: `Grow @${selectedUser?.username || 'user'}`,
                boost_lite: 'Boost this cast',
                boost: 'Amplify this cast',
                quote: 'Engage with this cast',
                channel: 'Join the community',
                multi: `Grow @${selectedUser?.username || 'user'} + Engage`,
                miniapp: `Try ${selectedFrame ? getFrameDisplayName(selectedFrame) : 'this app'}`,
                x_follow: `Follow @${selectedXUser?.username || 'user'} on X`,
                x_boost_lite: 'Like + Repost on X',
                x_boost: 'Engage with this post on X',
                x_bundle: `Follow @${selectedXUser?.username || 'user'} + Engage on X`,
            };

            const taskPayload: any = {
                type: selectedType,
                creatorFid: identity.fid ?? user?.fid,
                creatorAddress: txAddress,
                creatorProfile: isBrowser ? {
                    displayName: identity.displayName,
                    username: identity.username,
                    pfpUrl: identity.pfpUrl,
                } : undefined,
                totalBudget,
                expiresInDays,
                chainId: chainUi.chainId,
                rewardToken: chainUi.tokenSymbol,
                targetUsername: selectedUser ? selectedUser.username : undefined,
                targetFid: selectedUser ? selectedUser.fid : undefined,
                targetUrl: targetUrl?.trim() || undefined,
                castHash: selectedCast ? selectedCast.hash : undefined,
                miniappUrl: miniappUrlValue,
                miniappAudience: selectedType === 'miniapp' ? miniappAudience : undefined,
                miniappFeedbackCastHash: selectedType === 'miniapp' && selectedMiniappFeedbackCast ? selectedMiniappFeedbackCast.hash : undefined,
                miniappFeedbackCastData: selectedType === 'miniapp' && selectedMiniappFeedbackCast ? {
                    text: selectedMiniappFeedbackCast.text || '',
                    authorUsername: selectedMiniappFeedbackCast.author?.username || '',
                    authorPfp: selectedMiniappFeedbackCast.author?.pfp_url || '',
                    authorDisplayName: selectedMiniappFeedbackCast.author?.display_name || selectedMiniappFeedbackCast.author?.username || '',
                } : undefined,
                miniappFeedbackMode: selectedType === 'miniapp' && selectedMiniappFeedbackCast ? miniappFeedbackMode : undefined,
                minFollowers: targetingEnabled && minFollowers !== '' && Number(minFollowers) > 0 ? Number(minFollowers) : undefined,
                minNeynarScore: targetingEnabled && minNeynarScore !== '' && Number(minNeynarScore) >= 0 ? Number(minNeynarScore) : undefined,
                minAccountAgeDays: targetingEnabled && minAccountAgeDays !== '' && Number(minAccountAgeDays) > 0 ? Number(minAccountAgeDays) : undefined,
                nonSpamOnly: targetingEnabled && nonSpamOnly ? true : undefined,
                description: typeDescriptions[selectedType] || 'New Quest',
                castData: castDataPayload,
                miniappData: miniappDataPayload,
            };

            // X quest fields
            if (isXTask) {
                if (selectedXUser) {
                    taskPayload.xTargetUsername = selectedXUser.username;
                    taskPayload.xTargetUserId = selectedXUser.userId;
                    taskPayload.xTargetAvatar = selectedXUser.avatar;
                    taskPayload.xTargetFollowers = selectedXUser.followers;
                }
                if (xTweetData) {
                    taskPayload.xTweetId = xTweetData.id;
                    taskPayload.xTweetUrl = xTweetData.url;
                    taskPayload.xTweetData = {
                        text: xTweetData.text,
                        authorUsername: xTweetData.authorUsername,
                        authorName: xTweetData.authorName,
                        authorAvatar: xTweetData.authorAvatar,
                        authorVerified: xTweetData.authorVerified,
                        likeCount: xTweetData.likeCount,
                        retweetCount: xTweetData.retweetCount,
                        replyCount: xTweetData.replyCount,
                        quoteCount: xTweetData.quoteCount,
                        media: xTweetData.media,
                        createdAt: xTweetData.createdAt,
                    };
                }
                if (minXFollowers !== '' && Number(minXFollowers) > 0) {
                    taskPayload.minXFollowers = Number(minXFollowers);
                }
            }

            const createRes = await axios.post('/api/tasks/create', taskPayload);
            if (!createRes.data.success || !createRes.data.onChainTaskId) {
                throw new Error('Failed to create task in database');
            }

            const { taskId: dbTaskId, onChainTaskId } = createRes.data;

            try {
                await switchChain(wagmiConfig, { chainId: chainUi.chainId });
            } catch (switchErr) {
                console.warn('[CreateTask] chain switch', switchErr);
            }

            setDepositStep('batching');
            const amountWei = parseUnits(totalBudget.toString(), chainUi.tokenDecimals);
            const feeWei = parseUnits(chainUi.feeAmount.toString(), chainUi.tokenDecimals);
            const tokenAddress = chainUi.tokenAddress;
            const escrowAddress = chainUi.socialEscrow;
            const tokenAbi = chainUi.tokenAbi;
            const escrowAbi = chainUi.escrowAbi;
            const feeRecipient = chainUi.feeRecipient;

            let txHash: `0x${string}` | undefined;

            try {
                setDepositTxMode('batch');
                const { id } = await txWalletClient.sendCalls({
                    account: txAddress,
                    calls: [
                        {
                            to: tokenAddress,
                            data: encodeFunctionData({
                                abi: tokenAbi,
                                functionName: 'approve',
                                args: [escrowAddress, amountWei],
                            }),
                        },
                        {
                            to: escrowAddress,
                            data: encodeFunctionData({
                                abi: escrowAbi,
                                functionName: 'deposit',
                                args: [tokenAddress, onChainTaskId as `0x${string}`, amountWei],
                            }),
                        },
                        {
                            to: tokenAddress,
                            data: encodeFunctionData({
                                abi: tokenAbi,
                                functionName: 'transfer',
                                args: [feeRecipient, feeWei],
                            }),
                        },
                    ],
                });
                setDepositStep('waiting_tx');
                const result = await txWalletClient.waitForCallsStatus({ id });
                if (result.status === 'success' && result.receipts?.length) {
                    txHash = pickEscrowDepositTxHash(result.receipts, escrowAddress);
                }
            } catch {
                if (!isBrowser || !publicClient) throw new Error('Wallet batch transaction failed');
                setDepositTxMode('sequential');
                setDepositStep('waiting_tx');

                setSequentialTxStep((s) => ({ ...s, approve: 'wallet' }));
                const approveHash = await txWalletClient.writeContract({
                    address: tokenAddress,
                    abi: tokenAbi,
                    functionName: 'approve',
                    args: [escrowAddress, amountWei],
                    account: txAddress,
                    chain: activeChain,
                });
                setSequentialTxStep((s) => ({ ...s, approve: 'confirming' }));
                await publicClient.waitForTransactionReceipt({ hash: approveHash });
                setSequentialTxStep((s) => ({ ...s, approve: 'done', deposit: 'wallet' }));

                const depositHash = await txWalletClient.writeContract({
                    address: escrowAddress,
                    abi: escrowAbi,
                    functionName: 'deposit',
                    args: [tokenAddress, onChainTaskId as `0x${string}`, amountWei],
                    account: txAddress,
                    chain: activeChain,
                });
                setSequentialTxStep((s) => ({ ...s, deposit: 'confirming' }));
                await publicClient.waitForTransactionReceipt({ hash: depositHash });
                txHash = depositHash;
                setSequentialTxStep((s) => ({ ...s, deposit: 'done', fee: 'wallet' }));

                const feeHash = await txWalletClient.writeContract({
                    address: tokenAddress,
                    abi: tokenAbi,
                    functionName: 'transfer',
                    args: [feeRecipient, feeWei],
                    account: txAddress,
                    chain: activeChain,
                });
                setSequentialTxStep((s) => ({ ...s, fee: 'confirming' }));
                await publicClient.waitForTransactionReceipt({ hash: feeHash });
                setSequentialTxStep((s) => ({ ...s, fee: 'done' }));
            }

            if (txHash) {
                setDepositStep('creating_db');

                // Confirm deposit to activate task
                await axios.post('/api/tasks/confirm-deposit', {
                    taskId: dbTaskId,
                    depositTxHash: txHash,
                    creatorAddress: txAddress,
                });

                setDepositStep('done');
                createdTaskBudgetRef.current = totalBudget;
                onQuestCreated?.();
                setShowQuestCreatedModal(true);
                fetchUsdcBalance();

                // Reset after 3 seconds (form reset); modal stays until user dismisses
                setTimeout(() => {
                    setDepositStep('idle');
                    setDepositTxMode(null);
                    setSequentialTxStep(SEQUENTIAL_TX_PENDING);
                    // Reset form
                    setSelectedUser(null);
                    setSelectedCast(null);
                    setSelectedFrame(null);
                    setMiniappEditName('');
                    setMiniappEditDescription('');
                    setMiniappAudience('all_users');
                    setMiniappHasExisting(false);
                    setMiniappFeedbackMode('comment');
                    setMiniappFeedbackCastUrl('');
                    setSelectedMiniappFeedbackCast(null);
                    setTargetingEnabled(false);
                    setMinFollowers('');
                    setMinNeynarScore('');
                    setMinAccountAgeDays('');
                    setNonSpamOnly(false);
                    setTargetUrl('');
                    setTotalBudget(10);
                    // Reset X state
                    setXSearchQuery('');
                    setXSearchResults([]);
                    setSelectedXUser(null);
                    setXTweetUrl('');
                    setXTweetData(null);
                    setXTweetError(null);
                    setMinXFollowers('');
                }, 3000);
            } else {
                throw new Error('Transaction failed');
            }

        } catch (e: any) {
            console.error(e);

            if (e.message?.includes('User rejected')) {
                setDepositError('Transaction cancelled by user');
            } else if (e.message?.includes('insufficient')) {
                setDepositError(`Insufficient ${questChain.tokenSymbol} balance`);
            } else {
                setDepositError(e?.shortMessage || e?.message || 'Error creating task. Please try again.');
            }
            setDepositStep('error');
            setDepositTxMode(null);
        }
    };

    const getSequentialTxSteps = () => [
        {
            key: 'approve' as const,
            title: `1. Approve ${questChain.tokenSymbol}`,
            description: `Allow the escrow contract to use ${questChain.tokenSymbol} from your wallet for this quest.`,
        },
        {
            key: 'deposit' as const,
            title: '2. Deposit reward pool',
            description: `Lock ${isGQuest ? Math.round(totalBudget).toLocaleString() : totalBudget.toFixed(2)} ${questChain.tokenSymbol} in escrow for participants who complete the quest.`,
        },
        {
            key: 'fee' as const,
            title: `3. ${questChain.feeLabel}`,
            description:
                rewardChain === 'celo'
                    ? `Send ${questChain.feeAmount} G$ to the GoodDollar UBI Pool to fund daily basic income.`
                    : `Send ${questChain.feeAmount} USDC platform fee to activate the quest.`,
        },
    ];

    const getSequentialTxStatusLabel = (status: SequentialTxStatus) => {
        switch (status) {
            case 'wallet':
                return 'Confirm in wallet';
            case 'confirming':
                return 'Confirming on-chain…';
            case 'done':
                return 'Complete';
            default:
                return 'Waiting';
        }
    };

    const renderDepositProgress = () => {
        if (depositStep === 'idle' || depositStep === 'error') return null;

        const isSequential = depositTxMode === 'sequential';
        const sequentialSteps = getSequentialTxSteps();
        const completedSequential = sequentialSteps.filter((s) => sequentialTxStep[s.key] === 'done').length;

        return (
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-4 bg-gray-50 border border-gray-200 rounded-2xl p-4 sm:p-5"
            >
                {isSequential && depositStep !== 'done' && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200/80">
                        <p className="text-sm font-bold text-amber-900 flex items-start gap-2">
                            <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 shrink-0 text-amber-600" />
                            Confirm all 3 wallet transactions to launch your quest
                        </p>
                        <p className="text-xs text-amber-800/80 mt-1.5 ml-6">
                            Your wallet will ask you to approve each step separately. The quest will not go live until every transaction is confirmed.
                        </p>
                    </div>
                )}

                {!isSequential && depositStep !== 'done' && depositTxMode === 'batch' && (
                    <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200/80">
                        <p className="text-sm font-bold text-blue-900 flex items-start gap-2">
                            <FontAwesomeIcon icon={faWallet} className="mt-0.5 shrink-0 text-blue-600" />
                            Confirm in your wallet
                        </p>
                        <p className="text-xs text-blue-800/80 mt-1.5 ml-6">
                            Approve, deposit, and platform fee are bundled into one signature when your wallet supports it.
                        </p>
                    </div>
                )}

                {isSequential ? (
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-black text-black">On-chain steps</span>
                            <span className="text-xs font-bold text-gray-500">
                                {completedSequential} / {sequentialSteps.length} done
                            </span>
                        </div>
                        {sequentialSteps.map((step) => {
                            const status = sequentialTxStep[step.key];
                            const isActive = status === 'wallet' || status === 'confirming';
                            const isDone = status === 'done';
                            return (
                                <div
                                    key={step.key}
                                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                                        isActive
                                            ? 'bg-white border-black/15 shadow-sm ring-1 ring-black/5'
                                            : isDone
                                              ? 'bg-emerald-50/60 border-emerald-200/80'
                                              : 'bg-white/50 border-gray-200/80 opacity-70'
                                    }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                            isDone
                                                ? 'bg-emerald-500 text-white'
                                                : isActive
                                                  ? 'bg-black text-white'
                                                  : 'bg-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {isDone ? (
                                            <FontAwesomeIcon icon={faCheck} className="text-sm" />
                                        ) : isActive && status === 'confirming' ? (
                                            <FontAwesomeIcon icon={faSpinner} spin className="text-sm" />
                                        ) : isActive ? (
                                            <FontAwesomeIcon icon={faWallet} className="text-sm" />
                                        ) : (
                                            <span className="text-xs font-black">{step.key === 'approve' ? '1' : step.key === 'deposit' ? '2' : '3'}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-bold text-black">{step.title}</p>
                                            <span
                                                className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                                                    isDone
                                                        ? 'text-emerald-600'
                                                        : isActive
                                                          ? 'text-black'
                                                          : 'text-gray-400'
                                                }`}
                                            >
                                                {getSequentialTxStatusLabel(status)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {depositStep === 'creating_db' && (
                            <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600">
                                <FontAwesomeIcon icon={faSpinner} spin className="text-gray-400" />
                                Activating quest on TaskPay…
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3">
                            {depositStep !== 'done' ? (
                                <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                            ) : (
                                <FontAwesomeIcon icon={faCheck} className="text-green-500 text-lg" />
                            )}
                            <span className="text-sm font-medium text-black">{getDepositStepLabel()}</span>
                        </div>
                        <div className="flex gap-1 mt-3">
                            {['batching', 'waiting_tx', 'creating_db', 'done'].map((s, i) => {
                                const steps = ['batching', 'waiting_tx', 'creating_db', 'done'];
                                const currentIdx = steps.indexOf(depositStep);
                                const isActive = i <= currentIdx;
                                return (
                                    <div
                                        key={s}
                                        className={`flex-1 h-1 rounded-full transition-all ${isActive ? 'bg-black' : 'bg-gray-200'}`}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}

                {depositStep === 'done' && (
                    <div className="flex items-center gap-3 text-emerald-700">
                        <FontAwesomeIcon icon={faCheck} className="text-lg" />
                        <span className="text-sm font-bold">Quest launched successfully!</span>
                    </div>
                )}
            </motion.div>
        );
    };

    const getDepositStepLabel = () => {
        switch (depositStep) {
            case 'creating_db': return 'Creating task...';
            case 'batching': return 'Preparing transaction...';
            case 'waiting_tx': return 'Waiting for transaction confirmation...';
            case 'done': return 'Quest launched!';
            case 'error': return 'Error occurred';
            default: return '';
        }
    };

    const renderTypeSelector = () => (
        <div className="space-y-4 mb-6 min-w-0">
            {/* Platform toggle (hidden if managed externally) */}
            {!externalPlatform && (
                <div className="flex bg-gray-100/60 rounded-[14px] p-1 gap-1 relative shadow-inner backdrop-blur-md border border-gray-200/50">
                    {['farcaster', 'x'].map((tab) => {
                        const isSelected = platform === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => { setInternalPlatform(tab as 'farcaster' | 'x'); setSelectedType(tab === 'farcaster' ? 'follow' : 'x_follow'); }}
                                className={`relative flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-colors z-10 focus:outline-none ${isSelected ? 'text-black' : 'text-gray-500 hover:text-gray-800'}`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="createTaskPlatformTab"
                                        className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/5 z-[-1]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                                {tab === 'farcaster' ? (
                                    <><FarcasterLogo size={16} /> Farcaster</>
                                ) : (
                                    <><XLogo size={14} /> X (Twitter)</>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Farcaster quest types */}
            {platform === 'farcaster' && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { type: 'follow', icon: faUserPlus, label: 'Grow' },
                        { type: 'boost_lite', icon: faRetweet, label: 'Boost' },
                        { type: 'boost', icon: faRocket, label: 'Amplify' },
                        { type: 'quote', icon: faQuoteRight, label: 'Engage' },
                        { type: 'channel', icon: faHashtag, label: 'Community' },
                        { type: 'multi', icon: faLayerGroup, label: 'Bundle' },
                        { type: 'miniapp', icon: faBolt, label: 'Mini App' },
                    ].map((item) => (
                        <button
                            key={item.type}
                            onClick={() => setSelectedType(item.type as TaskType)}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 border ${selectedType === item.type
                                ? 'bg-black border-black text-white shadow-lg transform scale-[1.02]'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:border-gray-300'
                                }`}
                        >
                            <FontAwesomeIcon icon={item.icon} className="text-2xl mb-2" />
                            <span className="text-xs font-bold">{item.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* X quest types */}
            {platform === 'x' && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { type: 'x_follow', icon: faUserPlus, label: 'Grow', desc: 'Follow' },
                        { type: 'x_boost_lite', icon: faRetweet, label: 'Boost Lite', desc: 'Like · Repost' },
                        { type: 'x_boost', icon: faRetweet, label: 'Boost', desc: 'Like · RT · Quote' },
                        { type: 'x_bundle', icon: faLayerGroup, label: 'Bundle', desc: 'Grow + Boost' },
                    ].map((item) => (
                        <button
                            key={item.type}
                            onClick={() => setSelectedType(item.type as TaskType)}
                            className={`flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 border ${selectedType === item.type
                                ? 'bg-black border-black text-white shadow-lg transform scale-[1.02]'
                                : 'bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:border-gray-300'
                                }`}
                        >
                            <FontAwesomeIcon icon={item.icon} className="text-2xl mb-2" />
                            <span className="text-xs font-bold">{item.label}</span>
                            <span className="text-[9px] mt-0.5 opacity-70">{item.desc}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderFollowInput = () => (
        <div className="space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center">
                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                    <FontAwesomeIcon icon={faSeedling} className="text-green-600 shrink-0" />
                    Who to grow
                </h3>
                <button
                    onClick={() => {
                        const fcFid = identity.fid ?? user?.fid;
                        const fcUsername = identity.username ?? user?.username;
                        if (fcUsername != null && fcFid != null) {
                            setSelectedUser({
                                fid: fcFid,
                                username: fcUsername,
                                display_name: identity.displayName ?? (user as any)?.displayName ?? (user as any)?.display_name ?? fcUsername,
                                pfp_url: identity.pfpUrl ?? (user as any)?.pfpUrl ?? (user as any)?.pfp_url ?? '',
                            });
                            setTargetUsername(fcUsername);
                            setSearchResults([]);
                        }
                    }}
                    className="text-xs font-semibold bg-gray-100 text-black px-3 py-1.5 rounded-full border border-gray-200 active:bg-gray-200"
                >
                    Use my profile
                </button>
            </div>

            <div className="relative">
                <input
                    type="text"
                    placeholder="Find a creator..."
                    value={targetUsername}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
                <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
            </div>

            {/* Selected User Card - Large and Clear */}
            {selectedUser && (
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white p-4 rounded-xl flex items-center gap-4 border border-black shadow-sm"
                >
                    <img src={selectedUser.pfpUrl || selectedUser.pfp_url} alt="" className="w-12 h-12 rounded-full border-2 border-gray-200" />
                    <div className="flex-1">
                        <div className="font-bold text-black text-lg">{selectedUser.display_name || selectedUser.displayName}</div>
                        <div className="text-gray-400">@{selectedUser.username}</div>
                    </div>
                    <button onClick={() => setSelectedUser(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-gray-200">
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                </motion.div>
            )}

            {/* Search Results List */}
            {!selectedUser && searchResults.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map(u => (
                        <div
                            key={u.fid}
                            onClick={() => {
                                setSelectedUser(u);
                                setTargetUsername(u.username);
                                setSearchResults([]);
                            }}
                            className="flex items-center gap-3 p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                        >
                            <img src={u.pfp_url} alt="" className="w-10 h-10 rounded-full bg-gray-100" />
                            <div>
                                <div className="text-black font-bold">{u.display_name}</div>
                                <div className="text-gray-500 text-sm">@{u.username}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const renderUrlInput = (label: string, sublabel?: string, titleIcon?: any) => (
        <div className="space-y-4 animate-fadeIn min-w-0">
            <div>
                <h3 className="text-black font-bold text-lg break-words flex items-center gap-2">
                    {titleIcon && <FontAwesomeIcon icon={titleIcon} className="shrink-0" />}
                    {label}
                </h3>
                {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
            </div>

            <div className="space-y-3 min-w-0">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Paste a Farcaster post link…"
                        value={targetUrl}
                        onChange={(e) => onPostUrlChange(e.target.value)}
                        className="w-full min-w-0 max-w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pr-12 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all box-border"
                    />
                    {isVerifyingLink && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-black">
                            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                        </span>
                    )}
                </div>

                {linkVerifyError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                        <FontAwesomeIcon icon={faExclamationCircle} className="shrink-0" />
                        <span>{linkVerifyError}</span>
                    </div>
                )}

                {!selectedCast && (
                    <button
                        type="button"
                        onClick={() => handleFetchMyCasts()}
                        className="btn btn-outline w-full py-3 flex items-center justify-center gap-2"
                    >
                        <FontAwesomeIcon icon={faPenToSquare} className="shrink-0" />
                        Pick from my casts
                    </button>
                )}
            </div>

            {selectedCast && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-4 rounded-xl border border-black shadow-sm min-w-0 max-w-full overflow-hidden"
                >
                    <div className="flex gap-3 mb-2 min-w-0">
                        <img src={selectedCast.author?.pfp_url} alt="" className="w-6 h-6 rounded-full shrink-0" />
                        <span className="text-gray-400 text-xs truncate">@{selectedCast.author?.username}</span>
                    </div>
                    <div className="text-black text-sm line-clamp-3 mb-3 break-words overflow-hidden min-w-0" style={{ wordBreak: 'break-word' }}>{selectedCast.text}</div>
                    <button
                        onClick={() => setSelectedCast(null)}
                        className="w-full py-2 text-sm text-red-400 bg-red-500/10 rounded-lg hover:bg-red-500/20"
                    >
                        Remove
                    </button>
                </motion.div>
            )}
        </div>
    );

    return (
        <div className={dashboard
            ? 'bg-transparent min-h-0 text-black w-full max-w-full min-w-0 overflow-x-hidden box-border'
            : 'bg-white min-h-screen text-black pb-15 w-full max-w-full min-w-0 overflow-x-hidden box-border'}>
            {!dashboard && (
                <div className="p-6 pt-4 max-w-2xl mx-auto box-border" />
            )}

            <div className={`${dashboard ? 'px-0' : 'px-4'} max-w-2xl mx-auto w-full min-w-0 overflow-x-hidden box-border`}>
                {(wizardStep === 'all' || wizardStep === 'type') && renderTypeSelector()}

                {(wizardStep === 'all' || wizardStep === 'details') && (
                <>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedType}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 min-w-0"
                    >
                        {selectedType === 'follow' && renderFollowInput()}
                        {selectedType === 'boost_lite' && renderUrlInput('Cast to boost', 'Users will like & recast this post', faRetweet)}
                        {selectedType === 'boost' && renderUrlInput('Cast to amplify', 'Users will like, quote , recast & comment on this post', faFire)}
                        {selectedType === 'quote' && renderUrlInput('Cast to quote', 'Users will write a quote on this post', faComment)}
                        {selectedType === 'channel' && (
                            <div className="space-y-4">
                                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                                    <FontAwesomeIcon icon={faHouse} className="text-black shrink-0" />
                                    Community to join
                                </h3>
                                <input
                                    type="text"
                                    placeholder="https://farcaster.xyz/~/channel/..."
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-black focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                />
                            </div>
                        )}
                        {selectedType === 'multi' && (
                            <div className="space-y-5">
                                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                                    <FontAwesomeIcon icon={faLayerGroup} className="text-black" />
                                    Full engagement bundle
                                </h3>
                                <p className="text-xs text-gray-400">Users will follow + Amplify in one go</p>
                                {renderFollowInput()}
                                {renderUrlInput('Cast to engage with', 'This post gets liked, recasted & quoted')}
                            </div>
                        )}
                        {selectedType === 'miniapp' && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-black font-bold text-lg flex items-center gap-2">                                <FontAwesomeIcon icon={faBolt} className="text-black" />
                                    Promote Mini App</h3>
                                <p className="text-xs text-gray-400">
                                    {miniappFeedbackMode === 'quote'
                                        ? 'Users will open the app, add it, and quote your cast to verify they participated.'
                                        : 'Users will open the app, add it, and leave feedback in a comment on your cast.'}
                                </p>



                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search apps on Farcaster…"
                                        value={frameSearchQuery}
                                        onChange={(e) => setFrameSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSearchFrames()}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                    />
                                    <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                                    <button
                                        type="button"
                                        onClick={handleSearchFrames}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 py-2 px-3 rounded-lg bg-black text-white text-sm font-semibold hover:opacity-80"
                                    >
                                        Search
                                    </button>
                                </div>

                                {/* Direct URL input — shown when no frame selected from search */}
                                {!selectedFrame && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-px bg-gray-200" />
                                            <span className="text-xs text-gray-400 font-medium">or paste URL directly</span>
                                            <div className="flex-1 h-px bg-gray-200" />
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="https://farcaster.xyz/miniapps/..."
                                                value={targetUrl}
                                                onChange={(e) => {
                                                    setTargetUrl(e.target.value);
                                                    // Auto-populate name from URL if empty
                                                    if (!miniappEditName && e.target.value.trim()) {
                                                        setMiniappEditName('Mini App');
                                                    }
                                                }}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                            />
                                            <FontAwesomeIcon icon={faBolt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                            {targetUrl.trim() && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setTargetUrl(''); setMiniappEditName(''); setMiniappEditDescription(''); }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-gray-200"
                                                >
                                                    <FontAwesomeIcon icon={faTimes} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Show name/description edit fields when URL is directly entered (no frame from search) */}
                                {!selectedFrame && targetUrl.trim() && (
                                    <div className="space-y-3 pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-500">Customize how this app appears in the feed.</p>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                                            <input
                                                type="text"
                                                value={miniappEditName}
                                                onChange={(e) => setMiniappEditName(e.target.value)}
                                                placeholder="Mini app name"
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                                            <textarea
                                                value={miniappEditDescription}
                                                onChange={(e) => setMiniappEditDescription(e.target.value)}
                                                placeholder="Short description for the feed"
                                                rows={2}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black resize-none"
                                            />
                                        </div>

                                        {/* Cast for feedback (comment) — same as when frame is selected */}
                                        <div className="pt-3 border-t border-gray-100 space-y-2">
                                            <label className="block text-xs font-semibold text-gray-700">
                                                <FontAwesomeIcon icon={miniappFeedbackMode === 'quote' ? faQuoteRight : faComment} className="mr-1.5 text-amber-500" />
                                                {miniappFeedbackMode === 'quote' ? 'Cast for feedback (quote)' : 'Cast for feedback (comment)'}
                                            </label>
                                            <p className="text-[11px] text-gray-500">
                                                {miniappFeedbackMode === 'quote'
                                                    ? 'Participants must quote this post so we can verify engagement after they try the app.'
                                                    : 'Users will comment their feedback on this post after trying the app.'}
                                            </p>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="Paste post link…"
                                                    value={miniappFeedbackCastUrl}
                                                    onChange={(e) => { setMiniappFeedbackCastUrl(e.target.value); setSelectedMiniappFeedbackCast(null); setMiniappFeedbackLinkError(null); }}
                                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => verifyMiniappFeedbackLink(miniappFeedbackCastUrl)}
                                                    disabled={!miniappFeedbackCastUrl.trim() || isVerifyingMiniappFeedbackLink}
                                                    className="px-3 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isVerifyingMiniappFeedbackLink ? (
                                                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                                    ) : (
                                                        'Verify'
                                                    )}
                                                </button>
                                            </div>
                                            {miniappFeedbackLinkError && <p className="text-xs text-red-500">{miniappFeedbackLinkError}</p>}
                                            <button
                                                type="button"
                                                onClick={() => handleFetchMyCasts('miniappFeedback')}
                                                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                                            >
                                                <FontAwesomeIcon icon={faPenToSquare} />
                                                Pick from my casts
                                            </button>
                                            {selectedMiniappFeedbackCast && (
                                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs text-gray-500 truncate">@{selectedMiniappFeedbackCast.author?.username}</p>
                                                        <p className="text-sm text-black line-clamp-2 truncate">{selectedMiniappFeedbackCast.text}</p>
                                                    </div>
                                                    <button type="button" onClick={() => { setSelectedMiniappFeedbackCast(null); setMiniappFeedbackCastUrl(''); setMiniappFeedbackLinkError(null); }} className="shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200">
                                                        <FontAwesomeIcon icon={faTimes} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* comment and quote button */}
                                        {/* <div className="flex gap-2 mt-1">
                                    <button
                                        type="button"
                                        onClick={() => setMiniappFeedbackMode('comment')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${miniappFeedbackMode === 'comment' ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        <FontAwesomeIcon icon={faComment} className="shrink-0" />
                                        Comment
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setMiniappFeedbackMode('quote')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${miniappFeedbackMode === 'quote' ? 'bg-black text-white border-black' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                    >
                                        <FontAwesomeIcon icon={faQuoteRight} className="shrink-0" />
                                        Quote
                                    </button>
                                </div> */}


                                    </div>
                                )}

                                {selectedFrame && (
                                    <>
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="bg-white p-4 rounded-xl flex items-center gap-4 border border-black shadow-sm"
                                        >
                                            {(selectedFrame.icon_url ?? selectedFrame.icon ?? selectedFrame.image) && (
                                                <img src={selectedFrame.icon_url ?? selectedFrame.icon ?? selectedFrame.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-gray-100 shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-black truncate">{getFrameDisplayName(selectedFrame)}</div>
                                                {(() => {
                                                    const dev = getFrameDeveloper(selectedFrame);
                                                    return (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {dev.pfp && <img src={dev.pfp} alt="" className="w-5 h-5 rounded-full object-cover bg-gray-100 shrink-0" />}
                                                            <span className="text-gray-400 text-xs truncate">{dev.name}</span>
                                                        </div>
                                                    );
                                                })()}
                                                <div className="text-gray-500 text-xs truncate mt-0.5">{selectedFrame.frames_url}</div>
                                            </div>
                                            <button onClick={() => { setSelectedFrame(null); setMiniappEditName(''); setMiniappEditDescription(''); setMiniappHasExisting(false); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-gray-200 shrink-0">
                                                <FontAwesomeIcon icon={faTimes} />
                                            </button>
                                        </motion.div>
                                        <div className="space-y-3 pt-2 border-t border-gray-100">
                                            <p className="text-xs text-gray-500">You can edit this info — it will be shown in the feed.</p>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    value={miniappEditName}
                                                    onChange={(e) => setMiniappEditName(e.target.value)}
                                                    placeholder="Mini app name"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Description</label>
                                                <textarea
                                                    value={miniappEditDescription}
                                                    onChange={(e) => setMiniappEditDescription(e.target.value)}
                                                    placeholder="Short description for the feed"
                                                    rows={2}
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black resize-none"
                                                />
                                            </div>
                                            {miniappHasExisting && (
                                                <div className="pt-2">
                                                    <label className="block text-xs font-semibold text-gray-700 mb-2">Who can do this quest?</label>
                                                    <div className="flex gap-4">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="miniappAudience"
                                                                checked={miniappAudience === 'all_users'}
                                                                onChange={() => setMiniappAudience('all_users')}
                                                                className="rounded-full border-gray-300 text-black focus:ring-black"
                                                            />
                                                            <span className="text-sm text-gray-700">All users</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="radio"
                                                                name="miniappAudience"
                                                                checked={miniappAudience === 'new_users_only'}
                                                                onChange={() => setMiniappAudience('new_users_only')}
                                                                className="rounded-full border-gray-300 text-black focus:ring-black"
                                                            />
                                                            <span className="text-sm text-gray-700">Only new users (haven&apos;t done this app&apos;s quest before)</span>
                                                        </label>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Cast for feedback (comment) */}
                                            <div className="pt-3 border-t border-gray-100 space-y-2">
                                                <label className="block text-xs font-semibold text-gray-700">
                                                    <FontAwesomeIcon icon={miniappFeedbackMode === 'quote' ? faQuoteRight : faComment} className="mr-1.5 text-amber-500" />
                                                    {miniappFeedbackMode === 'quote' ? 'Cast for feedback (quote)' : 'Cast for feedback (comment)'}
                                                </label>
                                                <p className="text-[11px] text-gray-500">
                                                    {miniappFeedbackMode === 'quote'
                                                        ? 'Participants must quote this post so we can verify engagement after they try the app.'
                                                        : 'Users will comment their feedback on this post after trying the app.'}
                                                </p>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Paste post link…"
                                                        value={miniappFeedbackCastUrl}
                                                        onChange={(e) => { setMiniappFeedbackCastUrl(e.target.value); setSelectedMiniappFeedbackCast(null); setMiniappFeedbackLinkError(null); }}
                                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => verifyMiniappFeedbackLink(miniappFeedbackCastUrl)}
                                                        disabled={!miniappFeedbackCastUrl.trim() || isVerifyingMiniappFeedbackLink}
                                                        className="px-3 py-2.5 rounded-xl bg-black text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {isVerifyingMiniappFeedbackLink ? (
                                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                                        ) : (
                                                            'Verify'
                                                        )}
                                                    </button>
                                                </div>
                                                {miniappFeedbackLinkError && <p className="text-xs text-red-500">{miniappFeedbackLinkError}</p>}
                                                <button
                                                    type="button"
                                                    onClick={() => handleFetchMyCasts('miniappFeedback')}
                                                    className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-50 flex items-center justify-center gap-2"
                                                >
                                                    <FontAwesomeIcon icon={faPenToSquare} />
                                                    Pick from my casts
                                                </button>
                                                {selectedMiniappFeedbackCast && (
                                                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs text-gray-500 truncate">@{selectedMiniappFeedbackCast.author?.username}</p>
                                                            <p className="text-sm text-black line-clamp-2 truncate">{selectedMiniappFeedbackCast.text}</p>
                                                        </div>
                                                        <button type="button" onClick={() => { setSelectedMiniappFeedbackCast(null); setMiniappFeedbackCastUrl(''); setMiniappFeedbackLinkError(null); }} className="shrink-0 w-8 h-8 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200">
                                                            <FontAwesomeIcon icon={faTimes} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                                {isSearchingFrames && (
                                    <div className="flex justify-center p-4">
                                        <div className="animate-spin h-6 w-6 border-2 border-black border-t-transparent rounded-full" />
                                    </div>
                                )}
                                {!selectedFrame && frameResults.length > 0 && (() => {
                                    const seen = new Set<string>();
                                    const unique = frameResults.filter((f: any) => {
                                        const url = f?.frames_url?.trim();
                                        if (!url || seen.has(url)) return false;
                                        seen.add(url);
                                        return true;
                                    });
                                    return (
                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg max-h-60 overflow-y-auto">
                                            {unique.map((frame: any, i: number) => {
                                                const dev = getFrameDeveloper(frame);
                                                return (
                                                    <div
                                                        key={frame.frames_url ?? i}
                                                        onClick={() => {
                                                            setSelectedFrame(frame);
                                                            setTargetUrl(frame.frames_url ?? '');
                                                            setFrameResults([]);
                                                            setFrameSearchQuery('');
                                                            setMiniappEditName(getFrameDisplayName(frame));
                                                            setMiniappEditDescription(frame.description ?? '');
                                                        }}
                                                        className="flex items-center gap-3 p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                                    >
                                                        {(frame.icon_url ?? frame.icon ?? frame.image) && <img src={frame.icon_url ?? frame.icon ?? frame.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-black font-bold truncate">{getFrameDisplayName(frame)}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                {dev.pfp && <img src={dev.pfp} alt="" className="w-4 h-4 rounded-full object-cover bg-gray-100 shrink-0" />}
                                                                <span className="text-gray-400 text-xs truncate">{dev.name}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        {/* ─── X (Twitter) Quest Inputs ─── */}
                        {(selectedType === 'x_follow' || selectedType === 'x_bundle') && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                                    <XLogo size={18} />
                                    X account to follow
                                </h3>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            placeholder="Search X username..."
                                            value={xSearchQuery}
                                            onChange={(e) => setXSearchQuery(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleSearchXUsers(); }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 pl-12 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                        />
                                        <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSearchXUsers}
                                        disabled={isSearchingX || !xSearchQuery.trim()}
                                        className="px-4 py-3 rounded-xl bg-black text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                    >
                                        {isSearchingX ? (
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                        ) : (
                                            <FontAwesomeIcon icon={faSearch} />
                                        )}
                                        Search
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                                    <FontAwesomeIcon icon={faInfoCircle} className="text-gray-300" />
                                    Press Search to find X users. Results use the X API (costs are managed).
                                </p>

                                {/* Selected X User */}
                                {selectedXUser && (
                                    <motion.div
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="bg-white p-4 rounded-xl flex items-center gap-4 border border-black shadow-sm"
                                    >
                                        <img src={selectedXUser.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-gray-200 object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-black truncate flex items-center gap-1.5">
                                                {selectedXUser.name}
                                                {selectedXUser.verified && (
                                                    <XLogo size={16} fill="#1D9BF0" />
                                                )}
                                            </div>
                                            <div className="text-gray-400 text-sm">@{selectedXUser.username}</div>
                                            <div className="text-gray-400 text-xs mt-0.5">{selectedXUser.followers?.toLocaleString()} followers</div>
                                        </div>
                                        <button onClick={() => { setSelectedXUser(null); setXSearchQuery(''); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-gray-200">
                                            <FontAwesomeIcon icon={faTimes} />
                                        </button>
                                    </motion.div>
                                )}

                                {/* X Search Results */}
                                {!selectedXUser && xSearchResults.length > 0 && (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-lg max-h-60 overflow-y-auto">
                                        {xSearchResults.map((u: any) => (
                                            <div
                                                key={u.userId || u.username}
                                                onClick={() => {
                                                    setSelectedXUser(u);
                                                    setXSearchQuery(u.username);
                                                    setXSearchResults([]);
                                                }}
                                                className="flex items-center gap-3 p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-0 transition-colors"
                                            >
                                                <img src={u.avatar} alt="" className="w-10 h-10 rounded-full bg-gray-100 object-cover" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-black font-bold truncate flex items-center gap-1">
                                                        {u.name}
                                                        {u.verified && (
                                                            <XLogo size={14} fill="#1D9BF0" />
                                                        )}
                                                    </div>
                                                    <div className="text-gray-500 text-sm">@{u.username}</div>
                                                </div>
                                                <span className="text-xs text-gray-400 shrink-0">{u.followers?.toLocaleString()} followers</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {isSearchingX && (
                                    <div className="flex justify-center p-4">
                                        <div className="animate-spin h-6 w-6 border-2 border-black border-t-transparent rounded-full" />
                                    </div>
                                )}
                            </div>
                        )}

                        {(selectedType === 'x_boost_lite' || selectedType === 'x_boost' || selectedType === 'x_bundle') && (
                            <div className="space-y-4 animate-fadeIn">
                                <h3 className="text-black font-bold text-lg flex items-center gap-2">
                                    <FontAwesomeIcon icon={faRetweet} className="text-black" />
                                    Post to engage with
                                </h3>
                                <p className="text-xs text-gray-400">
                                    {selectedType === 'x_boost_lite'
                                        ? 'Users will like and repost this post'
                                        : 'Users will like, retweet, quote, and comment on this post'}
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Paste X/Twitter post URL..."
                                        value={xTweetUrl}
                                        onChange={(e) => { setXTweetUrl(e.target.value); setXTweetError(null); }}
                                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-black placeholder-gray-400 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleFetchTweet(xTweetUrl)}
                                        disabled={isFetchingTweet || !xTweetUrl.trim()}
                                        className="px-4 py-3 rounded-xl bg-black text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isFetchingTweet ? (
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                                        ) : 'Fetch'}
                                    </button>
                                </div>
                                {xTweetError && <p className="text-xs text-red-500">{xTweetError}</p>}

                                {/* Tweet Preview Card */}
                                {xTweetData && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
                                    >
                                        <div className="p-4">
                                            <div className="flex items-start gap-3 mb-3">
                                                <img src={xTweetData.authorAvatar} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold text-black text-sm truncate">{xTweetData.authorName}</span>
                                                        {xTweetData.authorVerified && (
                                                            <XLogo size={16} fill="#1D9BF0" />
                                                        )}
                                                    </div>
                                                    <span className="text-gray-400 text-xs">@{xTweetData.authorUsername}</span>
                                                </div>
                                                <button onClick={() => { setXTweetData(null); setXTweetUrl(''); }} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-red-400 hover:bg-gray-200 shrink-0">
                                                    <FontAwesomeIcon icon={faTimes} className="text-xs" />
                                                </button>
                                            </div>
                                            <p className="text-sm text-black leading-relaxed mb-3 whitespace-pre-wrap">{xTweetData.text}</p>
                                            {xTweetData.media && xTweetData.media.length > 0 && (
                                                <div className="rounded-xl overflow-hidden border border-gray-100 mb-3">
                                                    <img src={xTweetData.media[0].url} alt="" className="w-full h-40 object-cover" />
                                                </div>
                                            )}
                                            <div className="flex items-center gap-5 text-xs text-gray-400">
                                                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faComment} /> {xTweetData.replyCount?.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faRetweet} /> {xTweetData.retweetCount?.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faHeart} /> {xTweetData.likeCount?.toLocaleString()}</span>
                                                <span className="flex items-center gap-1"><FontAwesomeIcon icon={faQuoteRight} /> {xTweetData.quoteCount?.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        {/* X Min Followers Targeting */}
                        {platform === 'x' && (
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faUsers} className="text-gray-400 text-xs" />
                                    Minimum X followers (optional)
                                </h4>
                                <div className="flex gap-2">
                                    {[
                                        { value: '' as const, label: 'None' },
                                        { value: 100, label: '100+' },
                                        { value: 500, label: '500+' },
                                        { value: 1000, label: '1K+' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.label}
                                            type="button"
                                            onClick={() => setMinXFollowers(opt.value)}
                                            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${minXFollowers === opt.value
                                                ? 'bg-black text-white'
                                                : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-gray-400">Only users with this many X followers can participate.</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Targeting (Optional) — Farcaster only */}
                {platform === 'farcaster' && (
                <div className="bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-4 min-w-0 max-w-full overflow-hidden">
                    <div className="flex items-center gap-3 sm:gap-4">

                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
                                <FontAwesomeIcon icon={faBullseye} className="text-slate-600 text-sm" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-black font-bold text-base sm:text-lg break-words">Targeting <span className="text-slate-400 font-medium text-sm">(Optional)</span></h3>
                                <p className="text-xs text-slate-500 truncate">Set eligibility criteria for participants</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setTargetingEnabled((prev) => !prev)}
                            aria-label={targetingEnabled ? 'Targeting on' : 'Targeting off'}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${targetingEnabled ? 'bg-black text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                        >
                            <div className={`w-8 h-4 rounded-full relative transition-colors ${targetingEnabled ? 'bg-white/30' : 'bg-slate-400'}`}>
                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${targetingEnabled ? 'left-4' : 'left-0.5'}`} />
                            </div>
                        </button>
                    </div>

                    {!targetingEnabled && (
                        <p className="text-sm text-slate-500 flex items-center gap-2 py-1 pl-1">
                            <FontAwesomeIcon icon={faUsers} className="text-green-500 shrink-0" />
                            <span>All users can join — no restriction.</span>
                        </p>
                    )}

                    <AnimatePresence>
                        {targetingEnabled && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeInOut' }}
                                className="overflow-hidden"
                            >
                                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200/80">
                                    <div className="space-y-1.5 min-w-0">
                                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                            <FontAwesomeIcon icon={faUsers} className="text-slate-400 text-[10px] shrink-0" />
                                            Minimum followers
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            placeholder="e.g. 100"
                                            value={minFollowers === '' ? '' : minFollowers}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                if (v === '') setMinFollowers('');
                                                else {
                                                    const n = parseInt(v, 10);
                                                    if (!Number.isNaN(n) && n >= 0) setMinFollowers(n);
                                                }
                                            }}
                                            className="w-full min-w-0 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-black placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent box-border"
                                        />
                                    </div>
                                    <div className="space-y-1.5 min-w-0">
                                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                            <FontAwesomeIcon icon={faStar} className="text-slate-400 text-[10px] shrink-0" />
                                            Minimum Neynar score
                                        </label>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={1}
                                                    step={0.01}
                                                    placeholder="0–1"
                                                    value={minNeynarScore === '' ? '' : minNeynarScore}
                                                    onChange={(e) => {
                                                        const v = e.target.value;
                                                        if (v === '') setMinNeynarScore('');
                                                        else {
                                                            const n = parseFloat(v);
                                                            if (!Number.isNaN(n)) setMinNeynarScore(Math.min(1, Math.max(0, n)));
                                                        }
                                                    }}
                                                    className="w-16 sm:w-20 bg-white border border-slate-200 rounded-lg px-2 py-2 text-sm text-black text-right focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                                                />
                                                <span className="text-xs text-slate-400">0 – 1</span>
                                            </div>
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={minNeynarScore === '' ? 0 : Math.min(1, Math.max(0, Number(minNeynarScore)))}
                                                onChange={(e) => setMinNeynarScore(parseFloat(e.target.value))}
                                                className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-black min-w-0"
                                            />
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[11px] text-slate-500">Recommended: 0.5</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setMinNeynarScore(0.5)}
                                                    className="text-[11px] font-semibold text-slate-600 hover:text-black underline underline-offset-1"
                                                >
                                                    Use 0.5
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4">
                                    <div className="min-w-0 w-full">
                                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-2">
                                            <FontAwesomeIcon icon={faCalendarDays} className="text-slate-400 text-[10px] shrink-0" />
                                            Minimum account age
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: '' as const, label: 'None' },
                                                { value: 10, label: '10 days' },
                                                { value: 30, label: '30 days' },
                                                { value: 60, label: '60 days' },
                                            ].map((opt) => (
                                                <button
                                                    key={opt.label}
                                                    type="button"
                                                    onClick={() => setMinAccountAgeDays(opt.value)}
                                                    className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all shrink-0 ${minAccountAgeDays === opt.value
                                                        ? 'bg-black text-white'
                                                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {/* Non-spam only toggle */}
                                <div className="pt-4 border-t border-slate-200/80">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                                                <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-600 text-sm" />
                                            </div>
                                            <div className="min-w-0">
                                                <span className="text-sm font-semibold text-slate-700 block">Non-spam only</span>
                                                <span className="text-[11px] text-slate-400 block">Block spam accounts from joining</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setNonSpamOnly((prev) => !prev)}
                                            aria-label={nonSpamOnly ? 'Non-spam filter on' : 'Non-spam filter off'}
                                            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${nonSpamOnly ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                                        >
                                            <div className={`w-8 h-4 rounded-full relative transition-colors ${nonSpamOnly ? 'bg-white/30' : 'bg-slate-400'}`}>
                                                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all duration-200 ${nonSpamOnly ? 'left-4' : 'left-0.5'}`} />
                                            </div>
                                        </button>
                                    </div>
                                    {nonSpamOnly && (
                                        <p className="text-[11px] text-emerald-600 flex items-center gap-1.5 mt-2 pl-[42px]">
                                            <FontAwesomeIcon icon={faCheck} className="text-emerald-500 text-[10px]" />
                                            Only real users (spam score ≥ 2) can participate
                                        </p>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-4">
                                    <FontAwesomeIcon icon={faInfoCircle} className="text-slate-400 mt-0.5 shrink-0" />
                                    <span>Eligibility is checked via Neynar when participants verify. Leave blank for no restriction.</span>
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                )}
                </>

                )}

                {(wizardStep === 'all' || wizardStep === 'budget') && (
                <>
                <div className="h-3 sm:h-4" />

                {/* Settings Card — Reward pool & duration */}
                <div className="bg-gray-50 border border-gray-200 p-4 sm:p-6 rounded-2xl sm:rounded-3xl space-y-6 min-w-0 max-w-full overflow-hidden">
                    <h3 className="text-black font-bold text-lg flex items-center gap-2 break-words">
                        <FontAwesomeIcon icon={faCoins} className="text-amber-500 shrink-0" />
                        Reward pool
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setRewardChain('celo')}
                            className={`py-3 text-sm font-bold rounded-xl transition-all ${rewardChain === 'celo'
                                ? 'bg-emerald-700 text-white shadow-lg'
                                : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'}`}
                        >
                            G$ · Celo
                        </button>
                        <button
                            type="button"
                            onClick={() => setRewardChain('arbitrum')}
                            className={`py-3 text-sm font-bold rounded-xl transition-all ${rewardChain === 'arbitrum'
                                ? 'bg-black text-white shadow-lg'
                                : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'}`}
                        >
                            USDC · Arbitrum
                        </button>
                    </div>

                    {/* Total Budget — slider + input */}
                    <div className="min-w-0 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <label className="text-gray-500 text-sm font-medium">Amount ({questChain.tokenSymbol})</label>
                            <div className="flex items-center gap-2 shrink-0 bg-white border border-gray-200 rounded-xl px-3 py-2 min-w-[7rem] justify-end">
                                <input
                                    type="number"
                                    min={questChain.budgetMin}
                                    max={questChain.budgetMax}
                                    step={rewardChain === 'celo' ? 100 : 0.1}
                                    inputMode="decimal"
                                    value={Number.isFinite(totalBudget) ? totalBudget : questChain.budgetMin}
                                    onChange={(e) => {
                                        const n = parseFloat(e.target.value);
                                        if (!Number.isFinite(n)) return;
                                        const step = rewardChain === 'celo' ? 1 : 0.1;
                                        const clamped = Math.min(
                                            questChain.budgetMax,
                                            Math.max(questChain.budgetMin, rewardChain === 'celo' ? Math.round(n) : Math.round(n * 10) / 10),
                                        );
                                        setTotalBudget(clamped);
                                    }}
                                    className="w-20 text-right text-black font-bold focus:outline-none bg-transparent"
                                />
                                <span className="text-gray-500 text-sm font-medium">{questChain.tokenSymbol}</span>
                            </div>
                        </div>
                        <input
                            type="range"
                            min={questChain.budgetMin}
                            max={questChain.budgetMax}
                            step={rewardChain === 'celo' ? 500 : 0.5}
                            value={Math.min(questChain.budgetMax, Number.isFinite(totalBudget) ? totalBudget : questChain.budgetMin)}
                            onChange={(e) => setTotalBudget(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black"
                        />
                        <p className="text-[11px] text-gray-400">
                            Min {questChain.budgetMin} — max {questChain.budgetMax} {questChain.tokenSymbol} per Quest
                        </p>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="text-gray-500 text-sm font-medium mb-3 flex items-center gap-2">
                            <FontAwesomeIcon icon={faClock} className="text-gray-400" />
                            Duration
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {[{ days: 1, label: '24 hours' }, { days: 3, label: '72 hours' }].map(opt => (
                                <button
                                    key={opt.days}
                                    onClick={() => setExpiresInDays(opt.days)}
                                    className={`py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${expiresInDays === opt.days
                                        ? 'bg-black text-white shadow-lg'
                                        : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <FontAwesomeIcon icon={faClock} className={expiresInDays === opt.days ? 'text-white' : 'text-gray-400'} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Estimated reach */}
                    <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 flex justify-between items-center gap-3 min-w-0">
                        <span className="text-gray-500 text-sm shrink-0 flex items-center gap-2">
                            <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                            Estimated reach
                        </span>
                        <span className="text-black font-bold text-lg shrink-0 flex items-center gap-1.5">
                            {getMaxCompletionsForToken(totalBudget, selectedType, questChain.tokenSymbol, gDollarPrice)}
                        </span>
                    </div>

                    {/* Fee breakdown */}
                    <div className="bg-gray-100 p-4 rounded-xl border border-gray-200 space-y-2 min-w-0">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm">Reward pool</span>
                            <span className="text-black font-semibold text-sm">
                                {isGQuest ? Math.round(totalBudget).toLocaleString() : totalBudget.toFixed(2)} {questChain.tokenSymbol}
                                {isGQuest && <span className="text-gray-400 text-xs ml-1">(~${gDollarToUSD(totalBudget, gDollarPrice).toFixed(2)})</span>}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-500 text-sm">{questChain.feeLabel}</span>
                            <span className="text-black font-semibold text-sm">
                                {isGQuest ? Math.round(questChain.feeAmount).toLocaleString() : questChain.feeAmount.toFixed(2)} {questChain.tokenSymbol}
                                {isGQuest && <span className="text-gray-400 text-xs ml-1">(~${gDollarToUSD(questChain.feeAmount, gDollarPrice).toFixed(2)})</span>}
                            </span>
                        </div>
                        <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                            <span className="text-black font-bold text-sm">Total</span>
                            <span className="text-black font-bold text-sm">
                                {(totalBudget + questChain.feeAmount).toFixed(rewardChain === 'celo' ? 0 : 2)} {questChain.tokenSymbol}
                                {isGQuest && <span className="text-gray-400 text-xs ml-1">(~${gDollarToUSD(totalBudget + questChain.feeAmount, gDollarPrice).toFixed(2)})</span>}
                            </span>
                        </div>
                        {isGQuest && (
                            <div className="flex justify-between items-center pt-1">
                                <span className="text-gray-400 text-xs">Per user reward</span>
                                <span className="text-green-600 font-semibold text-xs">
                                    ~{formatTokenAmount(getPerUserReward(selectedType, 'G$', gDollarPrice), 'G$')} G$ (~${getPerUserRewardUSDC(selectedType).toFixed(3)})
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-4" />

                {/* Deposit Progress */}
                <AnimatePresence>{renderDepositProgress()}</AnimatePresence>

                {/* Error Message */}
                <AnimatePresence>
                    {depositError && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3"
                            onClick={() => {
                                setDepositError(null);
                                setDepositStep('idle');
                                setDepositTxMode(null);
                                setSequentialTxStep(SEQUENTIAL_TX_PENDING);
                            }}
                        >
                            <FontAwesomeIcon icon={faExclamationCircle} className="text-red-400 mt-0.5" />
                            <div>
                                <p className="text-red-400 text-sm font-medium">{depositError}</p>
                                <p className="text-red-400/60 text-xs mt-1">Tap to dismiss</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Balance check + swap or launch */}
                {(() => {
                    const totalCost = totalBudget + questChain.feeAmount;
                    const hasEnough = usdcBalance !== null && usdcBalance >= totalCost;
                    const isProcessing = depositStep !== 'idle' && depositStep !== 'error' && depositStep !== 'done';

                    return (
                        <div className="space-y-3">
                            {/* Balance indicator */}
                            {effectiveAddress && (
                                <div className="flex items-center justify-between px-1">
                                    <span className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                                        <FontAwesomeIcon icon={faWallet} className="text-gray-300" />
                                        Your {questChain.chainName} {questChain.tokenSymbol} balance
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-bold ${usdcBalance === null ? 'text-gray-300' : hasEnough ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {isCheckingBalance ? (
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                            ) : usdcBalance === null ? '—' : `${usdcBalance.toFixed(rewardChain === 'celo' ? 0 : 2)} ${questChain.tokenSymbol}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => fetchUsdcBalance()}
                                            disabled={isCheckingBalance}
                                            title="Refresh balance"
                                            aria-label={`Refresh ${questChain.tokenSymbol} balance`}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <FontAwesomeIcon
                                                icon={faArrowsRotate}
                                                className={`text-xs ${isCheckingBalance ? 'animate-spin' : ''}`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Not enough balance: swap banner + swap button */}
                            {effectiveAddress && usdcBalance !== null && !hasEnough && !isProcessing && rewardChain === 'arbitrum' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                    <FontAwesomeIcon icon={faExclamationCircle} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-amber-800 text-sm font-bold">Not enough USDC on Arbitrum</p>
                                        <p className="text-amber-600/80 text-xs mt-0.5">
                                            You need <span className="font-bold">{totalCost.toFixed(2)} USDC</span> (incl. {questChain.feeAmount} fee) but have <span className="font-bold">{usdcBalance.toFixed(2)} USDC</span>. Swap now to continue.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Swap button (shown when not enough) */}
                            {effectiveAddress && usdcBalance !== null && !hasEnough && !isProcessing && rewardChain === 'arbitrum' && (
                                <button
                                    onClick={async () => {
                                        const needed = Math.max(
                                            totalCost - (usdcBalance ?? 0),
                                            totalCost,
                                        );

                                        if (isBrowser) {
                                            appActions.swapToken?.({ buyAmount: needed });
                                            return;
                                        }

                                        if (!actions?.swapToken) return;
                                        setIsSwapping(true);
                                        try {
                                            await (actions as any).swapToken({
                                                buyToken: ARB_USDC_CAIP19,
                                                buyAmount: needed,
                                            });
                                            await fetchUsdcBalance();
                                        } catch (e) {
                                            console.error('Swap failed', e);
                                        } finally {
                                            setIsSwapping(false);
                                        }
                                    }}
                                    disabled={!isBrowser && isSwapping}
                                    className="w-full bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-white font-black text-lg py-5 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                                >
                                    {!isBrowser && isSwapping ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Swapping…
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon={faRightLeft} />
                                            {isBrowser
                                                ? `Swap on Uniswap — ${totalCost.toFixed(2)} ${questChain.tokenSymbol} needed`
                                                : `Swap ${questChain.tokenSymbol} — ${totalCost.toFixed(2)} needed`}
                                        </>
                                    )}
                                </button>
                            )}

                            {effectiveAddress && usdcBalance !== null && !hasEnough && !isProcessing && rewardChain === 'celo' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                                    <FontAwesomeIcon icon={faExclamationCircle} className="text-amber-500 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-amber-800 text-sm font-bold">Not enough G$ on Celo</p>
                                        <p className="text-amber-600/80 text-xs mt-0.5">
                                            You need <span className="font-bold">{totalCost.toFixed(0)} G$</span> (incl. {questChain.feeAmount} UBI contribution) but have <span className="font-bold">{usdcBalance.toFixed(0)} G$</span>. Get G$ on Celo to continue.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Launch button (shown when balance sufficient or unknown) */}
                            {(!effectiveAddress || usdcBalance === null || hasEnough) && (
                                <button
                                    onClick={handleCreateTask}
                                    disabled={isProcessing || isCheckingBalance}
                                    className="w-full bg-black text-white font-black text-lg py-5 rounded-2xl shadow-xl transform hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                >
                                    {isProcessing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon={faRocket} />
                                            Launch — {totalCost.toFixed(rewardChain === 'celo' ? 0 : 2)} {questChain.tokenSymbol}
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })()}
                </>
                )}
            </div>

            {/* My Posts selection modal */}
            <AnimatePresence>
                {showMyPostsModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => { setShowMyPostsModal(false); setSelectingCastFor(null); }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
                            >
                                <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                                    <h3 className="text-lg font-bold text-black flex items-center gap-2">
                                        <FontAwesomeIcon icon={selectingCastFor === 'miniappFeedback' ? (miniappFeedbackMode === 'quote' ? faQuoteRight : faComment) : faRocket} className="text-black" />
                                        {selectingCastFor === 'miniappFeedback' ? 'Select post for feedback' : 'Select a post'}
                                    </h3>
                                    <button
                                        onClick={() => { setShowMyPostsModal(false); setSelectingCastFor(null); }}
                                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-black hover:bg-gray-200 transition-colors"
                                    >
                                        <FontAwesomeIcon icon={faTimes} />
                                    </button>
                                </div>
                                <div className="max-h-[70vh] overflow-y-auto p-3">
                                    {isFetchingCasts ? (
                                        <div className="flex flex-col items-center justify-center py-16">
                                            <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
                                            <span className="text-gray-400 text-sm">Loading your posts…</span>
                                        </div>
                                    ) : userCasts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                                            <FontAwesomeIcon icon={faRocket} className="text-4xl text-gray-600 mb-3" />
                                            <p className="text-gray-400 text-sm">No posts found. Try again later.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {userCasts.map((cast) => (
                                                <motion.button
                                                    key={cast.hash}
                                                    type="button"
                                                    onClick={() => handleSelectCast(cast)}
                                                    whileTap={{ scale: 0.98 }}
                                                    className="w-full text-left p-4 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-black transition-all group"
                                                >
                                                    <div className="flex gap-3">
                                                        <img
                                                            src={cast.author?.pfp_url}
                                                            alt=""
                                                            className="w-10 h-10 rounded-full shrink-0 bg-gray-100 object-cover"
                                                        />
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-gray-400 text-xs mb-1">@{cast.author?.username}</div>
                                                            <div className="text-black text-sm leading-snug line-clamp-3 group-hover:text-gray-600 transition-colors">{cast.text}</div>
                                                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                                <span>{new Date(cast.timestamp).toLocaleDateString()}</span>
                                                                <span className="flex items-center gap-1">
                                                                    <FontAwesomeIcon icon={faHeart} className="text-pink-400" /> {cast.reactions?.likes_count ?? 0}
                                                                </span>
                                                                <span className="flex items-center gap-1">
                                                                    <FontAwesomeIcon icon={faRetweet} className="text-green-400" /> {cast.reactions?.recasts_count ?? 0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Quest created success modal */}
            <AnimatePresence>
                {showQuestCreatedModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setShowQuestCreatedModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            <div className="p-6 text-center">
                                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                                    <FontAwesomeIcon icon={faCheck} className="text-2xl text-green-600" />
                                </div>
                                <h3 className="text-xl font-black text-black mb-1">Quest created!</h3>
                                <p className="text-gray-500 text-sm mb-6">Share TaskPay with your audience.</p>
                                <button
                                    type="button"
                                    disabled={sharingQuest}
                                    onClick={async () => {
                                        setSharingQuest(true);
                                        try {
                                            const creatorUsername = user?.username || 'user';
                                            const creatorPfpUrl = (user as any)?.pfpUrl || (user as any)?.pfp_url || '';
                                            const creatorDisplayName = (user as any)?.displayName || (user as any)?.display_name || user?.username || 'Creator';

                                            const castDataPayload = selectedCast ? {
                                                text: selectedCast.text || '',
                                                authorUsername: selectedCast.author?.username || '',
                                                authorPfp: selectedCast.author?.pfp_url || '',
                                                authorDisplayName: selectedCast.author?.display_name || selectedCast.author?.username || '',
                                            } : undefined;

                                            const miniappDataPayload = (selectedType === 'miniapp' && (selectedFrame || targetUrl.trim())) ? {
                                                name: miniappEditName,
                                                icon: selectedFrame?.image || undefined,
                                                developer: selectedFrame ? getFrameDeveloper(selectedFrame).name : undefined,
                                            } : undefined;

                                            const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

                                            const imageData: TaskShareImageData = {
                                                taskType: selectedType,
                                                taskDescription: `${selectedType === 'follow' ? `Grow @${selectedUser?.username || 'user'}` : selectedType === 'miniapp' ? `Try ${selectedFrame ? getFrameDisplayName(selectedFrame) : 'this app'}` : selectedType === 'boost_lite' ? 'Boost this cast' : selectedType === 'boost' ? 'Amplify this cast' : selectedType === 'quote' ? 'Engage with this cast' : selectedType === 'multi' ? `Grow @${selectedUser?.username || 'user'} + Engage` : 'Join the community'}`,
                                                rewardAmount: createdTaskBudgetRef.current,
                                                creatorUsername,
                                                creatorPfpUrl,
                                                creatorDisplayName,
                                                targetUsername: selectedUser?.username,
                                                targetDisplayName: selectedUser?.display_name,
                                                targetPfpUrl: selectedUser?.pfp_url,
                                                castText: castDataPayload?.text,
                                                castAuthorUsername: castDataPayload?.authorUsername,
                                                castAuthorDisplayName: castDataPayload?.authorDisplayName,
                                                castAuthorPfpUrl: castDataPayload?.authorPfp,
                                                miniappName: miniappDataPayload?.name,
                                                miniappIcon: miniappDataPayload?.icon,
                                                miniappDeveloper: miniappDataPayload?.developer,
                                                expiresAt,
                                            };

                                            const imageBlob = await captureTaskShareImage(imageData);
                                            const formData = new FormData();
                                            formData.append('file', imageBlob, `taskpay-quest-${Date.now()}.png`);
                                            const uploadRes = await fetch('/api/ipfs/upload-image', { method: 'POST', body: formData });
                                            const uploadResult = await uploadRes.json();

                                            if (uploadResult.success && uploadResult.ipfsUrl) {
                                                const params = new URLSearchParams({ imageUrl: uploadResult.ipfsUrl });
                                                const shareUrl = `${window.location.origin}?${params.toString()}`;
                                                const shareToken = questChain.tokenSymbol;
                                                const CREATOR_TEXTS = [
                                                    `Just launched a quest on @taskpay 🚀\n\nComplete it and earn ${shareToken} — who's in? 💰`,
                                                    `New quest just dropped on @taskpay 🔥\n\nReal tasks, real ${shareToken} rewards. Don't sleep on it`,
                                                    `I'm paying people to engage on @taskpay 💎\n\nQuest is live — come get this bag`,
                                                    `Quest launched on @taskpay ⚡\n\nEarn ${shareToken} for real engagement. Let's go.`,
                                                ];
                                                const text = CREATOR_TEXTS[Math.floor(Math.random() * CREATOR_TEXTS.length)];
                                                await appActions.composeCast?.({
                                                    text,
                                                    embeds: [shareUrl],
                                                });
                                            } else {
                                                await appActions.composeCast?.({
                                                    text: `Just launched a quest on @taskpay 🚀\nComplete it and earn ${questChain.tokenSymbol} — quests are live!`,
                                                    embeds: [APP_URL ?? ''],
                                                });
                                            }
                                        } catch (err) {
                                            console.error('Share error:', err);
                                            await appActions.composeCast?.({
                                                text: `New quest live on @taskpay ⚡ Complete tasks, earn ${questChain.tokenSymbol}. Simple.`,
                                                embeds: [APP_URL ?? ''],
                                            });
                                        } finally {
                                            setSharingQuest(false);
                                            setShowQuestCreatedModal(false);
                                        }
                                    }}
                                    className="w-full py-3.5 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-60"
                                >
                                    {sharingQuest ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <FontAwesomeIcon icon={faShareNodes} />
                                            Share now
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowQuestCreatedModal(false)}
                                    className="mt-3 text-gray-400 text-sm font-medium hover:text-black"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

export default CreateTask;
