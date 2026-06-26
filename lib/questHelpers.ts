export function getRewardTokenLabel(task: { rewardToken?: string; chainId?: number } | Record<string, unknown>): string {
  if (task.rewardToken === 'G$' || task.chainId === 42220) return 'G$';
  return 'USDC';
}

export function getChainBadgeLabel(task: { rewardToken?: string; chainId?: number } | Record<string, unknown>): string | null {
  if (task.chainId === 42220 || task.rewardToken === 'G$') return 'Celo';
  if (task.chainId === 42161) return 'Arbitrum';
  return null;
}

export function getTypeTitle(task: Record<string, unknown>) {
  switch (task.type) {
    case 'follow':
      return `Grow @${(task.targetUsername as string) ?? 'user'}`;
    case 'boost_lite':
      return 'Boost this cast';
    case 'boost':
      return 'Amplify this cast';
    case 'quote':
      return 'Quote & engage';
    case 'channel':
      return 'Join the community';
    case 'miniapp':
      return 'Discover an app';
    case 'multi':
      return task.targetUsername ? `Grow @${task.targetUsername} + Engage` : 'Full bundle';
    case 'x_follow':
      return `Follow @${(task.xTargetUsername as string) ?? 'user'} on X`;
    case 'x_boost_lite':
      return 'Like + Repost on X';
    case 'x_boost':
      return 'Engage with this X post';
    case 'x_bundle':
      return `Follow @${(task.xTargetUsername as string) ?? 'user'} + Engage on X`;
    case 'custom_onchain':
      return String((task.customActionMeta as { actionName?: string })?.actionName ?? task.description ?? 'On-chain task');
    default:
      return 'Complete task';
  }
}

export function getTypeIcon(taskType: string): string {
  const map: Record<string, string> = {
    follow: 'user-plus',
    boost_lite: 'bolt',
    boost: 'rocket',
    quote: 'quote-right',
    channel: 'hashtag',
    miniapp: 'layer-group',
    multi: 'layer-group',
    x_follow: 'user-plus',
    x_boost_lite: 'heart',
    x_boost: 'bolt',
    x_bundle: 'layer-group',
    custom_onchain: 'link',
  };
  return map[taskType] ?? 'bullseye';
}

export function isXQuest(task: Record<string, unknown>) {
  return String(task.type ?? '').startsWith('x_');
}

export function isFarcasterQuest(task: Record<string, unknown>) {
  const t = String(task.type ?? '');
  return !t.startsWith('x_');
}

export function getLocalChannelDone(taskId: string, fid: number): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`taskpay:channel_done:${fid}:${taskId}`) === '1';
  } catch {
    return false;
  }
}

export function setLocalChannelDone(taskId: string, fid: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`taskpay:channel_done:${fid}:${taskId}`, '1');
  } catch {
    // ignore
  }
}

export function getLocalCustomTaskOpened(taskId: string, wallet: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(`taskpay:custom_opened:${wallet.toLowerCase()}:${taskId}`) === '1';
  } catch {
    return false;
  }
}

export function setLocalCustomTaskOpened(taskId: string, wallet: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`taskpay:custom_opened:${wallet.toLowerCase()}:${taskId}`, '1');
  } catch {
    // ignore
  }
}

export function hasEligibilityCriteria(t: Record<string, unknown>) {
  return (
    (t.minFollowers != null && (t.minFollowers as number) > 0) ||
    (t.minNeynarScore != null && (t.minNeynarScore as number) >= 0) ||
    !!t.proSubscribersOnly ||
    (t.minAccountAgeDays != null && (t.minAccountAgeDays as number) > 0) ||
    t.type === 'x_follow' ||
    t.type === 'x_boost_lite' ||
    t.type === 'x_boost' ||
    t.type === 'x_bundle' ||
    (t.minXFollowers != null && (t.minXFollowers as number) > 0) ||
    (t.type === 'miniapp' && t.miniappAudience === 'new_users_only' && t.miniappUrl) ||
    (t.type === 'custom_onchain' && !!t.nonSpamOnly)
  );
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; message?: string }
  | 'loading';

export type QuestFilter = 'active' | 'filled' | 'completed';

export const QUEST_TYPE_CONFIG: Record<string, { label: string; verb: string }> = {
  follow: { label: 'Grow', verb: 'Follow profile' },
  boost_lite: { label: 'Boost', verb: 'Boost cast' },
  boost: { label: 'Amplify', verb: 'Amplify cast' },
  quote: { label: 'Engage', verb: 'Quote cast' },
  channel: { label: 'Community', verb: 'Join channel' },
  multi: { label: 'Bundle', verb: 'Follow + engage' },
  miniapp: { label: 'Mini App', verb: 'Try app' },
  x_follow: { label: 'X · Grow', verb: 'Follow on X' },
  x_boost_lite: { label: 'X · Boost', verb: 'Like & repost' },
  x_boost: { label: 'X · Engage', verb: 'Engage on X' },
  x_bundle: { label: 'X · Bundle', verb: 'Follow + engage' },
  custom_onchain: { label: 'On-chain', verb: 'Open task' },
};

/** Step hints on custom on-chain quest cards */
export const CUSTOM_ONCHAIN_STEP_OPEN =
  'Step 1: Open the app and complete the on-chain action.';

export const CUSTOM_ONCHAIN_STEP_VERIFY =
  'Step 2: Verify completion to claim your reward.';

export const CUSTOM_ONCHAIN_VERIFY_DIALOG =
  'Complete the on-chain action in the app, then verify. We scan your wallet for a matching transaction.';

export function getQuestTypeConfig(type?: string) {
  return QUEST_TYPE_CONFIG[type ?? ''] ?? { label: 'Quest', verb: 'Open task' };
}

export function formatQuestCountdown(expiresAt: unknown): string {
  if (!expiresAt) return '—';
  const target = new Date(expiresAt as string | number | Date);
  if (Number.isNaN(target.getTime())) return '—';
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / (1000 * 60 * 60 * 24));
  const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const m = Math.floor((diff / (1000 * 60)) % 60);
  const s = Math.floor((diff / 1000) % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export interface QuestTask {
  _id?: string;
  type?: string;
  rewardPerUser?: number;
  totalBudget?: number;
  completedBy?: number[];
  completedByWallets?: string[];
  creatorFid?: number;
  creatorProfile?: { displayName?: string; username?: string; pfpUrl?: string };
  creatorAddress?: string;
  targetFid?: number;
  targetUsername?: string;
  xTargetUsername?: string;
  spotlight?: boolean;
  status?: string;
  [key: string]: unknown;
}
