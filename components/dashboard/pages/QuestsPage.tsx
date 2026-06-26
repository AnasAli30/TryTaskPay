'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBullseye, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { useQuestFeed, type PlatformFilter } from '@/components/hooks/useQuestFeed';
import { QuestFilters } from '@/components/dashboard/QuestFilters';
import { QuestGridCard } from '@/components/dashboard/QuestGridCard';
import { PlatformConnectDialog, VerifyDialog } from '@/components/dashboard/QuestDialogs';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { getTypeTitle, type QuestTask } from '@/lib/questHelpers';

export function QuestsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifyTaskId = searchParams.get('verify');
  const openedVerifyRef = useRef<string | null>(null);

  const { siweVerified } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const [platform, setPlatform] = useState<PlatformFilter>('all');

  const feed = useQuestFeed({ platformFilter: platform });
  const {
    visibleTasks,
    displayQuestCount,
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
    platformConnectTask,
    setPlatformConnectTask,
    openTaskAction,
    handleOpenVerifyModal,
    handleModalVerify,
    handleCheckEligibility,
    showVerifySuccessModal,
    setShowVerifySuccessModal,
    isTaskCompletedForUser,
    isTaskFull,
    customOpenedTaskIds,
  } = feed;

  useEffect(() => {
    if (!siweVerified || !verifyTaskId || isLoading || openedVerifyRef.current === verifyTaskId) return;
    const task = visibleTasks.find((t) => String(t._id) === verifyTaskId);
    if (!task || isTaskCompletedForUser(task)) return;
    openedVerifyRef.current = verifyTaskId;
    handleOpenVerifyModal(task);
    router.replace('/app/quests', { scroll: false });
  }, [siweVerified, verifyTaskId, isLoading, visibleTasks, handleOpenVerifyModal, router, isTaskCompletedForUser]);

  const getCreatorProfile = (task: QuestTask) => {
    const fid = task.creatorFid as number | undefined;
    if (!fid) return undefined;
    return profiles[fid] as { username?: string; display_name?: string; pfp_url?: string } | undefined;
  };

  const getTargetProfile = (task: QuestTask) => {
    const fid = task.targetFid as number | undefined;
    if (!fid) return undefined;
    return profiles[fid] as { username?: string; display_name?: string; pfp_url?: string } | undefined;
  };

  if (!siweVerified) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faBullseye} className="text-2xl text-violet-700" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3">Browse Quests</h1>
        <p className="text-gray-500 mb-8">Sign in with your wallet to discover quests and earn G$ & USDC rewards.</p>
        <button
          type="button"
          onClick={openAuthGate}
          className="px-8 py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 transition-colors"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Quests</h1>
        <p className="text-gray-500">
          {filter === 'completed'
            ? 'Quests with verified completions — rewards have been distributed.'
            : 'Complete tasks on Farcaster and X to earn G$ & USDC rewards.'}
        </p>
      </div>

      <QuestFilters
        filter={filter}
        onFilterChange={setFilter}
        platform={platform}
        onPlatformChange={setPlatform}
        count={displayQuestCount}
        countLabel={
          filter === 'completed'
            ? `${displayQuestCount.toLocaleString()} quests`
            : undefined
        }
      />

      {isLoading || (filter === 'completed' && completedLoading) ? (
        <div className="flex flex-col items-center justify-center py-24">
          <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300 mb-4" />
          <p className="text-sm text-gray-400">Loading quests…</p>
        </div>
      ) : visibleTasks.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-dashed border-gray-200 bg-white/50">
          <p className="text-lg font-bold text-gray-400">No quests found</p>
          <p className="text-sm text-gray-400 mt-1">
            {filter === 'completed' ? 'No verified quests yet.' : 'Check back soon for new opportunities.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {visibleTasks.map((task) => {
            const taskId = String(task._id);
            const userCompleted = isTaskCompletedForUser(task);
            return (
              <QuestGridCard
                key={taskId}
                task={task}
                filter={filter}
                creatorProfile={getCreatorProfile(task)}
                targetProfile={getTargetProfile(task)}
                isUserCompleted={userCompleted}
                isFull={isTaskFull(task)}
                eligibilityResult={userCompleted ? null : (eligibilityByTaskId[taskId] ?? null)}
                onAction={() => openTaskAction(task)}
                onVerify={() => handleOpenVerifyModal(task)}
                onCheckEligibility={() => handleCheckEligibility(task)}
                verifying={verifyingTaskId === taskId}
                customTaskOpened={!!customOpenedTaskIds[taskId]}
              />
            );
          })}
        </div>
      )}

      <PlatformConnectDialog task={platformConnectTask} onClose={() => setPlatformConnectTask(null)} />

      <VerifyDialog
        open={!!verifyModalTask}
        error={verifyError}
        verifying={!!verifyingTaskId}
        onVerify={handleModalVerify}
        onClose={() => {
          setVerifyModalTask(null);
          setVerifyError(null);
        }}
        title={verifyModalTask ? getTypeTitle(verifyModalTask) : undefined}
        isCustomOnchain={verifyModalTask?.type === 'custom_onchain'}
      />

      {showVerifySuccessModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl p-8 max-w-sm text-center shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <FontAwesomeIcon icon={faBullseye} className="text-2xl text-emerald-600" />
            </div>
            <h3 className="text-xl font-black mb-2">Quest verified!</h3>
            <p className="text-sm text-gray-500 mb-6">Your reward is ready to claim from your profile.</p>
            <button
              type="button"
              onClick={() => setShowVerifySuccessModal(false)}
              className="w-full py-3 rounded-xl bg-black text-white font-bold"
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
