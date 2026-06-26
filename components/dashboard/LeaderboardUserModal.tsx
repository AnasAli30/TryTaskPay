'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faCalendarAlt,
  faCoins,
  faSpinner,
  faUsers,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useAppActions } from '@/components/hooks/useAppActions';

function ProBadge({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#855DCD"
        stroke="white"
        strokeWidth="2"
        d="M17 9c0 5-7 8-8 8S1 14 1 9 8 1 9 1s8 3 8 8z"
      />
      <path fill="#fff" d="M5.5 8.8l1.1 1.1 2.3-2.3 4.1 4.2 1.4-1.4-5.5-5.6-2.3 2.3-1.1-1.1z" />
    </svg>
  );
}

function getTaskTypePill(type?: string | null): { label: string; cls: string } {
  switch ((type || '').toLowerCase()) {
    case 'follow':
      return { label: 'Follow', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'boost_lite':
      return { label: 'Boost', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' };
    case 'boost':
      return { label: 'Amplify', cls: 'bg-pink-50 text-pink-700 border-pink-200' };
    case 'quote':
      return { label: 'Quote', cls: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'multi':
      return { label: 'Multi', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    case 'channel':
      return { label: 'Channel', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'miniapp':
      return { label: 'Mini App', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    default:
      return { label: 'Task', cls: 'bg-gray-50 text-gray-700 border-gray-200' };
  }
}

export interface LeaderboardRow {
  fid: number;
  totalEarned?: number;
  totalSpent?: number;
  claims?: number;
  taskCount?: number;
  userUsername?: string;
  userDisplayName?: string;
  userPfpUrl?: string;
  creatorUsername?: string;
  creatorDisplayName?: string;
  creatorPfpUrl?: string;
  isPro?: boolean;
  neynarScore?: number;
}

export interface LeaderboardUserDetails {
  fid: number;
  totalEarned?: number;
  totalSpent?: number;
  claims?: number;
  earnings?: Array<{
    taskId: string;
    taskType?: string | null;
    taskDescription?: string | null;
    amount: number;
    claimedAt?: string | null;
    submittedAt?: string | null;
    claimTxHash?: string | null;
  }>;
  creatorTasks?: Array<{
    taskId: string;
    taskType?: string | null;
    taskDescription?: string | null;
    amount: number;
    createdAt?: string | null;
    status?: string | null;
  }>;
}

interface LeaderboardUserModalProps {
  row: LeaderboardRow | null;
  tab: 'earners' | 'creators';
  details: LeaderboardUserDetails | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
}

export function LeaderboardUserModal({
  row,
  tab,
  details,
  loading,
  error,
  onClose,
}: LeaderboardUserModalProps) {
  const appActions = useAppActions();

  if (!row) return null;

  const pfp = tab === 'earners' ? row.userPfpUrl : row.creatorPfpUrl;
  const displayName =
    tab === 'earners'
      ? row.userDisplayName || row.userUsername || `FID ${row.fid}`
      : row.creatorDisplayName || row.creatorUsername || `FID ${row.fid}`;
  const username =
    tab === 'earners'
      ? row.userUsername || `fid_${row.fid}`
      : row.creatorUsername || `fid_${row.fid}`;

  const items =
    tab === 'earners' ? details?.earnings || [] : details?.creatorTasks || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 24, opacity: 0, scale: 0.98 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden"
        >
          <div className="h-1 bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600" />
          <div className="p-5 sm:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {pfp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pfp} alt="" className="w-14 h-14 rounded-2xl object-cover bg-gray-100 border border-gray-200" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center text-lg text-gray-500 font-black">
                    {displayName[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-black truncate">{displayName}</h3>
                    {row.isPro && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-bold">
                        <ProBadge size={11} />
                        Pro
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">@{username}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">FID {row.fid}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center shrink-0"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-green-50 border border-green-100 p-3">
                <p className="text-[10px] uppercase tracking-wide font-bold text-green-600">
                  {tab === 'earners' ? 'Total Earned' : 'Total Spent'}
                </p>
                <p className="text-lg font-black text-green-700">
                  {(tab === 'earners'
                    ? details?.totalEarned ?? row.totalEarned ?? 0
                    : details?.totalSpent ?? row.totalSpent ?? 0
                  ).toFixed(4)}{' '}
                  tokens
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <p className="text-[10px] uppercase tracking-wide font-bold text-indigo-600">Neynar Score</p>
                <p className="text-lg font-black text-indigo-700">
                  {typeof row.neynarScore === 'number' ? row.neynarScore.toFixed(2) : 'N/A'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => appActions.viewProfile({ fid: row.fid })}
              className="w-full h-10 rounded-xl bg-black text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
            >
              <FontAwesomeIcon icon={faUsers} className="text-xs" />
              View Farcaster Profile
            </button>

            <div className="pt-1">
              <h4 className="text-sm font-bold text-black mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
                {tab === 'earners' ? 'Earnings Details' : 'Created Tasks'}
              </h4>

              {loading && (
                <div className="py-8 text-center text-xs text-gray-400">
                  <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                  Loading details…
                </div>
              )}

              {!loading && error && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              {!loading && !error && items.length === 0 && (
                <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-3">
                  {tab === 'earners' ? 'No claimed earnings yet.' : 'No created tasks found.'}
                </div>
              )}

              {!loading && !error && items.length > 0 && (
                <div className="space-y-2">
                  {items.map((item, i) => {
                    const pill = getTaskTypePill(item.taskType);
                    const dateStr =
                      tab === 'earners'
                        ? 'claimedAt' in item && item.claimedAt
                          ? new Date(item.claimedAt).toLocaleString()
                          : 'submittedAt' in item && item.submittedAt
                            ? new Date(item.submittedAt).toLocaleString()
                            : 'Unknown date'
                        : 'createdAt' in item && item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : 'Unknown date';

                    return (
                      <div key={`${item.taskId}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${pill.cls}`}>
                              {pill.label}
                            </span>
                            <p className="text-xs font-bold text-black truncate mt-1.5">
                              {item.taskDescription || `${item.taskType || 'quest'} task`}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                              <FontAwesomeIcon icon={faCalendarAlt} className="text-[10px]" />
                              {dateStr}
                            </p>
                          </div>
                          <p className="text-sm font-black text-green-600 shrink-0">
                            {tab === 'earners' ? item.amount.toFixed(4) : `-${item.amount.toFixed(4)}`}
                          </p>
                        </div>
                        {tab === 'earners' && 'claimTxHash' in item && item.claimTxHash && (
                          <button
                            type="button"
                            onClick={() =>
                              appActions.openUrl?.(`https://arbiscan.io/tx/${item.claimTxHash}`)
                            }
                            className="mt-2 w-full h-8 rounded-lg bg-white border border-gray-200 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 flex items-center justify-center gap-1.5"
                          >
                            <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px]" />
                            View claim tx on Arbiscan
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
