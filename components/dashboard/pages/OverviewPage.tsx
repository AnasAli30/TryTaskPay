'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowRight,
  faBullseye,
  faCoins,
  faPlus,
  faSpinner,
  faTrophy,
  faWallet,
} from '@fortawesome/free-solid-svg-icons';
import { StatCard } from '@/components/dashboard/StatCard';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useProfileDashboard } from '@/components/hooks/useProfileDashboard';
import { useQuestFeed } from '@/components/hooks/useQuestFeed';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { QuestGridCard } from '@/components/dashboard/QuestGridCard';
import { focusRing } from '@/components/brand/constants';

export function OverviewPage() {
  const router = useRouter();
  const { siweVerified, displayName, loading: authLoading } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const { stats, loading: profileLoading } = useProfileDashboard();
  const feed = useQuestFeed({ platformFilter: 'all' });
  const recentQuests = feed.visibleTasks.slice(0, 3);

  const loading = authLoading || (siweVerified && profileLoading);

  return (
    <div>
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
          {siweVerified ? `Welcome back${displayName ? `, ${displayName}` : ''}` : 'TaskPay Dashboard'}
        </h1>
        <p className="text-gray-500 text-base sm:text-lg">
          {siweVerified
            ? 'Track your earnings, discover quests, and grow your audience.'
            : 'Connect your wallet to start earning G$ & USDC from social quests.'}
        </p>
      </div>

      {!siweVerified && !authLoading && (
        <div className="mb-10 rounded-3xl border border-gray-200 bg-white p-8 sm:p-10 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-6">
            <FontAwesomeIcon icon={faWallet} className="text-2xl text-violet-700" />
          </div>
          <h2 className="text-xl font-black mb-2">Get started</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md mx-auto">
            Sign in with your wallet to browse quests, create campaigns, and manage your profile.
          </p>
          <button
            type="button"
            onClick={openAuthGate}
            className={`px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white font-bold shadow-lg shadow-purple-500/20 hover:opacity-95 transition-opacity ${focusRing}`}
          >
            Connect wallet
          </button>
        </div>
      )}

      {siweVerified && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Completions" value={stats.completions} icon={faBullseye} accent="violet" loading={loading} />
          <StatCard label="Total earned" value={`$${stats.totalEarned.toFixed(2)}`} icon={faCoins} accent="emerald" loading={loading} />
          <StatCard label="Unclaimed" value={`$${stats.unclaimedUsdc.toFixed(2)}`} icon={faWallet} accent="amber" loading={loading} />
          <StatCard label="Quests created" value={stats.questsCreated} icon={faTrophy} accent="blue" loading={loading} />
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-10">
        <Link
          href="/app/quests"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors ${focusRing}`}
        >
          <FontAwesomeIcon icon={faBullseye} />
          Browse quests
        </Link>
        <Link
          href={siweVerified ? '/app/create' : '#'}
          onClick={(e) => {
            if (!siweVerified) {
              e.preventDefault();
              openAuthGate();
            }
          }}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50 transition-colors ${focusRing}`}
        >
          <FontAwesomeIcon icon={faPlus} />
          Create quest
        </Link>
        <Link
          href="/app/leaderboard"
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-bold hover:bg-gray-50 transition-colors ${focusRing}`}
        >
          <FontAwesomeIcon icon={faTrophy} />
          Leaderboard
        </Link>
      </div>

      {siweVerified && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black tracking-tight">Continue earning</h2>
            <Link href="/app/quests" className="text-sm font-bold text-gray-500 hover:text-black flex items-center gap-1">
              View all <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </Link>
          </div>

          {feed.isLoading ? (
            <div className="flex justify-center py-12">
              <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
            </div>
          ) : recentQuests.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center rounded-2xl border border-dashed border-gray-200">
              No active quests right now. Check back soon.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recentQuests.map((task) => {
                const taskId = String(task._id);
                const userCompleted = feed.isTaskCompletedForUser(task);
                const fid = task.creatorFid as number | undefined;
                const targetFid = task.targetFid as number | undefined;
                return (
                  <QuestGridCard
                    key={taskId}
                    task={task}
                    filter="active"
                    creatorProfile={
                      fid
                        ? (feed.profiles[fid] as { username?: string; display_name?: string; pfp_url?: string })
                        : undefined
                    }
                    targetProfile={
                      targetFid
                        ? (feed.profiles[targetFid] as { username?: string; display_name?: string; pfp_url?: string })
                        : undefined
                    }
                    isUserCompleted={userCompleted}
                    isFull={feed.isTaskFull(task)}
                    eligibilityResult={userCompleted ? null : (feed.eligibilityByTaskId[taskId] ?? null)}
                    onAction={() => feed.openTaskAction(task)}
                    onVerify={() => router.push(`/app/quests?verify=${encodeURIComponent(taskId)}`)}
                    onCheckEligibility={() => feed.handleCheckEligibility(task)}
                    verifying={feed.verifyingTaskId === taskId}
                    customTaskOpened={!!feed.customOpenedTaskIds[taskId]}
                  />
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
