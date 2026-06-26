/**
 * G$ (GoodDollar) price utilities.
 *
 * 1 G$ ≈ $0.000114 USD (fluctuates).
 * We fetch the live price from CoinGecko and cache it server-side for 5 minutes.
 */

const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=gooddollar&vs_currencies=usd';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cachedPrice: number | null = null;
let cachedAt = 0;

/** Fallback price when CoinGecko is unreachable. Updated periodically. */
export const G_DOLLAR_PRICE_FALLBACK = 0.000114;

/**
 * Fetch the current G$ → USD price (server-side, cached).
 * Falls back to `G_DOLLAR_PRICE_FALLBACK` on error.
 */
export async function fetchGDollarPrice(): Promise<number> {
  if (cachedPrice !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const res = await fetch(COINGECKO_URL, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    const price = data?.gooddollar?.usd;
    if (typeof price === 'number' && price > 0) {
      cachedPrice = price;
      cachedAt = Date.now();
      return price;
    }
    throw new Error('Invalid price data');
  } catch {
    return cachedPrice ?? G_DOLLAR_PRICE_FALLBACK;
  }
}

/** Convert a G$ amount to its USD equivalent. */
export function gDollarToUSD(gAmount: number, price: number): number {
  return gAmount * price;
}

/** Convert a USD amount to its G$ equivalent. */
export function usdToGDollar(usdAmount: number, price: number): number {
  if (price <= 0) return 0;
  return usdAmount / price;
}

/**
 * Format a G$ amount with its approximate USD value.
 * e.g. "1,000 G$ (~$0.11)"
 */
export function formatGDollarWithUSD(gAmount: number, price: number): string {
  const usd = gDollarToUSD(gAmount, price);
  const gFormatted = gAmount >= 1 ? Math.round(gAmount).toLocaleString() : gAmount.toFixed(2);
  if (usd < 0.01) return `${gFormatted} G$ (~$${usd.toFixed(4)})`;
  if (usd < 1) return `${gFormatted} G$ (~$${usd.toFixed(3)})`;
  return `${gFormatted} G$ (~$${usd.toFixed(2)})`;
}
