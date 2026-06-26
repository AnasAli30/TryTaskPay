/**
 * Shared create-quest utilities for mini-app CreateTask and dashboard wizard.
 */
export { pickEscrowDepositTxHash } from '@/components/Promote/createTaskUtils';

export type CreateQuestPlatform = 'farcaster' | 'x';

export type CreateQuestType =
  | 'follow'
  | 'boost_lite'
  | 'boost'
  | 'quote'
  | 'channel'
  | 'multi'
  | 'miniapp'
  | 'x_follow'
  | 'x_boost_lite'
  | 'x_boost'
  | 'x_bundle';
