'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import type {
  CustomActionCategory,
  CustomActionDistributionChannel,
  CustomActionLaunchDraft,
  CustomActionReviewStatus,
} from '@/lib/types';

export interface CompletionRow {
  _id?: string;
  taskId?: string;
  status?: string;
  claimStatus?: string;
  claimAmount?: number;
  createdAt?: string;
  task?: Record<string, unknown>;
}

export interface CreatorTaskRow {
  _id?: string;
  type?: string;
  totalBudget?: number;
  stats?: { totalCompletions?: number; successCount?: number };
  createdAt?: string;
}

export interface CustomActionRow {
  _id?: string;
  appName?: string;
  appImageUrl?: string;
  actionName?: string;
  category?: CustomActionCategory;
  status?: CustomActionReviewStatus;
  submittedAt?: string;
  chainId?: 42161 | 42220;
  contractAddress?: string;
  functionName?: string;
  functionSelector?: string;
  distributionChannels?: CustomActionDistributionChannel[];
  rewardDescription?: string;
  rewardBaseUrl?: string;
  launchDraft?: CustomActionLaunchDraft & { savedAt?: string };
  launchedTaskId?: string;
  trackedEvent?: {
    name?: string;
    signature?: string;
  };
}

export function useProfileDashboard() {
  const { siweVerified, walletAddress, fid } = useBrowserAuth();
  const [completions, setCompletions] = useState<CompletionRow[]>([]);
  const [creatorTasks, setCreatorTasks] = useState<CreatorTaskRow[]>([]);
  const [customActions, setCustomActions] = useState<CustomActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unclaimedUsdc, setUnclaimedUsdc] = useState(0);

  const refresh = useCallback(async () => {
    if (!siweVerified || !walletAddress) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const compQ = new URLSearchParams({ userWallet: walletAddress });
      if (fid) compQ.set('userFid', String(fid));

      const creatorQ = new URLSearchParams({ creatorAddress: walletAddress });
      if (fid) creatorQ.set('creatorFid', String(fid));

      const customQ = new URLSearchParams({ creatorAddress: walletAddress });
      if (fid) customQ.set('creatorFid', String(fid));

      const [compRes, creatorRes, customRes] = await Promise.all([
        axios.get(`/api/tasks/user-completions?${compQ}`),
        axios.get(`/api/tasks/creator-tasks?${creatorQ}`),
        axios.get(`/api/custom-actions/mine?${customQ}`),
      ]);

      const comps: CompletionRow[] = compRes.data?.completions || compRes.data || [];
      setCompletions(Array.isArray(comps) ? comps : []);
      setCreatorTasks(creatorRes.data?.tasks || []);
      setCustomActions(customRes.data?.requests || []);

      const unclaimed = comps
        .filter((c) => c.claimStatus === 'unclaimed' && c.status === 'success')
        .reduce((sum, c) => sum + (c.claimAmount || 0), 0);
      setUnclaimedUsdc(unclaimed);
    } catch (e) {
      console.error('Profile dashboard fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [siweVerified, walletAddress, fid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = {
    completions: completions.length,
    successCount: completions.filter((c) => c.status === 'success').length,
    totalEarned: completions
      .filter((c) => c.claimStatus === 'claimed')
      .reduce((sum, c) => sum + (c.claimAmount || 0), 0),
    questsCreated: creatorTasks.length,
    customActionsSubmitted: customActions.length,
    unclaimedUsdc,
  };

  return {
    completions,
    creatorTasks,
    customActions,
    loading,
    stats,
    refresh,
    siweVerified,
    walletAddress,
    fid,
  };
}
