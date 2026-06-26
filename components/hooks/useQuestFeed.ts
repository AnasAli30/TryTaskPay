'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from 'wagmi';
import { arbitrum } from 'wagmi/chains';
import { useAppMode } from '@/components/app-mode-provider';
import { useUserIdentity } from '@/components/hooks/useUserIdentity';
import { useAppActions } from '@/components/hooks/useAppActions';
import { useFrame } from '@/components/farcaster-provider';
import { TASK_ESCROW_ABI, TASK_ESCROW_ADDRESS } from '@/lib/contracts';
import {
  getLocalChannelDone,
  setLocalChannelDone,
  getLocalCustomTaskOpened,
  setLocalCustomTaskOpened,
  hasEligibilityCriteria,
  getTypeTitle,
  type EligibilityResult,
  type QuestFilter,
  type QuestTask,
} from '@/lib/questHelpers';

export type VerifyChecks = Record<string, boolean>;
export type { QuestFilter };
export type PlatformFilter = 'all' | 'farcaster' | 'x';

export interface UseQuestFeedOptions {
  onTaskVerified?: () => void;
  filter?: QuestFilter;
  onFilterChange?: (f: QuestFilter) => void;
  onVisibleCountChange?: (count: number) => void;
  platformFilter?: PlatformFilter;
}

export function useQuestFeed(options: UseQuestFeedOptions = {}) {
  const {
    onTaskVerified,
    filter: filterProp,
    onFilterChange,
    onVisibleCountChange,
    platformFilter = 'all',
  } = options;

  const { context } = useFrame();
  const appActions = useAppActions();
  const { isBrowser } = useAppMode();
  const identity = useUserIdentity();
  const participantFid = identity.fid;
  const participantWallet = identity.walletAddress?.toLowerCase();
  const user = context?.user;
  const activeFid = participantFid ?? user?.fid;

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tasks, setTasks] = useState<QuestTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<QuestTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<number, unknown>>({});
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [showVerifySuccessModal, setShowVerifySuccessModal] = useState(false);
  const [verifiedTask, setVerifiedTask] = useState<QuestTask | null>(null);
  const [filterInternal, setFilterInternal] = useState<QuestFilter>('active');
  const filter = filterProp ?? filterInternal;
  const setFilter = (f: QuestFilter) => {
    setFilterInternal(f);
    onFilterChange?.(f);
  };
  const [completedList, setCompletedList] = useState<QuestTask[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [totalQuestsCreated, setTotalQuestsCreated] = useState<number | null>(null);
  const [eligibilityByTaskId, setEligibilityByTaskId] = useState<Record<string, EligibilityResult>>({});
  const [verifyModalTask, setVerifyModalTask] = useState<QuestTask | null>(null);
  const [verifyModalChecks, setVerifyModalChecks] = useState<VerifyChecks>({});
  const [noEthModalTask, setNoEthModalTask] = useState<QuestTask | null>(null);
  const [verifyCooldownUntilMs, setVerifyCooldownUntilMs] = useState(0);
  const [platformConnectTask, setPlatformConnectTask] = useState<QuestTask | null>(null);
  const [verifyCooldownNowMs, setVerifyCooldownNowMs] = useState(Date.now());
  const [customOpenedTaskIds, setCustomOpenedTaskIds] = useState<Record<string, boolean>>({});

  const walletForCustom = participantWallet ?? address?.toLowerCase();

  useEffect(() => {
    if (!walletForCustom) return;
    setCustomOpenedTaskIds((prev) => {
      const next = { ...prev };
      for (const t of tasks) {
        if (t.type === 'custom_onchain' && t._id) {
          const id = String(t._id);
          if (getLocalCustomTaskOpened(id, walletForCustom)) next[id] = true;
        }
      }
      return next;
    });
  }, [walletForCustom, tasks]);

  const needsPlatformConnect = useCallback(
    (task: QuestTask): 'farcaster' | 'x' | null => {
      if (!isBrowser) return null;
      if (String(task?.type || '').startsWith('x_')) {
        return identity.xUsername ? null : 'x';
      }
      if (task.type === 'custom_onchain') {
        const needsFc =
          !!task.nonSpamOnly ||
          ((task.minFollowers as number) ?? 0) > 0 ||
          task.minNeynarScore != null ||
          ((task.minAccountAgeDays as number) ?? 0) > 0;
        if (needsFc && !activeFid) return 'farcaster';
        return null;
      }
      return activeFid ? null : 'farcaster';
    },
    [isBrowser, identity.xUsername, activeFid],
  );

  const verifyIdentityBody = useCallback(() => {
    if (activeFid) return { userFid: activeFid };
    if (participantWallet) return { userWallet: participantWallet };
    return null;
  }, [activeFid, participantWallet]);

  const fetchTasks = useCallback(async () => {
    if (isBrowser) {
      if (!identity.siweVerified) return;
    } else if (!participantFid) {
      return;
    }
    const fid = participantFid ?? user?.fid;
    try {
      const params = new URLSearchParams();
      if (isBrowser) params.set('browserMode', '1');
      if (fid) params.set('viewerFid', String(fid));
      if (participantWallet) params.set('viewerWallet', participantWallet);
      const res = await axios.get(`/api/tasks/list?${params.toString()}`);
      const loaded: QuestTask[] = res.data.tasks || [];

      const spotlightTasks = loaded.filter((t) => t?.spotlight === true);
      const nonSpotlightTasks = loaded.filter((t) => !t?.spotlight);
      const ordered = [...spotlightTasks, ...nonSpotlightTasks];

      const locallyDoneChannel = fid
        ? ordered.filter(
            (t) => t?.type === 'channel' && t?._id && getLocalChannelDone(String(t._id), fid),
          )
        : [];
      const remaining = fid
        ? ordered.filter(
            (t) => !(t?.type === 'channel' && t?._id && getLocalChannelDone(String(t._id), fid)),
          )
        : ordered;

      setTasks(remaining);
      if (locallyDoneChannel.length > 0 && fid) {
        setCompletedTasks((prev) => {
          const seen = new Set(prev.map((p) => String(p?._id)));
          const additions = locallyDoneChannel
            .filter((t) => !seen.has(String(t?._id)))
            .map((t) => ({
              ...t,
              completedBy: Array.from(new Set([...(t.completedBy || []), fid])),
            }));
          return additions.length > 0 ? [...additions, ...prev] : prev;
        });
      }

      const fids = new Set<number>();
      for (const t of ordered) {
        if (typeof t.creatorFid === 'number') fids.add(t.creatorFid);
        if (typeof t.targetFid === 'number') fids.add(t.targetFid);
      }
      if (fids.size > 0) {
        try {
          const bulk = await axios.get(`/api/neynar/users/bulk?fids=${Array.from(fids).join(',')}`);
          const map: Record<number, unknown> = {};
          (bulk.data?.users || []).forEach((u: { fid?: number }) => {
            if (typeof u.fid === 'number') map[u.fid] = u;
          });
          setProfiles(map);
        } catch (err) {
          console.error('Error preloading user profiles', err);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isBrowser, identity.siweVerified, participantFid, participantWallet, user?.fid]);

  useEffect(() => {
    if (isBrowser ? identity.siweVerified : participantFid) fetchTasks();
  }, [participantFid, identity.siweVerified, isBrowser, fetchTasks]);

  useEffect(() => {
    if (filter !== 'completed') return;
    let cancelled = false;
    setCompletedLoading(true);
    (async () => {
      try {
        const res = await axios.get('/api/tasks/verified-tasks');
        const list: QuestTask[] = res.data.tasks || [];
        const createdTotal =
          typeof res.data.totalCreated === 'number' ? res.data.totalCreated : null;
        if (!cancelled) {
          setCompletedList(list);
          setTotalQuestsCreated(createdTotal);
        }
        const fids = new Set<number>();
        list.forEach((t) => {
          if (t?.creatorFid != null) fids.add(t.creatorFid as number);
        });
        if (fids.size > 0) {
          const bulk = await axios.get(`/api/neynar/users/bulk?fids=${Array.from(fids).join(',')}`);
          const map: Record<number, unknown> = {};
          (bulk.data?.users || []).forEach((u: { fid?: number }) => {
            if (typeof u.fid === 'number') map[u.fid] = u;
          });
          if (!cancelled) setProfiles((prev) => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.error('Failed to load verified tasks', e);
      } finally {
        if (!cancelled) setCompletedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter]);

  useEffect(() => {
    if (!verifyCooldownUntilMs) return;
    const t = setInterval(() => setVerifyCooldownNowMs(Date.now()), 250);
    return () => clearInterval(t);
  }, [verifyCooldownUntilMs]);

  const verifyCooldownSecondsLeft = Math.max(0, Math.ceil((verifyCooldownUntilMs - verifyCooldownNowMs) / 1000));
  const isVerifyCooldownActive = verifyCooldownSecondsLeft > 0;

  const handleCheckEligibility = async (task: QuestTask) => {
    if (!activeFid && !participantWallet) return;
    const taskId = task._id?.toString?.() ?? task._id;
    if (!taskId) return;
    if (!hasEligibilityCriteria(task)) {
      setEligibilityByTaskId((prev) => ({ ...prev, [String(taskId)]: { eligible: true } }));
      return;
    }
    setEligibilityByTaskId((prev) => ({ ...prev, [String(taskId)]: 'loading' }));
    try {
      const res = await axios.post('/api/tasks/check-eligibility', {
        taskId,
        userFid: activeFid,
        ...(participantWallet && !activeFid ? { userWallet: participantWallet } : {}),
      });
      const data = res.data || {};
      setEligibilityByTaskId((prev) => ({
        ...prev,
        [String(taskId)]: data.eligible
          ? { eligible: true }
          : { eligible: false, message: data.message },
      }));
    } catch {
      setEligibilityByTaskId((prev) => ({
        ...prev,
        [String(taskId)]: { eligible: false, message: 'Could not check eligibility. Try again.' },
      }));
    }
  };

  const openTaskAction = async (task: QuestTask) => {
    switch (task.type) {
      case 'follow':
        if (task.targetFid || task.targetUsername) {
          await appActions.viewProfile({
            fid: task.targetFid,
            username: task.targetUsername as string | undefined,
          });
        }
        break;
      case 'boost':
      case 'quote':
      case 'multi':
        if (task.castHash) await appActions.viewCast({ hash: task.castHash as string });
        break;
      case 'channel':
        if (task.targetUrl) appActions.openUrl?.(task.targetUrl as string);
        if (activeFid && task?._id) setLocalChannelDone(String(task._id), activeFid);
        break;
      case 'miniapp':
        if (task.miniappUrl && activeFid && task._id) {
          try {
            await axios.post('/api/tasks/miniapp/open', { taskId: task._id, userFid: activeFid });
          } catch (e) {
            console.error('Failed to record miniapp open', e);
          }
          appActions.openMiniApp({ url: task.miniappUrl as string });
        }
        break;
      case 'x_follow':
        if (task.xTargetUsername) appActions.openUrl?.(`https://x.com/${task.xTargetUsername}`);
        break;
      case 'x_boost_lite':
      case 'x_boost':
        if (task.xTweetUrl) appActions.openUrl?.(task.xTweetUrl as string);
        break;
      case 'x_bundle':
        if (task.xTargetUsername) appActions.openUrl?.(`https://x.com/${task.xTargetUsername}`);
        break;
      case 'custom_onchain': {
        const meta = task.customActionMeta as { rewardBaseUrl?: string } | undefined;
        const url = meta?.rewardBaseUrl;
        const taskId = task._id ? String(task._id) : null;
        const wallet = walletForCustom;
        if (taskId && wallet) {
          try {
            await axios.post('/api/custom-actions/record-open', { taskId });
            setLocalCustomTaskOpened(taskId, wallet);
            setCustomOpenedTaskIds((prev) => ({ ...prev, [taskId]: true }));
          } catch (e) {
            console.error('Failed to record custom task open', e);
          }
        }
        if (url) {
          if (appActions.openUrl) appActions.openUrl(url);
          else if (typeof window !== 'undefined') window.open(url, '_blank', 'noopener,noreferrer');
        }
        break;
      }
    }
  };

  const handleOpenVerifyModal = async (task: QuestTask) => {
    const platformNeed = needsPlatformConnect(task);
    if (platformNeed) {
      setPlatformConnectTask(task);
      return;
    }
    if (task.type === 'custom_onchain') {
      const taskId = String(task._id);
      if (!walletForCustom) {
        setVerifyError('Connect your wallet first');
        return;
      }
      if (!customOpenedTaskIds[taskId] && !getLocalCustomTaskOpened(taskId, walletForCustom)) {
        setVerifyError('Open the task first, complete the action, then verify.');
        return;
      }
      setVerifyError(null);
      setVerifyModalChecks({});
      setVerifyModalTask(task);
      return;
    }
    if (!address || !publicClient) {
      setVerifyError('Connect your wallet first');
      return;
    }
    setVerifyingTaskId(String(task._id));
    try {
      const balance = await publicClient.getBalance({ address });
      if (balance === BigInt(0)) {
        setNoEthModalTask(task);
        setVerifyingTaskId(null);
        return;
      }
    } catch (e) {
      console.error('Failed to fetch balance', e);
    }
    setVerifyingTaskId(null);
    setVerifyError(null);
    setVerifyModalChecks({});
    setVerifyModalTask(task);
  };

  const completeOnChain = async (task: QuestTask) => {
    const idBody = verifyIdentityBody();
    if (!idBody || !address || !publicClient) return false;

    const onChainTaskId = task.onChainTaskId as string | undefined;
    if (!onChainTaskId) throw new Error('Missing on-chain task ID');

    const hash = await writeContractAsync({
      address: TASK_ESCROW_ADDRESS as `0x${string}`,
      abi: TASK_ESCROW_ABI,
      functionName: 'verifyTask',
      args: [onChainTaskId as `0x${string}`],
      account: address as `0x${string}`,
      chainId: arbitrum.id,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Transaction failed');

    await axios.post('/api/tasks/complete', {
      taskId: task._id,
      ...idBody,
      userAddress: address,
      verifyTxHash: receipt.transactionHash,
    });

    onTaskVerified?.();
    setVerifiedTask(task);
    setVerifyModalTask(null);
    setShowVerifySuccessModal(true);
    const taskId = String(task._id);
    setTasks((prev) => prev.filter((t) => String(t._id) !== taskId));
    setCompletedTasks((prev) => {
      const nextTask = {
        ...task,
        completedBy: activeFid
          ? Array.from(new Set([...(task.completedBy || []), activeFid]))
          : task.completedBy || [],
      };
      return prev.some((t) => String(t._id) === taskId) ? prev : [nextTask, ...prev];
    });
    return true;
  };

  const handleModalVerify = async () => {
    const task = verifyModalTask;
    const idBody = verifyIdentityBody();
    if (!task || !idBody) return;

    if (task.type === 'custom_onchain') {
      if (!walletForCustom) {
        setVerifyError('Connect your wallet first');
        return;
      }
      if (isVerifyCooldownActive) {
        setVerifyError(`Please wait ${verifyCooldownSecondsLeft}s, then verify again.`);
        return;
      }
      setVerifyError(null);
      setVerifyingTaskId(String(task._id));
      try {
        const res = await axios.post('/api/custom-actions/verify-completion', {
          taskId: task._id,
          userFid: activeFid,
        });
        const data = res.data || {};

        if (!data.verified) {
          setVerifyError(
            data.message ||
              data.error ||
              'No matching transaction yet. Complete the action in the app, then try again.',
          );
          setVerifyCooldownUntilMs(Date.now() + 30_000);
          return;
        }

        onTaskVerified?.();
        setVerifiedTask(task);
        setVerifyModalTask(null);
        setShowVerifySuccessModal(true);
        const taskId = String(task._id);
        setTasks((prev) => prev.filter((t) => String(t._id) !== taskId));
        setCompletedTasks((prev) => {
          const nextTask = {
            ...task,
            completedBy: activeFid
              ? Array.from(new Set([...(task.completedBy || []), activeFid]))
              : task.completedBy || [],
            completedByWallets: walletForCustom
              ? Array.from(new Set([...(task.completedByWallets || []), walletForCustom]))
              : task.completedByWallets || [],
          };
          return prev.some((t) => String(t._id) === taskId) ? prev : [nextTask, ...prev];
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
        setVerifyError(msg);
      } finally {
        setVerifyingTaskId(null);
      }
      return;
    }

    if (task.type === 'channel') {
      const taskId = String(task._id);
      const done = activeFid ? getLocalChannelDone(taskId, activeFid) : false;
      if (!done) {
        setVerifyError('Please click Join first, then you can complete.');
        return;
      }
      if (!address || !walletClient || !publicClient) {
        setVerifyError('Connect your wallet first');
        return;
      }
      setVerifyError(null);
      setVerifyingTaskId(String(task._id));
      try {
        await completeOnChain(task);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
        setVerifyError(msg.includes('User rejected') ? 'Transaction cancelled.' : msg);
      } finally {
        setVerifyingTaskId(null);
      }
      return;
    }

    if (!address || !walletClient || !publicClient) {
      setVerifyError('Connect your wallet first');
      return;
    }
    if (isVerifyCooldownActive) {
      setVerifyError(`Please wait ${verifyCooldownSecondsLeft}s, then verify again.`);
      return;
    }

    setVerifyError(null);
    setVerifyingTaskId(String(task._id));
    try {
      const res = await axios.post('/api/tasks/verify', { taskId: task._id, ...idBody });
      const data = res.data || {};

      if (!data.success || !data.verified) {
        setVerifyModalChecks(data.checks || {});
        setVerifyError(data.message || 'First complete all steps, then verify.');
        setVerifyCooldownUntilMs(Date.now() + (task.type === 'channel' ? 60_000 : 30_000));
        return;
      }

      setVerifyModalChecks(data.checks || {});
      const taskWithChain = { ...task, onChainTaskId: data.onChainTaskId || task.onChainTaskId };
      await completeOnChain(taskWithChain);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong. Try again.';
      setVerifyError(msg.includes('User rejected') ? 'Transaction cancelled.' : msg);
    } finally {
      setVerifyingTaskId(null);
    }
  };

  const isTaskCompletedForUser = (task: QuestTask) =>
    !!(activeFid && task.completedBy?.includes(activeFid)) ||
    !!(participantWallet && task.completedByWallets?.includes(participantWallet));

  const isTaskFull = (task: QuestTask) => {
    const completedCount = task.completedBy?.length || 0;
    const maxCompletions = (task.maxCompletions as number) || 0;
    return maxCompletions > 0 && completedCount >= maxCompletions && !isTaskCompletedForUser(task);
  };

  const matchesPlatform = (task: QuestTask) => {
    if (platformFilter === 'all') return true;
    const isX = String(task.type ?? '').startsWith('x_');
    return platformFilter === 'x' ? isX : !isX;
  };

  let visibleTasks: QuestTask[] = [];
  if (filter === 'filled') {
    visibleTasks = tasks.filter(isTaskFull);
  } else if (filter === 'completed') {
    const fromApi = completedList.filter(
      (t) => !completedTasks.some((s) => String(s._id) === String(t._id)),
    );
    visibleTasks = [...completedTasks, ...fromApi];
  } else {
    visibleTasks = tasks.filter((t) => !isTaskFull(t));
  }

  visibleTasks = visibleTasks.filter(matchesPlatform);
  visibleTasks.sort((a, b) => {
    const aSpot = a?.spotlight === true ? 1 : 0;
    const bSpot = b?.spotlight === true ? 1 : 0;
    if (aSpot !== bSpot) return bSpot - aSpot;
    const rewardA = Number(a.totalBudget ?? a.remainingBudget ?? a.rewardAmount ?? 0);
    const rewardB = Number(b.totalBudget ?? b.remainingBudget ?? b.rewardAmount ?? 0);
    return rewardB - rewardA;
  });

  const displayQuestCount =
    filter === 'completed' && totalQuestsCreated != null
      ? totalQuestsCreated
      : visibleTasks.length;

  useEffect(() => {
    onVisibleCountChange?.(displayQuestCount);
  }, [displayQuestCount, onVisibleCountChange]);

  return {
    tasks,
    visibleTasks,
    displayQuestCount,
    totalQuestsCreated,
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
    fetchTasks,
    handleCheckEligibility,
    openTaskAction,
    handleOpenVerifyModal,
    handleModalVerify,
    needsPlatformConnect,
    getTypeTitle,
    isTaskCompletedForUser,
    isTaskFull,
    verifyCooldownSecondsLeft,
    isVerifyCooldownActive,
    customOpenedTaskIds,
  };
}
