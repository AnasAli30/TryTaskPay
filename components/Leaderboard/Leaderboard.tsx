"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowTrendUp,
    faArrowTrendDown,
    faUsers,
    faWallet,
    faSpinner,
    faArrowUpRightFromSquare,
    faCoins,
    faCalendarAlt,
    faXmark,
} from "@fortawesome/free-solid-svg-icons";
import axios from "axios";
import { useFrame } from "@/components/farcaster-provider";

// ─── Pro Badge SVG ──────────────────────────────────────────────────
function ProBadge({ size = 14 }: { size?: number }) {
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

const PAGE_SIZE = 25;
const SCROLL_LOAD_THRESHOLD = 180;

interface EarnerRow {
    fid: number;
    totalEarned: number;
    claims: number;
    userUsername?: string;
    userDisplayName?: string;
    userPfpUrl?: string;
    isPro?: boolean;
    neynarScore?: number;
}

interface CreatorRow {
    fid: number;
    totalSpent: number;
    taskCount: number;
    creatorUsername?: string;
    creatorDisplayName?: string;
    creatorPfpUrl?: string;
    isPro?: boolean;
    neynarScore?: number;
}

type Tab = "earners" | "creators";

function mergeProfiles<T extends { fid: number }>(
    rows: T[],
    profileKey: "user" | "creator",
    profileMap: Record<number, { username?: string; display_name?: string; pfp_url?: string; isPro?: boolean; neynarScore?: number }>
): T[] {
    return rows.map((row) => {
        const p = profileMap[row.fid];
        if (!p) return row;
        if (profileKey === "user") {
            return {
                ...row,
                userUsername: (row as any).userUsername || p.username,
                userDisplayName: (row as any).userDisplayName || p.display_name,
                userPfpUrl: (row as any).userPfpUrl || p.pfp_url,
                isPro: p.isPro,
                neynarScore: p.neynarScore,
            };
        }
        return {
            ...row,
            creatorUsername: p.username,
            creatorDisplayName: p.display_name,
            creatorPfpUrl: p.pfp_url,
            isPro: p.isPro,
            neynarScore: p.neynarScore,
        };
    });
}

async function fetchProfiles(fids: number[]) {
    if (fids.length === 0) return {} as Record<number, { username?: string; display_name?: string; pfp_url?: string; isPro?: boolean; neynarScore?: number }>;
    const bulk = await axios.get(`/api/neynar/users/bulk?fids=${fids.join(",")}`);
    const map: Record<number, { username?: string; display_name?: string; pfp_url?: string; isPro?: boolean; neynarScore?: number }> = {};
    (bulk.data?.users || []).forEach((u: any) => {
        if (typeof u.fid === "number") {
            const proStatus = u.pro?.status;
            map[u.fid] = {
                username: u.username,
                display_name: u.display_name,
                pfp_url: u.pfp_url,
                isPro: proStatus === 'subscribed' || proStatus === 'active',
                neynarScore: typeof u.score === "number" ? u.score : u.experimental?.neynar_user_score,
            };
        }
    });
    return map;
}

interface UserEarningItem {
    taskId: string;
    taskType?: string | null;
    taskDescription?: string | null;
    amount: number;
    claimedAt?: string | null;
    submittedAt?: string | null;
    claimTxHash?: string | null;
}

interface LeaderboardUserDetails {
    fid: number;
    totalEarned: number;
    claims: number;
    earnings: UserEarningItem[];
    totalSpent?: number;
    taskCount?: number;
    creatorTasks?: Array<{
        taskId: string;
        taskType?: string | null;
        taskDescription?: string | null;
        amount: number;
        createdAt?: string | null;
        status?: string | null;
    }>;
}

function getTaskTypePill(type?: string | null): { label: string; cls: string } {
    switch ((type || "").toLowerCase()) {
        case "follow":
            return { label: "Follow", cls: "bg-blue-50 text-blue-700 border-blue-200" };
        case "boost_lite":
            return { label: "Boost", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" };
        case "boost":
            return { label: "Amplify", cls: "bg-pink-50 text-pink-700 border-pink-200" };
        case "quote":
            return { label: "Quote", cls: "bg-purple-50 text-purple-700 border-purple-200" };
        case "multi":
            return { label: "Multi", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" };
        case "channel":
            return { label: "Channel", cls: "bg-amber-50 text-amber-700 border-amber-200" };
        case "miniapp":
            return { label: "Mini App", cls: "bg-rose-50 text-rose-700 border-rose-200" };
        default:
            return { label: "Task", cls: "bg-gray-50 text-gray-700 border-gray-200" };
    }
}

export default function Leaderboard() {
    const { context, actions } = useFrame();
    const viewerFid = context?.user?.fid;
    const [tab, setTab] = useState<Tab>("earners");
    const [topEarners, setTopEarners] = useState<EarnerRow[]>([]);
    const [topCreators, setTopCreators] = useState<CreatorRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMoreEarners, setHasMoreEarners] = useState(false);
    const [hasMoreCreators, setHasMoreCreators] = useState(false);
    const [selectedUser, setSelectedUser] = useState<(EarnerRow | CreatorRow) | null>(null);
    const [selectedUserTab, setSelectedUserTab] = useState<Tab>("earners");
    const [selectedUserDetails, setSelectedUserDetails] = useState<LeaderboardUserDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const loadPage = useCallback(async (type: "earners" | "creators", skip: number, append: boolean) => {
        const res = await axios.get(`/api/leaderboard?type=${type}&skip=${skip}&limit=${PAGE_SIZE}`);
        if (type === "earners") {
            let list: EarnerRow[] = res.data.topEarners || [];
            const fids = list.filter((e) => !e.userPfpUrl || !e.userDisplayName || !e.userUsername).map((e) => e.fid);
            if (fids.length > 0) {
                const profileMap = await fetchProfiles(fids);
                list = mergeProfiles(list, "user", profileMap) as EarnerRow[];
            }
            setTopEarners((prev) => (append ? [...prev, ...list] : list));
            setHasMoreEarners(!!res.data.hasMore);
        } else {
            let list: CreatorRow[] = res.data.topCreators || [];
            if (list.length > 0) {
                const profileMap = await fetchProfiles(list.map((c) => c.fid));
                list = mergeProfiles(list, "creator", profileMap) as CreatorRow[];
            }
            setTopCreators((prev) => (append ? [...prev, ...list] : list));
            setHasMoreCreators(!!res.data.hasMore);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const res = await axios.get("/api/leaderboard");
                let earners: EarnerRow[] = res.data.topEarners || [];
                let creators: CreatorRow[] = res.data.topCreators || [];
                const fidsToFetch = new Set<number>();
                earners.forEach((e) => { if (!e.userPfpUrl || !e.userDisplayName || !e.userUsername) fidsToFetch.add(e.fid); });
                creators.forEach((c) => fidsToFetch.add(c.fid));
                if (fidsToFetch.size > 0) {
                    try {
                        const profileMap = await fetchProfiles(Array.from(fidsToFetch));
                        earners = mergeProfiles(earners, "user", profileMap) as EarnerRow[];
                        creators = mergeProfiles(creators, "creator", profileMap) as CreatorRow[];
                    } catch (e) { console.warn("Neynar bulk fallback failed", e); }
                }
                if (!cancelled) {
                    setTopEarners(earners);
                    setTopCreators(creators);
                    setHasMoreEarners(!!res.data.hasMoreEarners);
                    setHasMoreCreators(!!res.data.hasMoreCreators);
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message || "Failed to load leaderboard");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const loadMore = useCallback(async () => {
        if (loadingMore) return;
        if (tab === "earners" && !hasMoreEarners) return;
        if (tab === "creators" && !hasMoreCreators) return;
        setLoadingMore(true);
        try {
            const skip = tab === "earners" ? topEarners.length : topCreators.length;
            await loadPage(tab, skip, true);
        } catch (e) { console.error("Load more failed", e); } finally {
            setLoadingMore(false);
        }
    }, [tab, loadingMore, hasMoreEarners, hasMoreCreators, topEarners.length, topCreators.length, loadPage]);

    const onScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el || loadingMore) return;
        const { scrollTop, clientHeight, scrollHeight } = el;
        if (scrollTop + clientHeight >= scrollHeight - SCROLL_LOAD_THRESHOLD) {
            if (tab === "earners" && hasMoreEarners) loadMore();
            else if (tab === "creators" && hasMoreCreators) loadMore();
        }
    }, [tab, hasMoreEarners, hasMoreCreators, loadingMore, loadMore]);

    const rows = tab === "earners" ? topEarners : topCreators;
    const hasMore = tab === "earners" ? hasMoreEarners : hasMoreCreators;

    const openUserModal = useCallback(async (row: EarnerRow | CreatorRow) => {
        setSelectedUser(row);
        setSelectedUserTab(tab);
        setSelectedUserDetails(null);
        setDetailsError(null);
        setDetailsLoading(true);
        try {
            const res = await axios.get(`/api/leaderboard/user-details?fid=${row.fid}&type=${tab}`);
            setSelectedUserDetails(res.data as LeaderboardUserDetails);
        } catch (e: any) {
            setDetailsError(e?.message || "Failed to load user details");
        } finally {
            setDetailsLoading(false);
        }
    }, [tab]);

    const closeModal = useCallback(() => {
        setSelectedUser(null);
        setSelectedUserTab("earners");
        setSelectedUserDetails(null);
        setDetailsError(null);
        setDetailsLoading(false);
    }, []);

    return (
        <div className="w-full max-w-xl mx-auto px-4 py-6 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-black flex items-center gap-2">
                        {tab === "earners" ? "Top Earners" : "Top Creators"}
                    </h2>
                </div>
                <div className="flex bg-gray-100/60 rounded-[14px] p-1 gap-1 shadow-inner backdrop-blur-md relative border border-gray-200/50">
                    {[
                        { id: "earners", label: "Earners", icon: faWallet },
                        { id: "creators", label: "Creators", icon: faUsers }
                    ].map((t) => {
                        const isSelected = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id as Tab)}
                                className={`relative flex-1 py-1.5 px-3 rounded-xl text-[11px] font-bold transition-colors z-10 focus:outline-none flex items-center justify-center gap-1.5 min-w-[70px] ${isSelected ? "text-black" : "text-gray-500 hover:text-gray-800"}`}
                            >
                                {isSelected && (
                                    <motion.div
                                        layoutId="leaderboardTab"
                                        className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/5 z-[-1]"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                                    />
                                )}
                                <FontAwesomeIcon icon={t.icon} className={`text-[10px] ${isSelected ? 'text-black' : 'opacity-70'}`} />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* States */}
            {loading && (
                <div className="flex flex-col items-center justify-center py-10">
                    <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-xs text-gray-400 font-medium">Loading leaderboard…</p>
                </div>
            )}

            {!loading && error && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium px-3 py-2 rounded-2xl text-center">
                    {error}
                </div>
            )}

            {!loading && !error && rows.length === 0 && (
                <div className="bg-gray-50 border border-gray-100 rounded-2xl py-8 px-4 text-center">
                    <p className="text-sm font-medium text-gray-500 mb-1">
                        No data yet.
                    </p>
                    <p className="text-xs text-gray-400">
                        As users start earning and creators launch quests, they’ll appear here.
                    </p>
                </div>
            )}

            {!loading && !error && rows.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-12rem)]">
                    <div className="bg-gray-50/80 border-b border-gray-100 px-4 py-2 flex items-center text-[11px] text-gray-400 font-semibold uppercase tracking-wide shrink-0">
                        <div className="w-8">Rank</div>
                        <div className="flex-1">User</div>
                        <div className="w-24 text-right">
                            {tab === "earners" ? "Earned" : "Spent"}
                        </div>
                        {tab === "creators" && (
                            <div className="w-20 text-right">
                                Quests
                            </div>
                        )}
                    </div>
                    <div
                        ref={scrollRef}
                        onScroll={onScroll}
                        className="overflow-y-auto overflow-x-hidden flex-1 min-h-0"
                    >
                        <AnimatePresence initial={false}>
                            {rows.map((row, idx) => {
                                const isViewer = viewerFid && row.fid === viewerFid;
                                const isTop3 = idx < 3;
                                const displayName = tab === "earners"
                                    ? ((row as EarnerRow).userDisplayName || (row as EarnerRow).userUsername || `FID ${row.fid}`)
                                    : ((row as CreatorRow).creatorDisplayName || (row as CreatorRow).creatorUsername || `FID ${row.fid}`);
                                const username = tab === "earners"
                                    ? ((row as EarnerRow).userUsername || `fid_${row.fid}`)
                                    : ((row as CreatorRow).creatorUsername || `fid_${row.fid}`);
                                const pfpUrl = tab === "earners" ? (row as EarnerRow).userPfpUrl : (row as CreatorRow).creatorPfpUrl;

                                const value =
                                    tab === "earners"
                                        ? (row as EarnerRow).totalEarned
                                        : (row as CreatorRow).totalSpent;
                                const secondary =
                                    tab === "earners"
                                        ? (row as EarnerRow).claims
                                        : (row as CreatorRow).taskCount;

                                return (
                                    <motion.div
                                        key={`${tab}-${row.fid}`}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => openUserModal(row as EarnerRow | CreatorRow)}
                                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openUserModal(row as EarnerRow | CreatorRow); } }}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                                        className={`px-4 py-2.5 flex items-center text-xs cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                                            } ${isViewer ? "relative" : ""}`}
                                    >
                                        {isViewer && (
                                            <div className="absolute inset-0 rounded-2xl border border-amber-200 pointer-events-none" />
                                        )}
                                        <div className="w-8 flex items-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${isTop3
                                                ? idx === 0
                                                    ? "bg-amber-400 text-white"
                                                    : idx === 1
                                                        ? "bg-gray-300 text-white"
                                                        : "bg-amber-200 text-white"
                                                : "bg-gray-100 text-gray-500"
                                                }`}>
                                                {idx + 1}
                                            </span>
                                        </div>
                                        <div className="flex-1 flex items-center gap-2 min-w-0">
                                            <div className="relative shrink-0">
                                                {pfpUrl ? (
                                                    <img
                                                        src={pfpUrl}
                                                        alt=""
                                                        className="w-7 h-7 rounded-full object-cover ring-1 ring-gray-100"
                                                    />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] text-gray-400 font-semibold">
                                                        {displayName[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                {(row as any).isPro && (
                                                    <div className="absolute -bottom-1 -right-1 z-10" title="Farcaster Pro">
                                                        <ProBadge size={11} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <span className={`font-semibold truncate ${isViewer ? "text-black" : "text-gray-900"}`}>
                                                        {displayName}
                                                    </span>
                                                    {isViewer && (
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-gray-400 truncate">
                                                    @{username}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-24 text-right font-mono text-[11px] text-gray-900">
                                           +{value.toFixed(2)}
                                        </div>
                                        {tab === "creators" && (
                                            <div className="w-20 text-right text-[11px] text-gray-500 font-mono flex items-center justify-end gap-1">
                                                {secondary}
                                                <FontAwesomeIcon
                                                    icon={faArrowTrendDown}
                                                    className="text-[9px] text-blue-500"
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                        {loadingMore && (
                            <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-sm" />
                                <span className="text-xs font-medium">Loading more…</span>
                            </div>
                        )}
                        {!loadingMore && rows.length > 0 && !hasMore && (
                            <div className="text-center py-3 text-xs text-gray-400 font-medium">
                                All loaded
                            </div>
                        )}
                    </div>
                </div>
            )}

            <AnimatePresence>
                {selectedUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
                        onClick={closeModal}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0, scale: 0.98 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 24, opacity: 0, scale: 0.98 }}
                            transition={{ type: "spring", damping: 24, stiffness: 260 }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
                        >
                            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                            <div className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {(selectedUserTab === "earners" ? (selectedUser as EarnerRow).userPfpUrl : (selectedUser as CreatorRow).creatorPfpUrl) ? (
                                            <img
                                                src={(selectedUserTab === "earners" ? (selectedUser as EarnerRow).userPfpUrl : (selectedUser as CreatorRow).creatorPfpUrl) || ""}
                                                alt=""
                                                className="w-14 h-14 rounded-2xl object-cover bg-gray-100 border border-gray-200"
                                            />
                                        ) : (
                                            <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg text-gray-500 font-black">
                                                {((selectedUserTab === "earners"
                                                    ? ((selectedUser as EarnerRow).userDisplayName || (selectedUser as EarnerRow).userUsername)
                                                    : ((selectedUser as CreatorRow).creatorDisplayName || (selectedUser as CreatorRow).creatorUsername)) || "?")[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-black text-black truncate">
                                                    {selectedUserTab === "earners"
                                                        ? ((selectedUser as EarnerRow).userDisplayName || (selectedUser as EarnerRow).userUsername || `FID ${selectedUser.fid}`)
                                                        : ((selectedUser as CreatorRow).creatorDisplayName || (selectedUser as CreatorRow).creatorUsername || `FID ${selectedUser.fid}`)}
                                                </h3>
                                                {(selectedUser as any).isPro && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold">
                                                        <ProBadge size={11} />
                                                        Pro
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 truncate">
                                                @{selectedUserTab === "earners" ? ((selectedUser as EarnerRow).userUsername || `fid_${selectedUser.fid}`) : ((selectedUser as CreatorRow).creatorUsername || `fid_${selectedUser.fid}`)}
                                            </p>
                                            <p className="text-[11px] text-gray-400 mt-0.5">FID {selectedUser.fid}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500"
                                    >
                                        <FontAwesomeIcon icon={faXmark} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                                        <p className="text-[10px] uppercase tracking-wide font-bold text-green-600">
                                            {selectedUserTab === "earners" ? "Total Earned" : "Total Spent"}
                                        </p>
                                        <p className="text-lg font-black text-green-700">
                                            {(selectedUserTab === "earners"
                                                ? (selectedUserDetails?.totalEarned ?? ((selectedUser as EarnerRow).totalEarned || 0))
                                                : (selectedUserDetails?.totalSpent ?? ((selectedUser as CreatorRow).totalSpent || 0))
                                            ).toFixed(4)}
                                        </p>
                                    </div>
                                    <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                                        <p className="text-[10px] uppercase tracking-wide font-bold text-indigo-600">Neynar Score</p>
                                        <p className="text-lg font-black text-indigo-700">
                                            {typeof (selectedUser as any).neynarScore === "number"
                                                ? (selectedUser as any).neynarScore.toFixed(2)
                                                : "N/A"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={async () => await actions?.viewProfile({ fid: selectedUser.fid })}
                                        className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800"
                                    >
                                        <FontAwesomeIcon icon={faUsers} className="text-xs" />
                                        View Profile
                                    </button>
                                </div>

                                <div className="pt-1">
                                    <h4 className="text-sm font-bold text-black mb-2 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
                                        {selectedUserTab === "earners" ? "Earnings Details" : "Created Tasks"}
                                    </h4>
                                    {detailsLoading && (
                                        <div className="space-y-2">
                                            {[1, 2, 3].map((n) => (
                                                <div key={n} className="rounded-xl border border-gray-100 bg-gray-50 p-3 animate-pulse">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="h-3.5 w-36 bg-gray-200 rounded mb-2" />
                                                            <div className="h-3 w-24 bg-gray-200 rounded" />
                                                        </div>
                                                        <div className="h-4 w-16 bg-gray-200 rounded" />
                                                    </div>
                                                    <div className="mt-2 h-8 w-full bg-gray-200 rounded-lg" />
                                                </div>
                                            ))}
                                            <div className="py-2 text-center text-xs text-gray-400">
                                                <FontAwesomeIcon icon={faSpinner} className="animate-spin mr-2" />
                                                Loading details...
                                            </div>
                                        </div>
                                    )}
                                    {!detailsLoading && detailsError && (
                                        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                                            {detailsError}
                                        </div>
                                    )}
                                    {!detailsLoading && !detailsError && (
                                        <div className="space-y-2">
                                            {(selectedUserTab === "earners" ? (selectedUserDetails?.earnings || []) : (selectedUserDetails?.creatorTasks || [])).length === 0 ? (
                                                <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3">
                                                    {selectedUserTab === "earners" ? "No claimed earnings yet." : "No created tasks found."}
                                                </div>
                                            ) : (
                                                (selectedUserTab === "earners" ? (selectedUserDetails?.earnings || []) : (selectedUserDetails?.creatorTasks || [])).map((item: any, i: number) => (
                                                    <div key={`${item.taskId}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="mb-1.5">
                                                                    {(() => {
                                                                        const pill = getTaskTypePill(item.taskType);
                                                                        return (
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${pill.cls}`}>
                                                                                {pill.label}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <p className="text-xs font-bold text-black truncate">
                                                                    {item.taskDescription || `${item.taskType || "quest"} task`}
                                                                </p>
                                                                <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                                    <FontAwesomeIcon icon={faCalendarAlt} className="text-[10px]" />
                                                                    {selectedUserTab === "earners"
                                                                        ? (item.claimedAt ? new Date(item.claimedAt).toLocaleString() : item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "Unknown date")
                                                                        : (item.createdAt ? new Date(item.createdAt).toLocaleString() : "Unknown date")}
                                                                </p>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <p className="text-sm font-black text-green-600">
                                                                    {selectedUserTab === "earners" ? item.amount.toFixed(4) : `-${item.amount.toFixed(4)}`}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        {selectedUserTab === "earners" && item.claimTxHash && (
                                                            <button
                                                                type="button"
                                                                onClick={async () => {
                                                                    const url = `https://arbiscan.io/tx/${item.claimTxHash}`;
                                                                    await actions?.openUrl?.(url);
                                                                }}
                                                                className="mt-2 w-full h-8 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1.5"
                                                            >
                                                                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
                                                                View claim tx on Arbiscan
                                                            </button>
                                                        )}
                                                     
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

