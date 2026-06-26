export const MESSAGE_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30; // 30 day

const APP_URL_RAW = process.env.NEXT_PUBLIC_URL;

if (!APP_URL_RAW) {
  throw new Error('NEXT_PUBLIC_URL or NEXT_PUBLIC_VERCEL_URL is not set');
}

const APP_URL: string = APP_URL_RAW;

/** When true: show "Share to unlock" modal first (only when reward > SHARE_TO_UNLOCK_CLAIM_MIN_USDC); else direct claim, then optional share modal. */
export const REQUIRE_SHARE_TO_UNLOCK_CLAIM = false;
/** Min USDC reward (exclusive) above which "Share to unlock" is shown when REQUIRE_SHARE_TO_UNLOCK_CLAIM is true. Rewards <= this use direct claim. */
export const SHARE_TO_UNLOCK_CLAIM_MIN_USDC = 0.1;

/**
 * Users paid per 1 USDC by task type. Drives per-user reward and estimated max completions when creating a task.
 * Per-user reward (USDC) = 1 / USERS_PER_1_USDC[type]; max completions = totalBudget * USERS_PER_1_USDC[type].
 * Used in task creation (backend + frontend) and anywhere estimated reach or reward per user is shown.
 */
export const USERS_PER_1_USDC: Record<string, number> = {
  follow: 40,
  boost_lite: 30,
  boost: 25,
  quote: 30,
  channel: 50,
  multi: 20,
  miniapp: 15,
  x_follow: 25,
  x_boost_lite: 40,
  x_boost: 20,
  x_bundle: 15,
};

export { APP_URL };
