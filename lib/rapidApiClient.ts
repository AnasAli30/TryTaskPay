import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export const RAPIDAPI_HOST = 'twitter-api45.p.rapidapi.com';

/**
 * Load all available RapidAPI keys from env.
 * Reads RAPIDAPI_KEY, RAPIDAPI_KEY2, RAPIDAPI_KEY3, RAPIDAPI_KEY4, RAPIDAPI_KEY5.
 */
function loadApiKeys(): string[] {
  const keys: string[] = [];
  const envNames = [
    'RAPIDAPI_KEY',
    'RAPIDAPI_KEY2',
    'RAPIDAPI_KEY3',
    'RAPIDAPI_KEY4',
    'RAPIDAPI_KEY5',
  ];
  for (const name of envNames) {
    const val = process.env[name]?.replace(/['"]/g, '').trim();
    if (val) keys.push(val);
  }
  return keys;
}

function shuffleStartIndex<T>(arr: T[]): { items: T[]; startIndex: number } {
  if (arr.length <= 1) return { items: arr, startIndex: 0 };
  const startIndex = Math.floor(Math.random() * arr.length);
  if (startIndex === 0) return { items: arr, startIndex };
  return { items: arr.slice(startIndex).concat(arr.slice(0, startIndex)), startIndex };
}

function keyLabelFromOriginalIndex(originalIndex: number): string {
  return originalIndex === 0 ? 'RAPIDAPI_KEY' : `RAPIDAPI_KEY${originalIndex + 1}`;
}

/**
 * Determines if an error should trigger a key rotation (rate limit, auth failure).
 */
function shouldRotateKey(error: any): boolean {
  const status = error?.response?.status;
  // 429 = rate limit, 403 = forbidden/quota, 401 = unauthorized
  return status === 429 || status === 403 || status === 401;
}

export interface RapidApiRequestOptions {
  /** Full URL to call, e.g. https://twitter-api45.p.rapidapi.com/tweet.php */
  url: string;
  /** Query params */
  params?: Record<string, string>;
  /** Request timeout in ms (default 15000) */
  timeout?: number;
}

/**
 * Make a GET request to RapidAPI, trying all available keys on failure.
 */
export async function rapidApiGet<T = any>(
  options: RapidApiRequestOptions
): Promise<AxiosResponse<T>> {
  const { url, params, timeout = 15000 } = options;

  const loadedKeys = loadApiKeys();
  if (loadedKeys.length === 0) {
    throw new Error('[rapidApiClient] No RAPIDAPI_KEY found in environment variables');
  }

  // Randomize the first key to distribute usage across keys.
  // Still falls back to the others on 401/403/429.
  const { items: keys, startIndex } = shuffleStartIndex(loadedKeys);

  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const originalIndex = (startIndex + i) % loadedKeys.length;
    const keyLabel = keyLabelFromOriginalIndex(originalIndex);
    try {
      console.log(`[rapidApiClient] Trying ${keyLabel} for ${url}`);
      const config: AxiosRequestConfig = {
        params,
        headers: {
          'x-rapidapi-key': key,
          'x-rapidapi-host': RAPIDAPI_HOST,
          'Content-Type': 'application/json',
        },
        timeout,
      };

      const res = await axios.get<T>(url, config);
      return res;
    } catch (err: any) {
      lastError = err;
      const status = err?.response?.status;
      console.error(
        `[rapidApiClient] ${keyLabel} failed (status=${status}): ${err?.message}`
      );

      if (shouldRotateKey(err) && i < keys.length - 1) {
        console.log(`[rapidApiClient] Rotating to next key...`);
        continue;
      }

      // Non-rotatable error or last key — throw
      throw err;
    }
  }

  throw lastError;
}

/**
 * Get the first available RapidAPI key (for cases where you need the raw key).
 */
export function getFirstRapidApiKey(): string {
  const keys = loadApiKeys();
  return keys[0] || '';
}
