"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck, faUserPlus, faBolt, faQuoteRight, faLayerGroup,
    faHashtag, faRetweet, faCircleCheck, faArrowRight, faArrowLeft,
    faClock, faCoins, faUsers, faExternalLink, faSpinner, faArrowsLeftRight, faStar, faShareNodes, faTimes,
    faBullseye, faCrown, faCalendarDays, faCircleQuestion, faHeart, faComment, faCircleXmark,
    faGift, faUser, faTrophy, faPlus, faShieldHalved
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { useFrame } from '@/components/farcaster-provider';
import { useAppActions } from '@/components/hooks/useAppActions';
import { useUserIdentity } from '@/components/hooks/useUserIdentity';
import { useAppMode } from '@/components/app-mode-provider';
import { ConnectFarcaster } from '@/components/browser/ConnectFarcaster';
import { ConnectX } from '@/components/browser/ConnectX';
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { encodeFunctionData } from 'viem';
import { TASK_ESCROW_ABI, TASK_ESCROW_ADDRESS } from '@/lib/contracts';
import { APP_URL } from '@/lib/constants';
import sdk from '@farcaster/miniapp-sdk';
import { captureTaskShareImage, TaskShareImageData } from '@/lib/taskShareImage';
import { XLogo } from '@/components/icons';
import {
  getLocalChannelDone,
  setLocalChannelDone,
  getTypeTitle,
  getRewardTokenLabel,
  getChainBadgeLabel,
  hasEligibilityCriteria,
  type EligibilityResult,
} from '@/lib/questHelpers';
import { useQuestFeed, type VerifyChecks } from '@/components/hooks/useQuestFeed';

// ─── Pro Badge SVG ──────────────────────────────────────────────────
function ProBadge({ size = 18 }: { size?: number }) {
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

// ─── Countdown Hook ──────────────────────────────────────────────────
function useCountdown(targetDate: Date | null) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!targetDate) { setTimeLeft('—'); return; }

        const update = () => {
            const now = Date.now();
            const diff = targetDate.getTime() - now;
            if (diff <= 0) { setTimeLeft('Expired'); return; }

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
    }, [targetDate]);

    return timeLeft;
}

// ─── Task Type Config ───────────────────────────────────────────────
const TASK_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string; verb: string }> = {
    follow: { icon: faUserPlus, label: 'Grow', color: '#3B82F6', bgColor: '#EFF6FF', verb: 'Follow' },
    boost_lite: { icon: faRetweet, label: 'Boost', color: '#06B6D4', bgColor: '#ECFEFF', verb: 'Boost' },
    boost: { icon: faRetweet, label: 'Amplify', color: '#10B981', bgColor: '#ECFDF5', verb: 'Boost' },
    quote: { icon: faQuoteRight, label: 'Engage', color: '#8B5CF6', bgColor: '#F5F3FF', verb: 'Quote' },
    channel: { icon: faHashtag, label: 'Community', color: '#F59E0B', bgColor: '#FFFBEB', verb: 'Join' },
    multi: { icon: faLayerGroup, label: 'Bundle', color: '#6366F1', bgColor: '#EEF2FF', verb: 'Engage' },
    miniapp: { icon: faBolt, label: 'App', color: '#EF4444', bgColor: '#FEF2F2', verb: 'Try' },
    x_follow: { icon: faUserPlus, label: 'X · Grow', color: '#000000', bgColor: '#F9FAFB', verb: 'Follow' },
    x_boost_lite: { icon: faRetweet, label: 'X · Boost Lite', color: '#000000', bgColor: '#F9FAFB', verb: 'Engage' },
    x_boost: { icon: faRetweet, label: 'X · Boost', color: '#000000', bgColor: '#F9FAFB', verb: 'Engage' },
    x_bundle: { icon: faLayerGroup, label: 'X · Bundle', color: '#000000', bgColor: '#F9FAFB', verb: 'Engage' },
};



// ─── Single Card Component ──────────────────────────────────────────

function TaskCard({
    task, profiles, isActive, onDoTask, onVerify, onShare, verifyingTaskId, verifyError, sharingTaskId, userFid,
    eligibilityResult, onCheckEligibility, onShowCompleters, alwaysActiveStyle = false
}: {
    task: any;
    profiles: Record<number, any>;
    isActive: boolean;
    onDoTask: (task: any) => void;
    onVerify: (task: any) => void;
    onShare: (task: any) => void;
    verifyingTaskId: string | null;
    verifyError: string | null;
    sharingTaskId: string | null;
    userFid?: number;
    eligibilityResult: EligibilityResult;
    onCheckEligibility: (task: any) => void;
    onShowCompleters: (task: any) => void;
    /** On desktop vertical reel, only one card is in view — treat as active (no blur) */
    alwaysActiveStyle?: boolean;
}) {
    const isSharingThis = sharingTaskId === task._id;
    const expiresAt = task.expiresAt ? new Date(task.expiresAt) : null;
    const countdown = useCountdown(expiresAt);

    const config = TASK_CONFIG[task.type] || TASK_CONFIG.follow;
    const creatorProfile = typeof task.creatorFid === 'number' ? profiles[task.creatorFid] : undefined;
    const targetProfile = (task.type === 'follow' || task.type === 'multi') && typeof task.targetFid === 'number'
        ? profiles[task.targetFid] : undefined;

    const totalReward = task.totalBudget ?? task.remainingBudget ?? task.rewardAmount;
    const tokenLabel = getRewardTokenLabel(task);
    const chainBadge = getChainBadgeLabel(task);
    const completedCount = task.completedBy?.length || 0;
    const maxCompletions = task.maxCompletions || 0;
    const progressPct = maxCompletions > 0 ? Math.min((completedCount / maxCompletions) * 100, 100) : 0;
    const isVerifying = verifyingTaskId === task._id;

    // Check status
    const isCompleted = userFid && task.completedBy?.includes(userFid);
    const isFull = maxCompletions > 0 && completedCount >= maxCompletions && !isCompleted;

    const showCast = (task.type === 'boost_lite' || task.type === 'boost' || task.type === 'quote' || task.type === 'multi') && task.castData;
    const showMiniapp = task.type === 'miniapp' && task.miniappData;

    const showActive = alwaysActiveStyle || isActive;
    return (
        <div
            className={`snap-center flex-shrink-0 w-full max-w-[400px] transition-all duration-500 ease-out ${showActive ? 'scale-100 opacity-100' : 'scale-[0.95] opacity-50 blur-[2px]'
                }`}
        >
            <div className={`
                relative flex flex-col bg-white border rounded-[24px] overflow-hidden transition-all duration-300
                ${showActive ? 'shadow-2xl shadow-black/10 border-black/10 ring-1 ring-black/5' : 'shadow-sm border-gray-100'}
            `}
            >
                {/* Active Gradient Border Top */}
                {showActive && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-0" />}

                {/* Top-Left Corner Ribbon */}
                <div className="absolute overflow-hidden w-[90px] h-[90px] top-0 left-0 rounded-tl-[24px] pointer-events-none z-10">
                    <div className={`absolute top-[18px] -left-[24px] w-[100px] text-center font-bold text-[9px] uppercase tracking-wider py-0.5 transform -rotate-45 shadow-sm ${showActive ? 'bg-black text-white' : 'bg-gray-100 text-gray-400'}`}>
                        {config.label}
                    </div>
                </div>

                <div className="p-4 pt-5 flex flex-col h-full space-y-2.5">
                    {/* ── Row 1 (Top): Creator Profile + Reward + Timer ── */}
                    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                        {/* Left: Creator PFP + Name */}
                        <div className="flex items-center gap-2 min-w-0 flex-shrink-0 ml-8">
                            {creatorProfile?.pfp_url ? (
                                <img src={creatorProfile.pfp_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-white shadow-sm" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200" />
                            )}
                            <div className="leading-none min-w-0">
                                <p className="text-xs font-bold text-black truncate max-w-[100px]">
                                    {creatorProfile?.display_name || creatorProfile?.username || task.creatorProfile?.displayName || task.creatorProfile?.username || (task.creatorAddress ? `${task.creatorAddress.slice(0, 6)}…${task.creatorAddress.slice(-4)}` : 'Creator')}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate mt-0.5">
                                    Creator
                                </p>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-8 bg-gray-200 flex-shrink-0 ml-auto" />

                        {/* Right: Timer & Reward Info */}
                        <div className="flex items-center justify-end gap-2.5 min-w-0 pr-1">
                            {/* Timer */}
                            <div className="flex flex-col items-end justify-center gap-0.5">
                                <div className="flex items-center gap-1 bg-gray-50 px-1.5 py-[2px] rounded border border-gray-200">
                                    <FontAwesomeIcon icon={faClock} className={`text-[9px] ${countdown !== 'Expired' ? 'text-orange-500 animate-pulse' : 'text-gray-300'}`} />
                                    <span className="text-[10px] font-mono font-medium text-gray-600 tabular-nums leading-none">
                                        {countdown}
                                    </span>
                                </div>
                                {countdown === 'Expired' && (
                                    <span className="text-[8px] font-bold px-1.5 py-[2px] rounded bg-red-100 text-red-500 uppercase tracking-widest leading-none">
                                        Ended
                                    </span>
                                )}
                            </div>

                            {/* Reward */}
                            <div className="text-right">
                                <div className="flex items-baseline justify-end gap-0.5 leading-none">
                                    <span className="text-[18px] font-black text-transparent bg-clip-text bg-gradient-to-br from-black to-gray-600">
                                        {totalReward}
                                    </span>
                                    <span className="text-[9px] font-bold text-gray-400">{tokenLabel}</span>
                                </div>
                                {chainBadge && (
                                    <span className="text-[8px] font-bold px-1.5 py-[1px] rounded bg-emerald-50 text-emerald-700 uppercase tracking-wide">
                                        {chainBadge}
                                    </span>
                                )}
                                {completedCount > 0 ? (
                                    <div className="flex items-center justify-end gap-1 mt-1 leading-none">
                                        <FontAwesomeIcon icon={faCoins} className="text-[8px] text-amber-400" />
                                        <span className="text-[10px] font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-500 to-orange-500">
                                            {(totalReward / completedCount).toFixed(4)}
                                        </span>
                                        <span className="text-[9px] text-gray-300 font-medium">/u</span>
                                    </div>
                                ) : (
                                    <p className="text-[9px] text-gray-400 font-medium mt-1 leading-none">Pool</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Task Content ── */}
                    <div className="flex-1 space-y-2 min-h-0">
                        <h3 className="text-sm font-bold text-black leading-snug line-clamp-2">
                            {task.description || getTypeTitle(task)}
                        </h3>

                        {/* Cast Preview */}
                        {showCast && task.castData && (
                            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200 text-xs text-gray-600 relative overflow-hidden group">
                                <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                    <img src={task.castData.authorPfp} className="w-4 h-4 rounded-full" />
                                    <span className="font-bold text-xs">{task.castData.authorDisplayName}</span>
                                </div>
                                <p className="line-clamp-2 border-l-2 border-gray-300 pl-2 text-xs">{task.castData.text}</p>
                            </div>
                        )}

                        {/* MiniApp Preview: icon, name, description, image, button */}
                        {showMiniapp && task.miniappData && (
                            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-2.5 border border-purple-100/50 space-y-2">
                                <div className="flex items-center gap-2">
                                    {(task.miniappData.icon || task.miniappData.image) && (
                                        <img
                                            src={task.miniappData.icon || task.miniappData.image}
                                            alt=""
                                            className="w-8 h-8 rounded-lg shadow-sm object-cover bg-white shrink-0"
                                        />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-purple-900 truncate">{task.miniappData.name || 'Mini App'}</p>
                                        {task.miniappData.description && (
                                            <p className="text-[10px] text-purple-700/60 truncate">{task.miniappData.description}</p>
                                        )}
                                    </div>
                                </div>
                                {task.miniappData.image && (
                                    <div className="rounded-lg overflow-hidden border border-purple-100/70 max-h-50 w-full bg-[#f8f9fa] shrink-0 flex items-center justify-center">
                                        <img src={task.miniappData.image} alt="" className="max-h-40 max-w-full object-contain drop-shadow-sm" />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onDoTask(task); }}
                                    className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors active:scale-[0.98] shadow-md shadow-purple-200"
                                >
                                    <FontAwesomeIcon icon={faBolt} className="text-[10px]" />
                                    <span>{task.miniappData.button_title || 'Open Mini App'}</span>
                                </button>
                            </div>
                        )}

                        {/* Target Profile highlight for Follow/Multi */}
                        {targetProfile && !showCast && (
                            <div className="flex items-center gap-2 bg-blue-50/50 rounded-xl p-2.5 border border-blue-100/50">
                                <div className="w-1 h-8 bg-blue-400 rounded-full" />
                                <img src={targetProfile.pfp_url} className="w-8 h-8 rounded-full bg-white" />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-blue-900 truncate">{targetProfile.display_name}</p>
                                    <p className="text-[10px] text-blue-700/60 truncate">@{targetProfile.username}</p>
                                </div>
                            </div>
                        )}

                        {/* X Target User for x_follow / x_bundle */}
                        {(task.type === 'x_follow' || task.type === 'x_bundle') && task.xTargetUsername && (
                            <div className="flex items-center gap-2 bg-gray-50/80 rounded-xl p-2.5 border border-gray-200">
                                <div className="w-1 h-8 bg-black rounded-full" />
                                {task.xTargetAvatar && <img src={task.xTargetAvatar} className="w-8 h-8 rounded-full bg-white object-cover" />}
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-black truncate flex items-center gap-1">
                                        @{task.xTargetUsername}
                                        <XLogo size={12} fill="#000" />
                                    </p>
                                    {task.xTargetFollowers != null && (
                                        <p className="text-[10px] text-gray-400">{task.xTargetFollowers.toLocaleString()} followers</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* X Tweet Preview for x_boost_lite / x_boost / x_bundle */}
                        {(task.type === 'x_boost_lite' || task.type === 'x_boost' || task.type === 'x_bundle') && task.xTweetData && (
                            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-200 text-xs text-gray-600 relative overflow-hidden">
                                <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                    {task.xTweetData.authorAvatar && <img src={task.xTweetData.authorAvatar} className="w-4 h-4 rounded-full" />}
                                    <span className="font-bold text-xs">{task.xTweetData.authorName || task.xTweetData.authorUsername}</span>
                                    <XLogo size={10} fill="#666" />
                                </div>
                                <p className="line-clamp-2 border-l-2 border-gray-300 pl-2 text-xs">{task.xTweetData.text}</p>
                            </div>
                        )}

                        {/* Eligibility (targeting) — show when creator set any criteria */}
                        {(task.minFollowers != null && task.minFollowers > 0) || (task.minNeynarScore != null && task.minNeynarScore >= 0) || task.proSubscribersOnly || (task.minAccountAgeDays != null && task.minAccountAgeDays > 0) || (task.minXFollowers != null && task.minXFollowers > 0) || task.nonSpamOnly ? (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                    <FontAwesomeIcon icon={faBullseye} className="text-slate-400 text-[9px]" />
                                    Eligibility
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {task.minFollowers != null && task.minFollowers > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <FontAwesomeIcon icon={faUsers} className="text-slate-500 text-[9px]" />
                                            {task.minFollowers}+ followers
                                        </span>
                                    )}
                                    {task.minNeynarScore != null && task.minNeynarScore >= 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <FontAwesomeIcon icon={faStar} className="text-amber-500 text-[9px]" />
                                            Score ≥ {task.minNeynarScore.toFixed(2)}
                                        </span>
                                    )}
                                    {task.proSubscribersOnly && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                            <FontAwesomeIcon icon={faCrown} className="text-amber-500 text-[9px]" />
                                            Pro only
                                        </span>
                                    )}
                                    {task.minAccountAgeDays != null && task.minAccountAgeDays > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <FontAwesomeIcon icon={faCalendarDays} className="text-slate-500 text-[9px]" />
                                            {task.minAccountAgeDays}+ days
                                        </span>
                                    )}
                                    {task.minXFollowers != null && task.minXFollowers > 0 && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                            <XLogo size={10} />
                                            {task.minXFollowers}+ followers
                                        </span>
                                    )}
                                    {task.nonSpamOnly && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                            <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-500 text-[9px]" />
                                            Non-spam only
                                        </span>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* ── Progress Bar ── */}
                    {maxCompletions > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                <span>{completedCount} / {maxCompletions} Claims</span>
                                <div className="flex items-center gap-1.5">
                                    {completedCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onShowCompleters(task); }}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black transition-all active:scale-95"
                                        >
                                            <FontAwesomeIcon icon={faUsers} className="text-[9px]" />
                                            <span className="text-[10px] normal-case tracking-normal font-bold">{completedCount}</span>
                                        </button>
                                    )}
                                    <span>{Math.round(progressPct)}%</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-black to-gray-600 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPct}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Actions ── */}
                    <div className="pt-2 flex flex-col gap-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => onDoTask(task)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-center gap-1.5 text-gray-700 shadow-sm"
                            >
                                <span>{config.verb}</span>
                                <FontAwesomeIcon icon={faExternalLink} className="opacity-40 text-[10px]" />
                            </button>

                            {eligibilityResult === null ? (
                                <button
                                    onClick={() => onCheckEligibility(task)}
                                    className="flex-[1.5] py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 border border-teal-500/30"
                                >
                                    <FontAwesomeIcon icon={faCircleQuestion} className="opacity-90 text-[10px]" />
                                    <span>Am I eligible?</span>
                                </button>
                            ) : eligibilityResult === 'loading' ? (
                                <button
                                    disabled
                                    className="flex-[1.5] py-2.5 rounded-xl text-xs font-bold text-teal-800 bg-teal-100 border border-teal-200 flex items-center justify-center gap-1.5 cursor-wait"
                                >
                                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-[10px]" />
                                    <span>Checking…</span>
                                </button>
                            ) : (
                                <div className={`flex-[1.5] py-2 px-2.5 rounded-xl text-center flex flex-col items-center justify-center min-h-[38px] transition-all duration-300 ${eligibilityResult.eligible ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 border border-red-200 shadow-inner'}`}>
                                    {eligibilityResult.eligible ? (
                                        <div className="flex items-center gap-1.5 font-bold text-xs">
                                            <FontAwesomeIcon icon={faCircleCheck} className="text-emerald-500 text-[10px]" />
                                            <span>Eligible</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-0.5 w-full">
                                            <div className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase tracking-tight">
                                                <FontAwesomeIcon icon={faCircleXmark} className="text-[9px]" />
                                                <span>Not Eligible</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-red-500 leading-tight line-clamp-1 w-full" title={eligibilityResult.message}>
                                                {eligibilityResult.message || 'Check requirements'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        {eligibilityResult !== null && eligibilityResult !== 'loading' && eligibilityResult.eligible && (
                            <button
                                onClick={() => onVerify(task)}
                                disabled={isVerifying || isCompleted || isFull}
                                className={`
                                    w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all
                                    flex items-center justify-center gap-1.5 relative overflow-hidden
                                    ${isCompleted
                                        ? 'bg-green-600 cursor-default opacity-90'
                                        : isFull
                                            ? 'bg-gray-400 cursor-not-allowed opacity-80'
                                            : isVerifying
                                                ? 'bg-gray-800 cursor-wait'
                                                : 'bg-black hover:bg-gray-900 active:scale-[0.98]'
                                    }
                                `}
                            >
                                {isVerifying ? (
                                    <>
                                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                        <span>Verifying</span>
                                    </>
                                ) : isCompleted ? (
                                    <>
                                        <FontAwesomeIcon icon={faCheck} />
                                        <span>Completed</span>
                                    </>
                                ) : isFull ? (
                                    <>
                                        <FontAwesomeIcon icon={faTimes} />
                                        <span>No slots</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Complete Task</span>
                                        <FontAwesomeIcon icon={faArrowRight} className="opacity-80" />
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Error Message */}
                    {showActive && verifyError && (
                        <div className="absolute bottom-16 left-3 right-3 text-center">
                            <div className="inline-block bg-red-100 text-red-600 text-[10px] font-bold px-3 py-1.5 rounded-full border border-red-200 shadow-sm animate-bounce-short">
                                {verifyError}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Verify Checklist Modal ─────────────────────────────────────────

interface ChecklistItem {
    key: string;
    label: string;
    icon: any;
    color: string;
    action: () => void;
}

function getChecklistItems(
    task: any,
    profiles: Record<number, any>,
    onAction: (actionType: string) => void,
): ChecklistItem[] {
    const items: ChecklistItem[] = [];
    const target = typeof task.targetFid === 'number' ? profiles[task.targetFid] : undefined;
    const targetName = target?.display_name || target?.username || task.targetUsername || 'user';

    switch (task.type) {
        case 'follow':
            items.push({
                key: 'follow',
                label: `Follow @${targetName}`,
                icon: faUserPlus,
                color: '#3B82F6',
                action: () => onAction('follow'),
            });
            break;
        case 'boost_lite':
            items.push(
                { key: 'like', label: 'Like the cast', icon: faHeart, color: '#EF4444', action: () => onAction('cast') },
                { key: 'recast', label: 'Recast', icon: faRetweet, color: '#10B981', action: () => onAction('cast') },
            );
            break;
        case 'boost':
            items.push(
                { key: 'like', label: 'Like the cast', icon: faHeart, color: '#EF4444', action: () => onAction('cast') },
                { key: 'recast', label: 'Recast', icon: faRetweet, color: '#10B981', action: () => onAction('cast') },
                { key: 'quote', label: 'Quote the cast', icon: faQuoteRight, color: '#8B5CF6', action: () => onAction('cast') },
                { key: 'comment', label: 'Comment on the cast', icon: faComment, color: '#F59E0B', action: () => onAction('cast') },
            );
            break;
        case 'quote':
            items.push({
                key: 'quote',
                label: 'Quote the cast',
                icon: faQuoteRight,
                color: '#8B5CF6',
                action: () => onAction('cast'),
            });
            break;
        case 'multi':
            items.push(
                { key: 'follow', label: `Follow @${targetName}`, icon: faUserPlus, color: '#3B82F6', action: () => onAction('follow') },
                { key: 'like', label: 'Like the cast', icon: faHeart, color: '#EF4444', action: () => onAction('cast') },
                { key: 'recast', label: 'Recast the cast', icon: faRetweet, color: '#10B981', action: () => onAction('cast') },
                { key: 'quote', label: 'Quote the cast', icon: faQuoteRight, color: '#8B5CF6', action: () => onAction('cast') },
                { key: 'comment', label: 'Comment on the cast', icon: faComment, color: '#F59E0B', action: () => onAction('cast') },
            );
            break;
        case 'channel':
            items.push({
                key: 'channel',
                label: `Join ${task.channelId ? `/${task.channelId}` : 'the channel'}`,
                icon: faHashtag,
                color: '#F59E0B',
                action: () => onAction('channel'),
            });
            break;
        case 'miniapp':
            items.push({
                key: 'miniappOpened',
                label: `Open ${task.miniappData?.name || 'the mini app'}`,
                icon: faBolt,
                color: '#EF4444',
                action: () => onAction('miniapp'),
            });
            if (task.miniappFeedbackCastHash) {
                items.push({
                    key: 'miniappAdded',
                    label: `Add ${task.miniappData?.name || 'the mini app'}`,
                    icon: faPlus,
                    color: '#8B5CF6',
                    action: () => onAction('miniappAdd'),
                });
                // Feedback step only when mode is set; if null/undefined → open + add only.
                if (task.miniappFeedbackMode === 'quote' || task.miniappFeedbackMode === 'comment') {
                    const feedbackIsQuote = task.miniappFeedbackMode === 'quote';
                    items.push({
                        key: feedbackIsQuote ? 'miniappQuote' : 'miniappComment',
                        label: feedbackIsQuote
                            ? 'Give feedback (quote)'
                            : 'Give feedback (comment)',
                        icon: feedbackIsQuote ? faQuoteRight : faComment,
                        color: '#F59E0B',
                        action: () => onAction(feedbackIsQuote ? 'miniappQuote' : 'miniappComment'),
                    });
                }
            }
            break;
        case 'x_follow':
            items.push({
                key: 'x_follow',
                label: `Follow @${task.xTargetUsername || 'user'} on X`,
                icon: faUserPlus,
                color: '#000000',
                action: () => onAction('x_follow'),
            });
            break;
        case 'x_boost':
            items.push(
                { key: 'x_like', label: 'Like the post', icon: faHeart, color: '#EF4444', action: () => onAction('x_cast') },
                { key: 'x_retweet', label: 'Retweet the post', icon: faRetweet, color: '#10B981', action: () => onAction('x_cast') },
                { key: 'x_quote', label: 'Quote the post', icon: faQuoteRight, color: '#8B5CF6', action: () => onAction('x_cast') },
                { key: 'x_comment', label: 'Comment on the post', icon: faComment, color: '#F59E0B', action: () => onAction('x_cast') },
            );
            break;
        case 'x_boost_lite':
            items.push(
                { key: 'x_like', label: 'Like the post', icon: faHeart, color: '#EF4444', action: () => onAction('x_cast') },
                { key: 'x_retweet', label: 'Repost the post', icon: faRetweet, color: '#10B981', action: () => onAction('x_cast') },
            );
            break;
        case 'x_bundle':
            items.push(
                { key: 'x_follow', label: `Follow @${task.xTargetUsername || 'user'} on X`, icon: faUserPlus, color: '#000000', action: () => onAction('x_follow') },
                { key: 'x_like', label: 'Like the post', icon: faHeart, color: '#EF4444', action: () => onAction('x_cast') },
                { key: 'x_retweet', label: 'Retweet the post', icon: faRetweet, color: '#10B981', action: () => onAction('x_cast') },
                { key: 'x_quote', label: 'Quote the post', icon: faQuoteRight, color: '#8B5CF6', action: () => onAction('x_cast') },
                { key: 'x_comment', label: 'Comment on the post', icon: faComment, color: '#F59E0B', action: () => onAction('x_cast') },
            );
            break;
    }
    return items;
}

function VerifyModal({
    task,
    profiles,
    checks,
    isVerifying,
    verifyError,
    cooldownSecondsLeft,
    onDoAction,
    onVerify,
    onClose,
}: {
    task: any;
    profiles: Record<number, any>;
    checks: VerifyChecks;
    isVerifying: boolean;
    verifyError: string | null;
    cooldownSecondsLeft: number;
    onDoAction: (task: any, actionType: string) => void;
    onVerify: () => void;
    onClose: () => void;
}) {
    const config = TASK_CONFIG[task.type] || TASK_CONFIG.follow;
    const items = getChecklistItems(task, profiles, (actionType) => onDoAction(task, actionType));

    const completedCount = items.filter((i) => checks[i.key]).length;
    const allDone = completedCount === items.length;
    const cooldownActive = cooldownSecondsLeft > 0;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
            >
                {/* Gradient top bar */}
                <div className="h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

                {/* Handle bar (mobile) */}
                <div className="flex justify-center pt-3 sm:hidden">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                <div className="p-6 space-y-5 pb-20 sm:pb-6 max-h-[85vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                                style={{ backgroundColor: config.bgColor }}
                            >
                                <FontAwesomeIcon icon={config.icon} style={{ color: config.color }} className="text-base" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-black">Complete & Verify</h3>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                                    {completedCount}/{items.length} done
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                        >
                            <FontAwesomeIcon icon={faTimes} className="text-sm text-gray-500" />
                        </button>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${items.length > 0 ? (completedCount / items.length) * 100 : 0}%` }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        />
                    </div>



                    {/* Checklist */}
                    <div className="space-y-2.5">
                        {items.map((item) => {
                            const done = checks[item.key];
                            return (
                                <div
                                    key={item.key}
                                    className={`
                                        flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all duration-300
                                        ${done
                                            ? 'bg-emerald-50/80 border-emerald-200/60'
                                            : 'bg-red-50/60 border-red-200/60'
                                        }
                                    `}
                                >
                                    {/* Status icon */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all
                                        ${done
                                            ? 'bg-emerald-500 shadow-sm shadow-emerald-200'
                                            : 'bg-red-100 border border-red-200'
                                        }
                                    `}>
                                        {done ? (
                                            <FontAwesomeIcon icon={faCheck} className="text-xs text-white" />
                                        ) : (
                                            <FontAwesomeIcon icon={faCircleXmark} className="text-xs text-red-400" />
                                        )}
                                    </div>

                                    {/* Label */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-semibold truncate ${done ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {item.label}
                                        </p>
                                        {!done && (
                                            <p className="text-xs text-red-400 mt-0.5">Still remaining</p>
                                        )}
                                    </div>

                                    {/* Action button */}
                                    {!done && (
                                        <button
                                            onClick={item.action}
                                            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95 flex items-center gap-1.5 flex-shrink-0"
                                            style={{ backgroundColor: item.color }}
                                        >
                                            <FontAwesomeIcon icon={item.icon} className="text-[10px]" />
                                            <span>Do it</span>
                                        </button>
                                    )}
                                    {done && (
                                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex-shrink-0">Done</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Error */}
                    {verifyError && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-center">
                            <p className="text-sm font-semibold text-red-600">{verifyError}</p>
                        </div>
                    )}

                    {/* Verify button */}
                    <button
                        onClick={onVerify}
                        disabled={isVerifying || cooldownActive}
                        className={`
                            w-full py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg transition-all
                            flex items-center justify-center gap-2 relative overflow-hidden
                            ${(isVerifying || cooldownActive)
                                ? 'bg-gray-800 cursor-wait'
                                : allDone
                                    ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 active:scale-[0.98]'
                                    : 'bg-black hover:bg-gray-900 active:scale-[0.98]'
                            }
                        `}
                    >
                        {isVerifying ? (
                            <>
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                                <span>Verifying…</span>
                            </>
                        ) : cooldownActive ? (
                            <>
                                <FontAwesomeIcon icon={faClock} />
                                <span>Try again in {cooldownSecondsLeft}s</span>
                            </>
                        ) : (
                            <>
                                <FontAwesomeIcon icon={faCircleCheck} />
                                <span>Verify Task</span>
                                <FontAwesomeIcon icon={faArrowRight} className="opacity-60 text-xs" />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Completed-By Popup ─────────────────────────────────────────────
function CompletedByPopup({
    completions,
    perUser,
    token,
    onClose,
}: {
    completions: any[];
    perUser: number;
    token: string;
    onClose: () => void;
}) {
    const claimed = completions.filter((c) => c.claimStatus === 'claimed').length;
    const total = completions.length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: 80, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 80, opacity: 0, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 overflow-hidden"
            >
                {/* Gradient top bar */}
                <div className="h-1.5 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />

                {/* Handle bar (mobile) */}
                <div className="flex justify-center pt-3 sm:hidden">
                    <div className="w-10 h-1 bg-gray-200 rounded-full" />
                </div>

                <div className="p-6 space-y-4 pb-8 sm:pb-6 max-h-[70vh] overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shadow-sm">
                                <FontAwesomeIcon icon={faTrophy} className="text-base text-emerald-600" />
                            </div>
                        </div>
                        {/* Per-user value pill */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 px-3 py-1.5 rounded-xl">
                                <FontAwesomeIcon icon={faCoins} className="text-xs text-amber-500" />
                                <span className="text-sm font-bold text-amber-700">{perUser.toFixed(4)} {token}</span>
                                <span className="text-[10px] text-amber-500/70 font-medium">per user</span>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} className="text-sm text-gray-500" />
                            </button>
                        </div>
                    </div>

                    {/* Claim progress bar */}
                    <div className="flex-shrink-0 space-y-1">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${total > 0 ? (claimed / total) * 100 : 0}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                    </div>

                    {/* User list */}
                    <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 -mr-1">
                        {completions.map((c, i) => {
                            const isClaimed = c.claimStatus === 'claimed';
                            return (
                                <motion.div
                                    key={c.userFid ?? i}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05, duration: 0.3 }}
                                    className={`flex items-center gap-3.5 p-3.5 rounded-2xl border transition-all ${isClaimed
                                        ? 'bg-emerald-50/60 border-emerald-200/50'
                                        : 'bg-amber-50/40 border-amber-200/40'
                                        }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative flex-shrink-0">
                                        {c.userPfpUrl ? (
                                            <img
                                                src={c.userPfpUrl}
                                                alt=""
                                                className={`w-10 h-10 rounded-full object-cover ring-2 shadow-sm ${isClaimed ? 'ring-emerald-300' : 'ring-amber-200'}`}
                                            />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isClaimed
                                                ? 'bg-gradient-to-br from-emerald-200 to-teal-200'
                                                : 'bg-gradient-to-br from-amber-100 to-orange-100'
                                                }`}>
                                                <FontAwesomeIcon icon={faUser} className="text-xs text-gray-400" />
                                            </div>
                                        )}
                                        {c.isPro && (
                                            <div className="absolute -bottom-1 -right-1 z-10" title="Farcaster Pro">
                                                <ProBadge size={16} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Name */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-black truncate">
                                            {c.userDisplayName || c.userUsername || `FID ${c.userFid}`}
                                        </p>
                                        <p className="text-xs text-gray-400 truncate">
                                            @{c.userUsername || 'user'}
                                        </p>
                                    </div>

                                    {/* Claim badge */}
                                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${isClaimed
                                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                                        : 'bg-amber-100 text-amber-700 border border-amber-200'
                                        }`}>
                                        <FontAwesomeIcon
                                            icon={isClaimed ? faCircleCheck : faClock}
                                            className="text-[10px]"
                                        />
                                        <span>{isClaimed ? 'Claimed' : 'Unclaimed'}</span>
                                    </div>
                                </motion.div>
                            );
                        })}
                        {completions.length === 0 && (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                No completions yet
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ─── Completed Task Card (verified success: show stats + completers) ─
function CompletedTaskCard({
    completion,
    task,
    profiles,
    onShowCompleters,
}: {
    completion: any;
    task: any;
    profiles: Record<number, any>;
    onShowCompleters: (completions: any[], perUser: number, token: string) => void;
}) {
    const config = TASK_CONFIG[task?.type] || TASK_CONFIG.follow;
    const creatorProfile = typeof task?.creatorFid === 'number' ? profiles[task.creatorFid] : undefined;
    const completions = task?.completedBy?.length ?? 0;
    const maxC = task?.maxCompletions ?? 0;
    const totalBudget = task?.totalBudget ?? 0;
    const perUser = completions > 0 ? totalBudget / completions : (task?.computedRewardPerUser ?? 0);
    const claimedCount = task?.claimedCount ?? 0;
    const token = getRewardTokenLabel(task);
    const taskCompletions: any[] = task?.completions || [];
    const displayAvatars = taskCompletions.slice(0, 5);
    const extraCount = Math.max(0, taskCompletions.length - 5);
    const allClaimed = taskCompletions.length > 0 && claimedCount >= taskCompletions.length;

    return (
        <div className="snap-center flex-shrink-0 w-full max-w-[400px]">
            <div className="relative flex flex-col bg-white border rounded-[24px] overflow-hidden shadow-2xl shadow-black/10 border-black/10 ring-1 ring-black/5">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
                <div className="p-4 flex flex-col h-full space-y-2">
                    {/* Header: badges + creator inline */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-green-100 text-green-700">
                                {config.label}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-600 text-white uppercase tracking-wider">
                                ✓ Done
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {creatorProfile?.pfp_url ? (
                                <img src={creatorProfile.pfp_url} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-white shadow-sm" />
                            ) : (
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200" />
                            )}
                            <span className="text-[11px] font-semibold text-gray-500 truncate max-w-[80px]">
                                {creatorProfile?.display_name || creatorProfile?.username || `FID ${task?.creatorFid}`}
                            </span>
                        </div>
                    </div>

                    {/* Task title */}
                    <h3 className="text-sm font-bold text-black leading-snug line-clamp-2">
                        {task?.description || 'Quest'}
                    </h3>

                    {/* Stats strip — horizontal */}
                    <div className="flex bg-gray-50 rounded-xl border border-gray-100 divide-x divide-gray-100 overflow-hidden">
                        <div className="flex-1 py-2 px-2 text-center">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Done</div>
                            <div className="font-bold text-sm text-black tabular-nums mt-0.5">{completions}{maxC > 0 ? `/${maxC}` : ''}</div>
                        </div>
                        <div className="flex-1 py-2 px-2 text-center">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Budget</div>
                            <div className="font-bold text-xs text-black mt-0.5">{totalBudget.toFixed(2)} {token}</div>
                        </div>
                        <div className="flex-1 py-2 px-2 text-center">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Per User</div>
                            <div className="font-bold text-xs text-green-600 mt-0.5">{perUser.toFixed(4)}</div>
                        </div>
                        <div className="flex-1 py-2 px-2 text-center">
                            <div className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Claimed</div>
                            <div className="font-bold text-sm text-black tabular-nums mt-0.5">{claimedCount}/{completions}</div>
                        </div>
                    </div>

                    {/* Completers row — compact */}
                    {taskCompletions.length > 0 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onShowCompleters(taskCompletions, perUser, token); }}
                            className="group w-full flex items-center gap-2.5 bg-slate-50 rounded-xl p-2.5 border border-gray-100 hover:border-gray-200 transition-all hover:shadow-sm active:scale-[0.98]"
                        >
                            {/* Avatar stack */}
                            <div className="flex -space-x-1.5 shrink-0">
                                {displayAvatars.map((c: any, i: number) => (
                                    c.userPfpUrl ? (
                                        <img
                                            key={c.userFid ?? i}
                                            src={c.userPfpUrl}
                                            alt=""
                                            className="w-6 h-6 rounded-full object-cover ring-1 ring-white"
                                            style={{ zIndex: 10 - i }}
                                        />
                                    ) : (
                                        <div
                                            key={c.userFid ?? i}
                                            className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 ring-1 ring-white flex items-center justify-center"
                                            style={{ zIndex: 10 - i }}
                                        >
                                            <FontAwesomeIcon icon={faUser} className="text-[8px] text-gray-400" />
                                        </div>
                                    )
                                ))}
                            </div>
                            {extraCount > 0 && (
                                <span className="text-[10px] font-bold text-gray-400">+{extraCount}</span>
                            )}

                            {/* Claim pill */}
                            <div className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${allClaimed
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-amber-50 text-amber-700 border border-amber-100'
                                }`}>
                                <FontAwesomeIcon
                                    icon={allClaimed ? faCircleCheck : faGift}
                                    className={`text-[9px] ${allClaimed ? 'text-emerald-500' : 'text-amber-500'}`}
                                />
                                <span>
                                    {allClaimed ? 'All claimed ✓' : `${claimedCount}/${taskCompletions.length} claimed`}
                                </span>
                            </div>

                            <FontAwesomeIcon icon={faArrowRight} className="text-[9px] text-gray-300 group-hover:text-black group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main TaskFeed ──────────────────────────────────────────────────
export default function TaskFeed({
    onTaskVerified,
    filter: filterProp,
    onFilterChange,
    onVisibleCountChange,
}: {
    onTaskVerified?: () => void;
    filter?: 'active' | 'filled' | 'completed';
    onFilterChange?: (f: 'active' | 'filled' | 'completed') => void;
    onVisibleCountChange?: (count: number) => void;
} = {}) {
    const { context } = useFrame();
    const appActions = useAppActions();
    const identity = useUserIdentity();
    const participantFid = identity.fid;
    const participantWallet = identity.walletAddress?.toLowerCase();
    const user = context?.user;
    const activeFid = participantFid ?? user?.fid;

    const { address } = useAccount();
    const publicClient = usePublicClient();

    const feed = useQuestFeed({
        onTaskVerified,
        filter: filterProp,
        onFilterChange,
        onVisibleCountChange,
    });

    const {
        visibleTasks,
        isLoading,
        completedLoading,
        filter,
        setFilter,
        profiles,
        eligibilityByTaskId,
        verifyingTaskId,
        verifyError,
        setVerifyError,
        verifyModalTask,
        setVerifyModalTask,
        verifyModalChecks,
        setVerifyModalChecks,
        showVerifySuccessModal,
        setShowVerifySuccessModal,
        verifiedTask,
        setVerifiedTask,
        platformConnectTask,
        setPlatformConnectTask,
        noEthModalTask,
        setNoEthModalTask,
        openTaskAction,
        handleOpenVerifyModal,
        handleModalVerify,
        handleCheckEligibility,
        verifyCooldownSecondsLeft,
    } = feed;

    const [isSharing, setIsSharing] = useState(false);
    const [sharingTaskId, setSharingTaskId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [completedByPopupData, setCompletedByPopupData] = useState<{ completions: any[]; perUser: number; token: string } | null>(null);

    const fetchAndShowCompleters = async (task: any) => {
        try {
            const fids: number[] = task.completedBy || [];
            if (fids.length === 0) return;

            // Resolve profiles via Neynar bulk
            const res = await axios.get(`/api/neynar/users/bulk?fids=${fids.join(',')}`);
            const users: any[] = res.data?.users || [];
            const profileMap: Record<number, any> = {};
            for (const u of users) if (typeof u.fid === 'number') profileMap[u.fid] = u;

            const completions = fids.map((fid) => {
                const p = profileMap[fid];
                const proStatus = p?.pro?.status;
                return {
                    userFid: fid,
                    userUsername: p?.username || null,
                    userDisplayName: p?.display_name || null,
                    userPfpUrl: p?.pfp_url || null,
                    claimStatus: 'unclaimed',
                    isPro: proStatus === 'subscribed' || proStatus === 'active',
                };
            });

            const totalBudget = task.totalBudget ?? task.remainingBudget ?? task.rewardAmount ?? 0;
            const perUser = totalBudget / (fids.length || 1);
            const token = getRewardTokenLabel(task);
            setCompletedByPopupData({ completions, perUser, token });
        } catch (e) {
            console.error('Failed to fetch completers', e);
        }
    };

    const handleModalDoAction = async (task: any, actionType: string) => {
        switch (actionType) {
            case 'follow':
                if (task.targetFid || task.targetUsername) {
                    await appActions.viewProfile({
                        fid: task.targetFid,
                        username: task.targetUsername,
                    });
                }
                break;
            case 'cast':
                if (task.castHash) await appActions.viewCast({ hash: task.castHash });
                break;
            case 'channel':
                if (task.targetUrl) appActions.openUrl?.(task.targetUrl);
                // Temporary: treat "clicked join" as completion for community tasks.
                if (task?.type === 'channel' && activeFid && task?._id) {
                    const taskId = String(task._id);
                    setLocalChannelDone(taskId, activeFid);
                    setVerifyModalChecks((prev) => ({ ...prev, channel: true }));
                }
                break;
            case 'miniapp':
                if (task.miniappUrl && activeFid && task._id) {
                    try {
                        await axios.post('/api/tasks/miniapp/open', {
                            taskId: task._id,
                            userFid: activeFid,
                        });
                    } catch (e) {
                        console.error('Failed to record miniapp open', e);
                    }
                    appActions.openMiniApp({ url: task.miniappUrl });
                }
                break;
            case 'miniappAdd':
                if (task.miniappUrl && activeFid && task._id) {
                    try {
                        await axios.post('/api/tasks/miniapp/add', {
                            taskId: task._id,
                            userFid: activeFid,
                        });
                    } catch (e) {
                        console.error('Failed to record miniapp add', e);
                    }
                    appActions.openMiniApp({ url: task.miniappUrl });
                }
                break;
            case 'miniappComment':
            case 'miniappQuote':
                if (task.miniappFeedbackCastHash) {
                    appActions.viewCast({ hash: task.miniappFeedbackCastHash });
                }
                break;
            case 'x_follow':
                if (task.xTargetUsername) appActions.openUrl?.(`https://x.com/${task.xTargetUsername}`);
                break;
            case 'x_cast':
                if (task.xTweetUrl) appActions.openUrl?.(task.xTweetUrl);
                else if (task.xTweetId) appActions.openUrl?.(`https://x.com/i/status/${task.xTweetId}`);
                break;
        }
    };

    const handleShareTask = async (task: any) => {
        if (!appActions.composeCast) return;
        setSharingTaskId(task._id);
        try {
            const creatorProfile = typeof task.creatorFid === 'number'
                ? profiles[task.creatorFid] as { username?: string; display_name?: string; pfp_url?: string } | undefined
                : undefined;
            const targetProfile = (task.type === 'follow' || task.type === 'multi') && typeof task.targetFid === 'number'
                ? profiles[task.targetFid] as { username?: string; display_name?: string; pfp_url?: string } | undefined
                : undefined;
            const reward = task.totalBudget ?? task.remainingBudget ?? task.rewardAmount;

            const imageData: TaskShareImageData = {
                taskType: task.type || 'follow',
                taskDescription: String(task.description || getTypeTitle(task)),
                rewardAmount: reward,
                creatorUsername: creatorProfile?.username || 'user',
                creatorPfpUrl: creatorProfile?.pfp_url || '',
                creatorDisplayName: creatorProfile?.display_name || creatorProfile?.username || 'Creator',
                // Follow / Multi target
                targetUsername: task.targetUsername,
                targetDisplayName: targetProfile?.display_name || task.targetUsername,
                targetPfpUrl: targetProfile?.pfp_url || '',
                // Cast info (boost / quote / multi)
                castText: task.castData?.text,
                castAuthorUsername: task.castData?.authorUsername,
                castAuthorDisplayName: task.castData?.authorDisplayName,
                castAuthorPfpUrl: task.castData?.authorPfp,
                // Miniapp
                miniappName: task.miniappData?.name,
                miniappIcon: task.miniappData?.icon,
                miniappDeveloper: task.miniappData?.developer,
                // Progress
                completedCount: task.completedBy?.length,
                maxCompletions: task.maxCompletions,
                // Timer
                expiresAt: task.expiresAt || null,
            };

            const imageBlob = await captureTaskShareImage(imageData);

            const formData = new FormData();
            formData.append('file', imageBlob, `taskpay-quest-${Date.now()}.png`);

            const uploadRes = await fetch('/api/ipfs/upload-image', { method: 'POST', body: formData });
            const uploadResult = await uploadRes.json();

            if (!uploadResult.success || !uploadResult.ipfsUrl) throw new Error('IPFS upload failed');

            const params = new URLSearchParams({ imageUrl: uploadResult.ipfsUrl });
            const shareUrl = `${window.location.origin}?${params.toString()}`;

            const SHARE_TEXTS = [
                `Quests are paying out real G$ & USDC on @taskpay 🔥\n\nFollow, engage, earn — it's that simple 👇`,
                `I'm stacking rewards just by completing quests on @taskpay 💰\n\nStop sleeping on this fr`,
                `@taskpay is the move rn 🚀\n\nComplete quests, get paid in G$ & USDC. No cap.`,
                `New quest alert on @taskpay 💎\n\nEarn G$ or USDC for doing what you already do on Farcaster`,
                `If you're not on @taskpay yet you're leaving free rewards on the table 😤\n\nQuests are live — go earn`,
            ];
            const castText = SHARE_TEXTS[Math.floor(Math.random() * SHARE_TEXTS.length)];

            await appActions.composeCast({ text: castText, embeds: [shareUrl] });
        } catch (err) {
            console.error('Share quest error:', err);
            try {
                await appActions.composeCast({
                    text: `@taskpay is where the smart money's at 🔥\nComplete quests, earn G$ & USDC. Simple as that.`,
                    embeds: [APP_URL || ''],
                });
            } catch (fallbackErr) {
                console.error('Fallback share failed:', fallbackErr);
            }
        } finally {
            setSharingTaskId(null);
        }
    };

    let totalCompletedUsers = 0;
    let totalRewardsDistributed = 0;
    if (filter === 'completed') {
        const uniqueUsers = new Set<number>();
        visibleTasks.forEach(t => {
            if (Array.isArray(t.completedBy)) {
                t.completedBy.forEach((fid: number) => uniqueUsers.add(fid));
            }
            totalRewardsDistributed += Number(t.totalBudget ?? t.remainingBudget ?? t.rewardAmount ?? 0);
        });
        totalCompletedUsers = uniqueUsers.size;
    }

    // ─── Loading State ──────────────────────────────────────────────
    if (isLoading) return (
        <div className="flex flex-col justify-center items-center min-h-[60vh] w-full">
            <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
            <span className="text-sm text-gray-400 font-medium">Finding Quest...</span>
        </div>
    );

    const showCompletedLoading = filter === 'completed' && completedLoading;

    // ─── Empty state copy (used inside main layout when no tasks) ─────
    const emptyTitle = filter === 'filled'
        ? 'No filled quests yet'
        : filter === 'completed'
            ? 'No completed quests yet'
            : "You're all caught up!";
    const emptySubtitle = filter === 'filled'
        ? 'You can still join active quests before slots are taken.'
        : filter === 'completed'
            ? 'Once you finish a quest it will show up here.'
            : 'No quests right now. Check back soon for rewards.';

    const emptyStateEl = (
        <div className="flex flex-col justify-center items-center flex-1 min-h-[50vh] w-full px-6 text-center animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-5">
                <FontAwesomeIcon icon={faCheck} className="text-3xl text-gray-300" />
            </div>
            <h2 className="text-xl font-bold text-black mb-2 flex items-center justify-center gap-2">
                <FontAwesomeIcon icon={faStar} className="text-amber-400" />
                {emptyTitle}
            </h2>
            <p className="text-gray-400 text-base">{emptySubtitle}</p>
        </div>
    );

    return (
        <div className="w-full flex flex-col animate-fade-in min-h-[calc(90vh-7rem)]">
            {/* Completed Stats Banner */}
            {filter === 'completed' && !showCompletedLoading && visibleTasks.length > 0 && (
                <div className="px-5 pb-3 flex-shrink-0 animate-fade-in">
                    <div className="flex bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-sm rounded-2xl divide-x divide-gray-100 overflow-hidden">
                        <div className="flex-1 py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-1 text-gray-400">
                                <FontAwesomeIcon icon={faUsers} className="text-xs" />
                                <div className="text-[11px] font-bold uppercase tracking-widest">Users</div>
                            </div>
                            <div className="text-xl font-black text-black">{totalCompletedUsers}</div>
                        </div>
                        <div className="flex-1 py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5 mb-1 text-emerald-500/70">
                                <FontAwesomeIcon icon={faCoins} className="text-xs" />
                                <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Rewards</div>
                            </div>
                            <div className="text-xl font-black text-emerald-600 flex items-baseline justify-center gap-0.5">
                                {totalRewardsDistributed.toFixed(0)}<span className="text-xs font-bold text-emerald-600/60 uppercase">Rewards</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content: loading (completed tab) | empty state | task list */}
            {showCompletedLoading ? (
                <div className="flex flex-col justify-center items-center flex-1 min-h-[50vh] w-full">
                    <div className="w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin mb-4" />
                    <span className="text-sm text-gray-400 font-medium">Loading completed quests…</span>
                </div>
            ) : visibleTasks.length === 0 ? (
                emptyStateEl
            ) : (
                <div className="flex-1 flex min-h-0 relative">
                    <div
                        ref={scrollRef}
                        className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden gap-4 py-4 no-scrollbar"
                    >
                        {filter === 'completed'
                            ? visibleTasks.map((item: any, index: number) => (
                                <div
                                    key={item._id ?? index}
                                    className="w-full flex items-center justify-center px-4"
                                >
                                    <CompletedTaskCard
                                        completion={{ taskId: item._id }}
                                        task={item}
                                        profiles={profiles}
                                        onShowCompleters={(completions, perUser, token) => setCompletedByPopupData({ completions, perUser, token })}
                                    />
                                </div>
                            ))
                            : visibleTasks.map((task, index) => (
                                <div
                                    key={task._id}
                                    className="w-full flex items-center justify-center px-4 py-3"
                                >
                                    <TaskCard
                                        task={task}
                                        profiles={profiles}
                                        isActive={true}
                                        alwaysActiveStyle={true}
                                        onDoTask={openTaskAction}
                                        onVerify={handleOpenVerifyModal}
                                        onShare={handleShareTask}
                                        verifyingTaskId={verifyingTaskId}
                                        verifyError={verifyError}
                                        sharingTaskId={sharingTaskId}
                                        userFid={activeFid}
                                        eligibilityResult={eligibilityByTaskId[String(task._id)] ?? null}
                                        onCheckEligibility={handleCheckEligibility}
                                        onShowCompleters={fetchAndShowCompleters}
                                    />
                                </div>
                            ))}
                    </div>
                    {/* Dots removed */}
                </div>
            )}

            {/* Hint: Pop-up toast removed */}
            <AnimatePresence>
            </AnimatePresence>

            {/* No ETH Modal */}
            <AnimatePresence>
                {noEthModalTask && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => setNoEthModalTask(null)}
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
                                {/* Alert icon */}
                                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-100">
                                    <FontAwesomeIcon icon={faCoins} className="text-3xl text-amber-500" />
                                </div>
                                <h3 className="text-xl font-black text-black mb-2">Gas Needed: ARB ETH</h3>

                                <p className="text-gray-500 text-sm mb-6">
                                    This quest requires on-chain verification. You currently have 0 ARB ETH in your wallet to cover the gas fees. Please get some ARB ETH and try again.
                                </p>

                                <button
                                    onClick={async () => {
                                        if (!appActions.swapToken || !address || !publicClient) return;
                                        try {
                                            await appActions.swapToken({ buyToken: 'eip155:42161/native' });
                                            const balance = await publicClient.getBalance({ address });
                                            if (balance > BigInt(0)) {
                                                const t = noEthModalTask;
                                                setNoEthModalTask(null);
                                                setVerifyError(null);
                                                setVerifyModalChecks({});
                                                setVerifyModalTask(t);
                                            } else {
                                                setVerifyError("Balance is still 0 after swap. Try again.");
                                            }
                                        } catch (error) {
                                            console.error('Swap failed:', error);
                                        }
                                    }}
                                    className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 bg-black hover:bg-gray-800 transition-all active:scale-[0.98] shadow-lg"
                                >
                                    <FontAwesomeIcon icon={faArrowsLeftRight} /> Swap Token
                                </button>

                                {verifyError && (
                                    <p className="mt-3 text-red-500 text-sm font-semibold">{verifyError}</p>
                                )}

                                <button
                                    onClick={() => setNoEthModalTask(null)}
                                    className="mt-4 text-gray-400 text-sm font-semibold hover:text-black transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Verify checklist modal */}
            <AnimatePresence>
                {verifyModalTask && (
                    <VerifyModal
                        task={verifyModalTask}
                        profiles={profiles}
                        checks={verifyModalChecks}
                        isVerifying={verifyingTaskId === verifyModalTask._id}
                        verifyError={verifyError}
                        cooldownSecondsLeft={verifyCooldownSecondsLeft}
                        onDoAction={handleModalDoAction}
                        onVerify={handleModalVerify}
                        onClose={() => { setVerifyModalTask(null); setVerifyError(null); }}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {completedByPopupData && (
                    <CompletedByPopup
                        completions={completedByPopupData.completions}
                        perUser={completedByPopupData.perUser}
                        token={completedByPopupData.token}
                        onClose={() => setCompletedByPopupData(null)}
                    />
                )}
            </AnimatePresence>

            {/* Verified success modal */}
            <AnimatePresence>
                {showVerifySuccessModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                        onClick={() => { setShowVerifySuccessModal(false); setVerifiedTask(null); }}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                {/* Success icon */}
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-100">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-4xl text-green-500" />
                                </div>
                                <h3 className="text-2xl font-black text-black mb-1">Quest Completed! 🎉</h3>



                                {/* Task description */}
                                {verifiedTask && (
                                    <p className="text-gray-500 text-sm mb-2 line-clamp-2 px-2">
                                        {String(verifiedTask.description || getTypeTitle(verifiedTask))}
                                    </p>
                                )}

                                <p className="text-gray-400 text-sm mb-6">Share your achievement & hype your friends to earn!</p>

                                {/* Share button */}
                                <button
                                    type="button"
                                    disabled={isSharing}
                                    onClick={async () => {
                                        if (!appActions.composeCast || !verifiedTask) return;
                                        setIsSharing(true);
                                        try {
                                            const creatorProfile = typeof verifiedTask.creatorFid === 'number'
                                                ? profiles[verifiedTask.creatorFid] as { username?: string; display_name?: string; pfp_url?: string } | undefined
                                                : undefined;
                                            const reward = Number(verifiedTask.totalBudget ?? verifiedTask.remainingBudget ?? verifiedTask.rewardAmount ?? 0);

                                            const imageData: TaskShareImageData = {
                                                taskType: verifiedTask.type || 'follow',
                                                taskDescription: String(verifiedTask.description || getTypeTitle(verifiedTask)),
                                                rewardAmount: reward,
                                                creatorUsername: creatorProfile?.username || 'user',
                                                creatorPfpUrl: creatorProfile?.pfp_url || '',
                                                creatorDisplayName: creatorProfile?.display_name || creatorProfile?.username || 'Creator',
                                                targetUsername: verifiedTask.targetUsername,
                                                castText: (verifiedTask.castData as { text?: string } | undefined)?.text,
                                                miniappName: (verifiedTask.miniappData as { name?: string } | undefined)?.name,
                                                completedCount: verifiedTask.completedBy?.length,
                                                maxCompletions: verifiedTask.maxCompletions as number | undefined,
                                            };

                                            const imageBlob = await captureTaskShareImage(imageData);

                                            const formData = new FormData();
                                            formData.append('file', imageBlob, `taskpay-quest-${Date.now()}.png`);

                                            const uploadRes = await fetch('/api/ipfs/upload-image', { method: 'POST', body: formData });
                                            const uploadResult = await uploadRes.json();

                                            if (!uploadResult.success || !uploadResult.ipfsUrl) throw new Error('IPFS upload failed');

                                            const params = new URLSearchParams({ imageUrl: uploadResult.ipfsUrl });
                                            const shareUrl = `${window.location.origin}?${params.toString()}`;

                                            const SHARE_TEXTS = [
                                                `Just crushed another quest on @taskpay 🔥\n\nComplete quests. Get paid in G$ & USDC. Simple.`,
                                                `Another one ✅ Quest completed on @taskpay 💰\n\nYour turn — stop scrolling, start earning 👇`,
                                                `W after W on @taskpay 🚀\n\nJust finished a quest and got paid. Who's next?`,
                                                `Quest complete 💎 rewards secured via @taskpay\n\nThe easiest bag on Farcaster rn fr`,
                                                `Been grinding quests on @taskpay and it hits different 😤\n\nReal G$ & USDC, real engagement. Let's go.`,
                                            ];
                                            const castText = SHARE_TEXTS[Math.floor(Math.random() * SHARE_TEXTS.length)];

                                            await appActions.composeCast({ text: castText, embeds: [shareUrl] });
                                            setShowVerifySuccessModal(false);
                                            setVerifiedTask(null);
                                        } catch (err) {
                                            console.error('Share error:', err);
                                            // Fallback: share without image
                                            try {
                                                await appActions.composeCast({
                                                    text: `Just completed a quest on @taskpay 🔥\nEarn G$ & USDC for real engagement — quests are live!`,
                                                    embeds: [APP_URL || ''],
                                                });
                                                setShowVerifySuccessModal(false);
                                                setVerifiedTask(null);
                                            } catch (fallbackErr) {
                                                console.error('Fallback share failed:', fallbackErr);
                                            }
                                        } finally {
                                            setIsSharing(false);
                                        }
                                    }}
                                    className={`w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg ${isSharing ? 'bg-gray-700 cursor-wait' : 'bg-black hover:bg-gray-800'
                                        }`}
                                >
                                    {isSharing ? (
                                        <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Generating...</>
                                    ) : (
                                        <><FontAwesomeIcon icon={faShareNodes} /> Share & Flex 🔥</>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowVerifySuccessModal(false); setVerifiedTask(null); }}
                                    className="mt-4 text-gray-400 text-sm font-semibold hover:text-black transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {platformConnectTask && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-4"
                        onClick={() => setPlatformConnectTask(null)}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 40, opacity: 0 }}
                            className="bg-white rounded-2xl p-5 w-full max-w-md shadow-xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold mb-2">Connect account</h3>
                            <p className="text-sm text-gray-500 mb-4">
                                {String(platformConnectTask.type).startsWith('x_')
                                    ? 'Link your X account to verify this quest.'
                                    : 'Link your Farcaster account to verify this quest.'}
                            </p>
                            {String(platformConnectTask.type).startsWith('x_') ? (
                                <ConnectX />
                            ) : (
                                <ConnectFarcaster />
                            )}
                            <button
                                type="button"
                                className="mt-4 w-full py-2 text-sm text-gray-500"
                                onClick={() => setPlatformConnectTask(null)}
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

