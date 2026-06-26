import { USERS_PER_1_USDC } from '@/lib/constants';

/** Task type keys for reward config (must match USERS_PER_1_USDC in constants). */
export type TaskType = keyof typeof USERS_PER_1_USDC;

/** Per-user reward in USDC (1 / users per 1 USDC). */
export function getPerUserRewardUSDC(type: string): number {
    const users = USERS_PER_1_USDC[type as TaskType];
    if (users == null || users <= 0) return 1 / 25;
    return 1 / users;
}

/**
 * Per-user reward in the quest's native token.
 * For USDC quests this is the same as getPerUserRewardUSDC.
 * For G$ quests the USDC reward is converted to G$ using the live price.
 */
export function getPerUserReward(type: string, rewardToken: string, gDollarPrice: number): number {
    const usdReward = getPerUserRewardUSDC(type);
    if (rewardToken === 'G$' && gDollarPrice > 0) {
        return usdReward / gDollarPrice;
    }
    return usdReward;
}

/** Max completions for a given totalBudget (in USDC) and type. */
export function getMaxCompletions(totalBudget: number, type: string): number {
    const users = USERS_PER_1_USDC[type as TaskType];
    if (users == null || users <= 0) return Math.floor(totalBudget * 25);
    return Math.max(0, Math.floor(totalBudget * users));
}

/**
 * Max completions taking token type into account.
 * For G$ quests the budget is first converted to its USD equivalent.
 */
export function getMaxCompletionsForToken(
    totalBudget: number,
    type: string,
    rewardToken: string,
    gDollarPrice: number,
): number {
    if (rewardToken === 'G$' && gDollarPrice > 0) {
        const budgetInUSD = totalBudget * gDollarPrice;
        return getMaxCompletions(budgetInUSD, type);
    }
    return getMaxCompletions(totalBudget, type);
}

/**
 * Format a token amount for display.
 * G$ uses 0 decimal places (large numbers), USDC uses 2-4.
 */
export function formatTokenAmount(amount: number, rewardToken: string, decimals?: number): string {
    if (rewardToken === 'G$') {
        return amount >= 1 ? Math.round(amount).toLocaleString() : amount.toFixed(2);
    }
    return amount.toFixed(decimals ?? 4);
}
