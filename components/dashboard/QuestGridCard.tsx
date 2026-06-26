'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowUpRightFromSquare,
  faBolt,
  faCalendarDays,
  faCheck,
  faCircleCheck,
  faCircleQuestion,
  faCircleXmark,
  faClock,
  faCoins,
  faCrown,
  faShieldHalved,
  faSpinner,
  faStar,
  faTimes,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import {
  formatQuestCountdown,
  getQuestTypeConfig,
  getRewardTokenLabel,
  getChainBadgeLabel,
  getTypeTitle,
  CUSTOM_ONCHAIN_STEP_OPEN,
  CUSTOM_ONCHAIN_STEP_VERIFY,
  type EligibilityResult,
  type QuestFilter,
  type QuestTask,
} from '@/lib/questHelpers';
import { QuestTypeIcon } from '@/components/dashboard/QuestFilters';
import { XLogo } from '@/components/icons';

function useCountdown(expiresAt: unknown) {
  const [label, setLabel] = useState(() => formatQuestCountdown(expiresAt));
  useEffect(() => {
    const tick = () => setLabel(formatQuestCountdown(expiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return label;
}

interface QuestGridCardProps {
  task: QuestTask;
  filter: QuestFilter;
  onAction: () => void;
  onVerify: () => void;
  onCheckEligibility: () => void;
  verifying?: boolean;
  isUserCompleted?: boolean;
  isFull?: boolean;
  eligibilityResult?: EligibilityResult | null;
  creatorProfile?: { username?: string; display_name?: string; pfp_url?: string };
  targetProfile?: { username?: string; display_name?: string; pfp_url?: string };
  customTaskOpened?: boolean;
}

function QuestPreview({
  task,
  castData,
  miniappData,
  xTweetData,
  targetProfile,
}: {
  task: QuestTask;
  castData?: { text?: string; authorPfp?: string; authorDisplayName?: string; authorUsername?: string };
  miniappData?: { name?: string; description?: string; icon?: string; image?: string };
  xTweetData?: { text?: string; authorAvatar?: string; authorName?: string; authorUsername?: string };
  targetProfile?: { username?: string; display_name?: string; pfp_url?: string };
}) {
  const isX = String(task.type ?? '').startsWith('x_');

  const showCast =
    (task.type === 'boost_lite' || task.type === 'boost' || task.type === 'quote' || task.type === 'multi') &&
    castData;
  const showMiniapp = task.type === 'miniapp' && miniappData;
  const showTarget =
    (task.type === 'follow' || task.type === 'multi') && (targetProfile || task.targetUsername);
  const showXUser = (task.type === 'x_follow' || task.type === 'x_bundle') && task.xTargetUsername;
  const showXTweet =
    (task.type === 'x_boost_lite' || task.type === 'x_boost' || task.type === 'x_bundle') && xTweetData;
  const customMeta = task.customActionMeta as {
    appName?: string;
    appImageUrl?: string;
    actionName?: string;
    functionName?: string;
    contractAddress?: string;
  } | undefined;
  const showCustom = task.type === 'custom_onchain' && customMeta;

  if (!showCast && !showMiniapp && !showTarget && !showXUser && !showXTweet && !showCustom) return null;

  const accent = isX ? 'border-gray-400' : 'border-violet-400';

  return (
    <div className={`rounded-lg border border-gray-100 bg-gray-50/80 border-l-[3px] ${accent} px-3 py-2.5`}>
      {showCast && castData && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {castData.authorPfp && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={castData.authorPfp} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Cast</span>
            <span className="text-xs font-semibold text-gray-700 truncate">
              {castData.authorDisplayName || castData.authorUsername}
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{castData.text}</p>
        </div>
      )}

      {showMiniapp && miniappData && (
        <div className="flex items-center gap-2.5">
          {(miniappData.icon || miniappData.image) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={miniappData.icon || miniappData.image}
              alt=""
              className="w-8 h-8 rounded-md object-cover bg-white ring-1 ring-gray-200"
            />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Mini App</p>
            <p className="text-sm font-bold text-gray-800 truncate">{miniappData.name || 'Mini App'}</p>
            {miniappData.description && (
              <p className="text-xs text-gray-500 line-clamp-1">{miniappData.description}</p>
            )}
          </div>
        </div>
      )}

      {showTarget && (
        <div className="flex items-center gap-2.5">
          {targetProfile?.pfp_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={targetProfile.pfp_url} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-100" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">Target</p>
            <p className="text-sm font-bold text-gray-800 truncate">
              {targetProfile?.display_name || `@${task.targetUsername}`}
            </p>
          </div>
        </div>
      )}

      {showXUser && (
        <div className="flex items-center gap-2.5">
          {typeof task.xTargetAvatar === 'string' && task.xTargetAvatar && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={task.xTargetAvatar} alt="" className="w-8 h-8 rounded-full ring-1 ring-gray-200" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
              X target <XLogo size={10} />
            </p>
            <p className="text-sm font-bold text-gray-800">@{String(task.xTargetUsername)}</p>
            {typeof task.xTargetFollowers === 'number' && (
              <p className="text-xs text-gray-500">{task.xTargetFollowers.toLocaleString()} followers</p>
            )}
          </div>
        </div>
      )}

      {showXTweet && xTweetData && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            {xTweetData.authorAvatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={xTweetData.authorAvatar} alt="" className="w-4 h-4 rounded-full" />
            )}
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1">
              Post <XLogo size={10} />
            </span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{xTweetData.text}</p>
        </div>
      )}

      {showCustom && customMeta && (
        <div className="flex items-center gap-2.5">
          {customMeta.appImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customMeta.appImageUrl}
              alt=""
              className="w-8 h-8 rounded-md object-cover bg-white ring-1 ring-gray-200"
            />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-0.5">On-chain app</p>
            <p className="text-sm font-bold text-gray-800 truncate">
              {customMeta.actionName || customMeta.appName || 'Custom action'}
            </p>
            {(customMeta.functionName || customMeta.contractAddress) && (
              <p className="text-xs text-gray-500 line-clamp-1 font-mono">
                {customMeta.functionName
                  ? `Trigger: ${customMeta.functionName}`
                  : customMeta.contractAddress?.slice(0, 10) + '…'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function QuestGridCard({
  task,
  filter,
  onAction,
  onVerify,
  onCheckEligibility,
  verifying,
  isUserCompleted = false,
  isFull = false,
  eligibilityResult = null,
  creatorProfile,
  targetProfile,
  customTaskOpened = false,
}: QuestGridCardProps) {
  const tokenLabel = getRewardTokenLabel(task);
  const chainBadge = getChainBadgeLabel(task);
  const isGQuest = tokenLabel === 'G$';
  const config = getQuestTypeConfig(task.type as string);
  const countdown = useCountdown(task.expiresAt);
  const isX = String(task.type ?? '').startsWith('x_');
  const isCustomOnchain = task.type === 'custom_onchain';
  const isArchiveTab = filter === 'completed';
  const isUserDone = isUserCompleted && !isArchiveTab;
  const isExpired = countdown === 'Expired';

  const totalReward = Number(task.totalBudget ?? task.remainingBudget ?? task.rewardAmount ?? 0);
  const perUser = Number(
    task.rewardPerUser ??
      task.computedRewardPerUser ??
      (task.maxCompletions ? totalReward / (task.maxCompletions as number) : totalReward),
  );
  const completed = task.completedBy?.length ?? 0;
  const max = (task.maxCompletions as number) || 0;
  const progress = max > 0 ? Math.min(100, (completed / max) * 100) : 0;
  const slotsLeft = max > 0 ? Math.max(0, max - completed) : null;

  const castData = task.castData as {
    text?: string;
    authorPfp?: string;
    authorDisplayName?: string;
    authorUsername?: string;
  } | undefined;
  const miniappData = task.miniappData as {
    name?: string;
    description?: string;
    icon?: string;
    image?: string;
  } | undefined;
  const xTweetData = task.xTweetData as {
    text?: string;
    authorAvatar?: string;
    authorName?: string;
    authorUsername?: string;
  } | undefined;

  const creatorName =
    creatorProfile?.display_name ||
    creatorProfile?.username ||
    (task.creatorProfile as { displayName?: string; username?: string })?.displayName ||
    (task.creatorProfile as { displayName?: string; username?: string })?.username ||
    'Creator';
  const creatorPfp =
    creatorProfile?.pfp_url || (task.creatorProfile as { pfpUrl?: string })?.pfpUrl;

  const requirements: { icon: typeof faUsers; label: string; accent?: string }[] = [];
  if ((task.minFollowers as number) > 0) {
    requirements.push({ icon: faUsers, label: `${task.minFollowers}+ FC followers` });
  }
  if (task.minNeynarScore != null && (task.minNeynarScore as number) >= 0) {
    requirements.push({ icon: faStar, label: `Score ≥ ${Number(task.minNeynarScore).toFixed(2)}`, accent: 'text-amber-500' });
  }
  if (task.proSubscribersOnly) {
    requirements.push({ icon: faCrown, label: 'Pro only', accent: 'text-amber-600' });
  }
  if ((task.minAccountAgeDays as number) > 0) {
    requirements.push({ icon: faCalendarDays, label: `${task.minAccountAgeDays}d+ account` });
  }
  if ((task.minXFollowers as number) > 0) {
    requirements.push({ icon: faUsers, label: `${task.minXFollowers}+ X followers` });
  }
  if (task.nonSpamOnly) {
    requirements.push({ icon: faShieldHalved, label: 'Non-spam', accent: 'text-emerald-600' });
  }

  const accentBar = isUserDone
    ? 'bg-emerald-500'
    : isArchiveTab
      ? 'bg-gray-400'
      : isX
        ? 'bg-gray-900'
        : task.spotlight
          ? 'bg-gradient-to-b from-violet-600 to-blue-600'
          : 'bg-violet-500';

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md ${
        isUserDone
          ? 'border-emerald-200/90'
          : isArchiveTab
            ? 'border-gray-200/90 opacity-95'
            : isExpired
              ? 'border-red-200/80 opacity-95'
              : 'border-gray-200/90 hover:border-gray-300'
      }`}
    >
      {/* Left accent */}
      <div className={`absolute inset-y-0 left-0 w-1 ${accentBar}`} />

      {/* Header */}
      <div className="pl-5 pr-4 pt-4 pb-4 sm:pl-6 sm:pr-5 sm:pt-5 flex items-start justify-between gap-4 sm:gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                isX ? 'bg-gray-900 text-white' : 'bg-violet-100 text-violet-800'
              }`}
            >
              <QuestTypeIcon type={task.type as string} className="text-[10px]" />
              {config.label}
            </span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              {isCustomOnchain ? 'On-chain' : isX ? 'X' : 'Farcaster'}
            </span>
            {chainBadge && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                chainBadge === 'Celo' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
              }`}>
                {chainBadge}
              </span>
            )}
            {task.spotlight && !isUserDone && !isArchiveTab && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold">
                <FontAwesomeIcon icon={faStar} className="text-[9px]" />
                Featured
              </span>
            )}
            {isArchiveTab && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-[10px] font-bold">
                <FontAwesomeIcon icon={faCircleCheck} className="text-[9px]" />
                Verified
              </span>
            )}
            {isUserDone && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                <FontAwesomeIcon icon={faCircleCheck} className="text-[9px]" />
                Done
              </span>
            )}
            {isFull && !isUserDone && !isArchiveTab && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-bold">
                <FontAwesomeIcon icon={faTimes} className="text-[9px]" />
                Full
              </span>
            )}
            {isExpired && !isUserDone && !isArchiveTab && !isFull && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-bold">
                Ended
              </span>
            )}
          </div>

          <h3 className="font-black text-lg leading-snug tracking-tight line-clamp-2">
            {task.description ? String(task.description) : getTypeTitle(task)}
          </h3>

          <div className="flex items-center gap-2 mt-2 min-w-0">
            {creatorPfp ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={creatorPfp} alt="" className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-gray-200 shrink-0" />
            )}
            <span className="text-xs text-gray-500 truncate">
              <span className="text-gray-400">Creator · </span>
              <span className="font-semibold text-gray-700">{creatorName}</span>
            </span>
          </div>
        </div>

        <div className="shrink-0 self-stretch flex flex-col items-center justify-center px-4 sm:px-5 border-l border-gray-100 min-w-[5rem] sm:min-w-[5.5rem] text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">
            Pool
          </p>
          <p className="text-2xl sm:text-[1.75rem] font-black tabular-nums text-gray-900 leading-none tracking-tight">
            {Number.isInteger(totalReward) ? totalReward.toFixed(0) : totalReward.toFixed(2)}
          </p>
          <p className="text-[11px] font-semibold text-gray-400 mt-1.5">{tokenLabel}</p>
        </div>
      </div>

      {/* Metrics ribbon — earn · time · slots */}
      <div className="px-5 sm:px-6 pb-4">
        <div className="flex rounded-xl bg-gray-950 text-white overflow-hidden">
          <div className="flex-1 min-w-0 px-3 py-3.5 sm:px-5 sm:py-4 text-center border-r border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Earn</p>
            <p className="text-lg sm:text-xl font-black tabular-nums text-emerald-400 leading-none">
              {isGQuest ? perUser.toFixed(0) : perUser.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">{tokenLabel} each</p>
          </div>

          <div className="flex-1 min-w-0 px-3 py-3.5 sm:px-5 sm:py-4 text-center border-r border-white/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5 flex items-center justify-center gap-1">
              <FontAwesomeIcon icon={faClock} className="text-[10px]" />
              {isArchiveTab ? 'Status' : isUserDone ? 'Status' : 'Time'}
            </p>
            {isArchiveTab ? (
              <p className="text-sm sm:text-base font-bold text-gray-300 leading-none">Paid out</p>
            ) : isUserDone ? (
              <p className="text-sm sm:text-base font-bold text-emerald-400 leading-none">Completed</p>
            ) : countdown === '—' ? (
              <p className="text-sm sm:text-base font-bold text-gray-400 leading-none">—</p>
            ) : (
              <p
                className={`text-sm sm:text-base font-black font-mono tabular-nums leading-none tracking-tight ${
                  isExpired ? 'text-red-400' : 'text-white'
                }`}
              >
                {countdown}
              </p>
            )}
            {!isArchiveTab && !isUserDone && countdown !== '—' && (
              <p className="text-[11px] text-gray-500 mt-1.5">{isExpired ? 'Quest ended' : 'remaining'}</p>
            )}
          </div>

          <div className="flex-1 min-w-0 px-3 py-3.5 sm:px-5 sm:py-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Slots</p>
            <p className="text-lg sm:text-xl font-black tabular-nums leading-none">
              {completed}
              <span className="text-gray-500 font-bold text-sm sm:text-base">/{max || '∞'}</span>
            </p>
            <p className="text-[11px] text-gray-500 mt-1.5">
              {slotsLeft != null ? `${slotsLeft} left` : 'open'}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-5 sm:px-6 pb-3 space-y-3">
        <QuestPreview
          task={task}
          castData={castData}
          miniappData={miniappData}
          xTweetData={xTweetData}
          targetProfile={targetProfile}
        />

        {requirements.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {requirements.map((req) => (
              <span
                key={req.label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-600"
              >
                <FontAwesomeIcon icon={req.icon} className={`text-[10px] ${req.accent ?? 'text-gray-400'}`} />
                {req.label}
              </span>
            ))}
          </div>
        )}

        {max > 0 && (
          <div>
            <div className="flex justify-between text-[11px] font-semibold text-gray-400 mb-1">
              <span>Fill rate</span>
              <span className="tabular-nums">{Math.round(progress)}%</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isUserDone
                    ? 'bg-emerald-500'
                    : isArchiveTab
                      ? 'bg-gray-400'
                      : progress >= 90
                        ? 'bg-amber-500'
                        : 'bg-violet-500'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action footer — archive tab is read-only (payments already released) */}
      {!isArchiveTab && (
      <div className="mt-auto border-t border-gray-100 bg-gray-50/60 px-5 sm:px-6 py-3.5 sm:py-4">
        {isUserDone ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-sm font-bold">
              <FontAwesomeIcon icon={faCheck} />
              Quest completed
            </div>
            <Link
              href="/app/profile"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors"
            >
              <FontAwesomeIcon icon={faCoins} className="text-xs text-amber-400" />
              Claim on profile
            </Link>
          </div>
        ) : isFull ? (
          <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-200/60 text-gray-500 text-sm font-bold">
            <FontAwesomeIcon icon={faTimes} />
            All reward slots claimed
          </div>
        ) : (
          <div className="space-y-2">
            {isCustomOnchain && (
              <p className="text-[11px] text-gray-500 font-medium leading-snug">
                {customTaskOpened ? CUSTOM_ONCHAIN_STEP_VERIFY : CUSTOM_ONCHAIN_STEP_OPEN}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onAction}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-sm font-bold transition-colors ${
                  isCustomOnchain && customTaskOpened
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <FontAwesomeIcon
                  icon={isCustomOnchain && customTaskOpened ? faCheck : faArrowUpRightFromSquare}
                  className={`text-xs ${isCustomOnchain && customTaskOpened ? 'text-emerald-600' : 'text-gray-400'}`}
                />
                {isCustomOnchain && customTaskOpened ? 'Opened' : config.verb}
              </button>

              {eligibilityResult === null ? (
                <button
                  type="button"
                  onClick={onCheckEligibility}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-teal-200 bg-teal-50 text-teal-800 text-sm font-bold hover:bg-teal-100 transition-colors"
                >
                  <FontAwesomeIcon icon={faCircleQuestion} className="text-xs" />
                  Check eligibility
                </button>
              ) : eligibilityResult === 'loading' ? (
                <button
                  type="button"
                  disabled
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold"
                >
                  <FontAwesomeIcon icon={faSpinner} spin className="text-xs" />
                  Checking…
                </button>
              ) : eligibilityResult.eligible ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-bold">
                  <FontAwesomeIcon icon={faCircleCheck} className="text-xs" />
                  Eligible
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-2 px-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-center min-h-[42px]">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <FontAwesomeIcon icon={faCircleXmark} className="text-[10px]" />
                    Not eligible
                  </span>
                  {eligibilityResult.message && (
                    <span className="text-[10px] line-clamp-1 mt-0.5 opacity-90">{eligibilityResult.message}</span>
                  )}
                </div>
              )}
            </div>

            {eligibilityResult !== null && eligibilityResult !== 'loading' && eligibilityResult.eligible && (
              <button
                type="button"
                onClick={onVerify}
                disabled={verifying || (isCustomOnchain && !customTaskOpened)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    {isCustomOnchain ? 'Scanning wallet…' : 'Verifying on-chain…'}
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faBolt} className="text-xs text-amber-400" />
                    {isCustomOnchain ? 'Verify completion' : 'Submit verification'}
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </article>
  );
}
