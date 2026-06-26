'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCircleInfo,
  faImage,
  faLock,
  faRocket,
  faSpinner,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { BrowserProfileEditor } from '@/components/browser/BrowserProfileEditor';
import { ConnectFarcaster } from '@/components/browser/ConnectFarcaster';
import { ConnectX } from '@/components/browser/ConnectX';
import { useProfileDashboard } from '@/components/hooks/useProfileDashboard';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { PendingActionModal } from '@/components/dashboard/PendingActionModal';
import { LaunchCustomActionModal } from '@/components/dashboard/LaunchCustomActionModal';
import { getCategoryLabel, formatOnChainTrigger } from '@/lib/customActionHelpers';
import type { CustomActionRow } from '@/components/hooks/useProfileDashboard';

type ActivityTab = 'completions' | 'created' | 'custom';

function statusBadge(status?: string) {
  switch (status) {
    case 'pending_review':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
          Pending
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
          Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-red-100 text-red-700">
          Rejected
        </span>
      );
    default:
      return <span className="text-gray-400">—</span>;
  }
}

export function ProfileSettings() {
  const { siweVerified, displayName, pfpUrl, walletAddress } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const { completions, creatorTasks, customActions, loading, stats, refresh } = useProfileDashboard();
  const [tab, setTab] = useState<ActivityTab>('completions');
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [launchModalAction, setLaunchModalAction] = useState<CustomActionRow | null>(null);

  const pendingCustomActions = customActions.filter((a) => a.status !== 'approved');
  const approvedCustomActions = customActions.filter(
    (a) => a.status === 'approved' && !a.launchedTaskId,
  );

  if (!siweVerified) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faLock} className="text-2xl text-violet-700" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3">Your Profile</h1>
        <p className="text-gray-500 mb-8">Sign in to manage your profile and view activity.</p>
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
      <PendingActionModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
      <LaunchCustomActionModal
        action={launchModalAction}
        open={!!launchModalAction}
        onClose={() => setLaunchModalAction(null)}
        onSaved={refresh}
      />

      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Profile & Settings</h1>
        <p className="text-gray-500">Manage your identity and connected accounts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-6">
              {pfpUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pfpUrl} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-gray-100" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <FontAwesomeIcon icon={faUser} className="text-xl text-gray-300" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-black">{displayName || 'Wallet user'}</h2>
                <p className="text-xs text-gray-400 font-mono">
                  {walletAddress?.slice(0, 8)}…{walletAddress?.slice(-6)}
                </p>
              </div>
            </div>
            <BrowserProfileEditor />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-4">
              Connected accounts
            </h3>
            <div className="space-y-3">
              <ConnectFarcaster />
              <ConnectX />
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-emerald-50 to-green-50 p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-600/70 mb-1">
              Total earned
            </p>
            <p className="text-2xl font-black text-emerald-700">${stats.totalEarned.toFixed(2)}</p>
            {stats.unclaimedUsdc > 0 && (
              <p className="text-xs text-amber-700 mt-2 font-semibold">
                ${stats.unclaimedUsdc.toFixed(2)} unclaimed
              </p>
            )}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 p-4 border-b border-gray-100">
          {(
            [
              { id: 'completions' as const, label: 'My completions' },
              { id: 'created' as const, label: 'Quests created' },
              { id: 'custom' as const, label: 'Custom actions' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t.id ? 'bg-gray-100 text-black' : 'text-gray-500 hover:text-black'
              }`}
            >
              {t.label}
              {t.id === 'custom' && customActions.length > 0 && (
                <span className="ml-1.5 text-xs text-gray-400">({customActions.length})</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <FontAwesomeIcon icon={faSpinner} spin className="text-2xl text-gray-300" />
          </div>
        ) : tab === 'completions' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase tracking-widest">
                  <th className="px-6 py-3 font-bold">Task</th>
                  <th className="px-6 py-3 font-bold">Status</th>
                  <th className="px-6 py-3 font-bold">Claim</th>
                  <th className="px-6 py-3 font-bold">Reward</th>
                </tr>
              </thead>
              <tbody>
                {completions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                      No completions yet
                    </td>
                  </tr>
                ) : (
                  completions.map((c) => (
                    <tr key={c._id || c.taskId} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium">{String(c.taskId || '').slice(-8)}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{c.status || '—'}</td>
                      <td className="px-6 py-4 capitalize text-gray-600">{c.claimStatus || '—'}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        ${(c.claimAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : tab === 'created' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase tracking-widest">
                  <th className="px-6 py-3 font-bold">Type</th>
                  <th className="px-6 py-3 font-bold">Budget</th>
                  <th className="px-6 py-3 font-bold">Completions</th>
                </tr>
              </thead>
              <tbody>
                {creatorTasks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                      No quests created yet
                    </td>
                  </tr>
                ) : (
                  creatorTasks.map((t) => (
                    <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-medium capitalize">
                        {String(t.type || '').replace(/_/g, ' ')}
                      </td>
                      <td className="px-6 py-4 font-bold">${(t.totalBudget || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600">
                        {t.stats?.successCount ?? 0} / {t.stats?.totalCompletions ?? 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {customActions.length === 0 ? (
              <p className="px-6 py-12 text-center text-gray-400">No custom actions submitted yet</p>
            ) : (
              <>
                {pendingCustomActions.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-gray-400 text-[11px] uppercase tracking-widest">
                          <th className="px-6 py-3 font-bold">Action</th>
                          <th className="px-6 py-3 font-bold">On-chain trigger</th>
                          <th className="px-6 py-3 font-bold">Category</th>
                          <th className="px-6 py-3 font-bold">Status</th>
                          <th className="px-6 py-3 font-bold w-12" />
                        </tr>
                      </thead>
                      <tbody>
                        {pendingCustomActions.map((a) => (
                          <tr key={a._id} className="border-b border-gray-50 hover:bg-gray-50/50">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {a.appImageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={a.appImageUrl}
                                    alt=""
                                    className="w-9 h-9 rounded-lg object-cover ring-1 ring-gray-100"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <FontAwesomeIcon icon={faImage} className="text-gray-300 text-xs" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-bold truncate">{a.actionName || a.appName}</p>
                                  <p className="text-xs text-gray-400 truncate">{a.appName}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-700 font-mono">
                                {formatOnChainTrigger({
                                  functionName: a.functionName,
                                  functionSelector: a.functionSelector,
                                  eventName: a.trackedEvent?.name,
                                  eventSignature: a.trackedEvent?.signature,
                                })}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-gray-600">
                              {a.category ? getCategoryLabel(a.category) : '—'}
                            </td>
                            <td className="px-6 py-4">{statusBadge(a.status)}</td>
                            <td className="px-6 py-4">
                              {a.status === 'pending_review' && (
                                <button
                                  type="button"
                                  onClick={() => setPendingModalOpen(true)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-600 hover:bg-amber-50 transition-colors"
                                  title="Pending action info"
                                  aria-label="Pending action info"
                                >
                                  <FontAwesomeIcon icon={faCircleInfo} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {approvedCustomActions.length > 0 && (
                  <div className="p-4 sm:p-6 space-y-4">
                    {approvedCustomActions.map((a) => (
                      <div
                        key={a._id}
                        className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                      >
                        <div className="p-4 sm:p-5 flex flex-wrap items-start gap-4">
                          {a.appImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.appImageUrl}
                              alt=""
                              className="w-12 h-12 rounded-xl object-cover ring-1 ring-gray-100 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                              <FontAwesomeIcon icon={faImage} className="text-gray-300" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <p className="font-bold text-base">{a.actionName || a.appName}</p>
                              {statusBadge(a.status)}
                            </div>
                            <p className="text-sm text-gray-500">{a.appName}</p>
                            <p className="text-xs font-mono text-gray-600 mt-2">
                              {formatOnChainTrigger({
                                functionName: a.functionName,
                                functionSelector: a.functionSelector,
                                eventName: a.trackedEvent?.name,
                                eventSignature: a.trackedEvent?.signature,
                              })}
                            </p>
                            {a.category && (
                              <p className="text-xs text-gray-400 mt-1">{getCategoryLabel(a.category)}</p>
                            )}
                          </div>
                        </div>
                        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 border-t border-gray-50">
                          <button
                            type="button"
                            onClick={() => setLaunchModalAction(a)}
                            className="w-full py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                          >
                            <FontAwesomeIcon icon={faRocket} />
                            Launch this task
                          </button>
                          {a.launchDraft && !a.launchedTaskId && (
                            <p className="text-xs text-gray-400 text-center mt-2 font-medium">
                              Draft saved — click to fund on-chain
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
