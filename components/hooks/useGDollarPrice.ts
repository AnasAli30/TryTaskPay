'use client';

import { useState, useEffect } from 'react';
import { G_DOLLAR_PRICE_FALLBACK } from '@/lib/gdollarPrice';

const CACHE_KEY = 'gdollar_price';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedPrice {
  price: number;
  ts: number;
}

function getCachedPrice(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedPrice = JSON.parse(raw);
    if (Date.now() - cached.ts < CACHE_TTL_MS) return cached.price;
  } catch { /* ignore */ }
  return null;
}

function setCachedPrice(price: number) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ price, ts: Date.now() }));
  } catch { /* ignore */ }
}

/**
 * React hook that returns the current G$ price in USD.
 * Falls back to the hardcoded fallback if the API is unreachable.
 */
export function useGDollarPrice(): { price: number; loading: boolean } {
  const [price, setPrice] = useState<number>(() => getCachedPrice() ?? G_DOLLAR_PRICE_FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCachedPrice();
    if (cached !== null) {
      setPrice(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gdollar-price');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (!cancelled && typeof data.price === 'number' && data.price > 0) {
          setPrice(data.price);
          setCachedPrice(data.price);
        }
      } catch {
        // keep fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { price, loading };
}
