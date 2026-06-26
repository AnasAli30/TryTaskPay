import { PLATFORM_FEE_USDC } from '@/lib/contracts';

export const CUSTOM_LAUNCH_MIN_TOTAL_USDC = 1;
export const CUSTOM_LAUNCH_MAX_TOTAL_USDC = 50;
export const CUSTOM_LAUNCH_MIN_PER_USER_USDC = 0.01;
export const CUSTOM_LAUNCH_MAX_PER_USER_USDC = 2;

export const CUSTOM_LAUNCH_MIN_TOTAL_G = 1;
export const CUSTOM_LAUNCH_MAX_TOTAL_G = 50000;
export const CUSTOM_LAUNCH_MIN_PER_USER_G = 1;
export const CUSTOM_LAUNCH_MAX_PER_USER_G = 5000;

export interface CustomLaunchInput {
  perUserRewardUsdc: number;
  totalBudgetUsdc: number;
  expiresInDays: 1 | 3;
  targetingEnabled?: boolean;
  minFollowers?: number;
  minNeynarScore?: number;
  minAccountAgeDays?: number;
  nonSpamOnly?: boolean;
}

export function getCustomMaxCompletions(totalBudgetUsdc: number, perUserRewardUsdc: number): number {
  if (perUserRewardUsdc <= 0) return 0;
  return Math.max(0, Math.floor(totalBudgetUsdc / perUserRewardUsdc));
}

export function getCustomLaunchLimits(isG: boolean) {
  return {
    minTotal: isG ? CUSTOM_LAUNCH_MIN_TOTAL_G : CUSTOM_LAUNCH_MIN_TOTAL_USDC,
    maxTotal: isG ? CUSTOM_LAUNCH_MAX_TOTAL_G : CUSTOM_LAUNCH_MAX_TOTAL_USDC,
    minPerUser: isG ? CUSTOM_LAUNCH_MIN_PER_USER_G : CUSTOM_LAUNCH_MIN_PER_USER_USDC,
    maxPerUser: isG ? CUSTOM_LAUNCH_MAX_PER_USER_G : CUSTOM_LAUNCH_MAX_PER_USER_USDC,
  };
}

export function validateCustomLaunchInput(
  input: CustomLaunchInput,
  hasFarcasterChannel: boolean,
  tokenSymbol: string = 'USDC',
): string | null {
  const { perUserRewardUsdc, totalBudgetUsdc, expiresInDays } = input;
  const isG = tokenSymbol === 'G$';
  const limits = getCustomLaunchLimits(isG);

  if (!Number.isFinite(perUserRewardUsdc) || perUserRewardUsdc < limits.minPerUser) {
    return `Per person reward must be at least ${limits.minPerUser} ${tokenSymbol}.`;
  }
  if (perUserRewardUsdc > limits.maxPerUser) {
    return `Per person reward cannot exceed ${limits.maxPerUser} ${tokenSymbol}.`;
  }
  if (!Number.isFinite(totalBudgetUsdc) || totalBudgetUsdc < limits.minTotal) {
    return `Total amount must be at least ${limits.minTotal} ${tokenSymbol}.`;
  }
  if (totalBudgetUsdc > limits.maxTotal) {
    return `Total amount cannot exceed ${limits.maxTotal} ${tokenSymbol}.`;
  }
  if (expiresInDays !== 1 && expiresInDays !== 3) {
    return 'Duration must be 24 hours or 72 hours.';
  }

  const maxCompletions = getCustomMaxCompletions(totalBudgetUsdc, perUserRewardUsdc);
  if (maxCompletions < 1) {
    return 'Total amount is too small for the per person reward — increase total or lower per person reward.';
  }

  if (input.targetingEnabled && !hasFarcasterChannel) {
    return 'Targeting is only available when Farcaster is a distribution channel.';
  }

  return null;
}

export function buildLaunchDraft(input: CustomLaunchInput) {
  const maxCompletions = getCustomMaxCompletions(input.totalBudgetUsdc, input.perUserRewardUsdc);
  return {
    perUserRewardUsdc: input.perUserRewardUsdc,
    totalBudgetUsdc: input.totalBudgetUsdc,
    maxCompletions,
    expiresInDays: input.expiresInDays,
    platformFeeUsdc: PLATFORM_FEE_USDC,
    targetingEnabled: input.targetingEnabled || undefined,
    minFollowers:
      input.targetingEnabled && input.minFollowers != null && input.minFollowers > 0
        ? input.minFollowers
        : undefined,
    minNeynarScore:
      input.targetingEnabled && input.minNeynarScore != null && input.minNeynarScore >= 0
        ? input.minNeynarScore
        : undefined,
    minAccountAgeDays:
      input.targetingEnabled && input.minAccountAgeDays != null && input.minAccountAgeDays > 0
        ? input.minAccountAgeDays
        : undefined,
    nonSpamOnly: input.targetingEnabled && input.nonSpamOnly ? true : undefined,
    savedAt: new Date(),
  };
}
