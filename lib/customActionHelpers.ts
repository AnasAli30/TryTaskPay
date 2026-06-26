import type { CustomActionCategory } from '@/lib/types';

export const CUSTOM_ACTION_CATEGORIES: { id: CustomActionCategory; label: string }[] = [
  { id: 'defi', label: 'DeFi' },
  { id: 'nft', label: 'NFT' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'social', label: 'Social' },
  { id: 'bridge', label: 'Bridge' },
  { id: 'governance', label: 'Governance' },
  { id: 'payments', label: 'Payments' },
  { id: 'other', label: 'Other' },
];

export function getCategoryLabel(id: CustomActionCategory): string {
  return CUSTOM_ACTION_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export function isValidHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Human-readable on-chain trigger, e.g. Transfer (swapExactTokensForTokens) */
export function formatOnChainTrigger(opts: {
  functionName?: string;
  functionSelector?: string;
  eventName?: string;
  eventSignature?: string;
}): string {
  const fn = opts.functionName || opts.functionSelector;
  const event =
    opts.eventName ||
    (opts.eventSignature?.startsWith('0x')
      ? `Event ${opts.eventSignature.slice(2, 10)}`
      : undefined);

  if (event && fn) return `${event} (${fn})`;
  if (event) return event;
  if (fn) return fn;
  return '—';
}
