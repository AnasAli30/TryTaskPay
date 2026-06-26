'use client';

import { useAppMode } from '@/components/app-mode-provider';
import { useFrame } from '@/components/farcaster-provider';
import { USDC_ADDRESS } from '@/lib/contracts';
import {
  miniAppOpenMiniApp,
  miniAppOpenUrl,
  miniAppViewCast,
  miniAppViewProfile,
  normalizeFid,
} from '@/lib/farcasterSdkActions';

function buildUniswapArbUsdcUrl(usdcNeeded?: number): string {
  const params = new URLSearchParams({
    chain: 'arbitrum',
    inputCurrency: 'NATIVE',
    outputCurrency: USDC_ADDRESS,
    field: usdcNeeded != null && usdcNeeded > 0 ? 'output' : 'input',
    value:
      usdcNeeded != null && usdcNeeded > 0
        ? (Math.ceil(usdcNeeded * 100) / 100).toString()
        : '0.0008',
  });
  return `https://app.uniswap.org/swap?${params.toString()}`;
}

export type SwapTokenOptions = { buyToken?: string; buyAmount?: number };

export function useAppActions() {
  const { isBrowser } = useAppMode();
  const { actions } = useFrame();

  if (!isBrowser) {
    return {
      viewProfile: async (opts: { fid: unknown; username?: string }) => {
        try {
          await miniAppViewProfile(opts.fid);
        } catch (e) {
          console.warn('[TaskPay] viewProfile failed', e);
          const fid = normalizeFid(opts.fid);
          if (fid) {
            await miniAppOpenUrl(`https://farcaster.xyz/profiles/${fid}`);
            return;
          }
          const username = opts.username?.replace(/^@/, '').trim();
          if (username) await miniAppOpenUrl(`https://farcaster.xyz/${username}`);
        }
      },
      viewCast: async (opts: { hash: string }) => {
        try {
          await miniAppViewCast(opts.hash);
        } catch (e) {
          console.warn('[TaskPay] viewCast failed', e);
          const hash = String(opts.hash ?? '').trim();
          if (hash) await miniAppOpenUrl(`https://farcaster.xyz/~/conversations/${hash}`);
        }
      },
      openMiniApp: (opts: { url: string }) => miniAppOpenMiniApp(opts.url),
      openUrl: (url: string) => miniAppOpenUrl(url),
      composeCast: (opts: { text: string; embeds?: string[] }) => {
        const embeds = opts.embeds?.filter((e): e is string => typeof e === 'string').slice(0, 2);
        return actions?.composeCast?.({
          text: opts.text,
          ...(embeds?.length ? { embeds: embeds as [string] | [string, string] } : {}),
        });
      },
      swapToken: (opts: SwapTokenOptions) =>
        actions?.swapToken?.({
          buyToken: opts.buyToken ?? USDC_ADDRESS,
          ...(opts.buyAmount != null ? { buyAmount: opts.buyAmount } : {}),
        }),
    };
  }

  return {
    viewProfile: (opts: { fid: unknown; username?: string }) => {
      const fid = normalizeFid(opts.fid);
      if (fid) {
        window.open(`https://farcaster.xyz/profiles/${fid}`, '_blank', 'noopener,noreferrer');
        return;
      }
      const username = opts.username?.replace(/^@/, '').trim();
      if (username) {
        window.open(`https://farcaster.xyz/${username}`, '_blank', 'noopener,noreferrer');
      }
    },
    viewCast: (opts: { hash: string }) => {
      window.open(`https://farcaster.xyz/~/conversations/${opts.hash}`, '_blank', 'noopener,noreferrer');
    },
    openMiniApp: (opts: { url: string }) => {
      window.open(opts.url, '_blank', 'noopener,noreferrer');
    },
    openUrl: (url: string) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    composeCast: async (opts: { text: string; embeds?: string[] }) => {
      const embed = opts.embeds?.[0] ? `&embeds[]=${encodeURIComponent(opts.embeds[0])}` : '';
      window.open(
        `https://warpcast.com/~/compose?text=${encodeURIComponent(opts.text)}${embed}`,
        '_blank',
        'noopener,noreferrer',
      );
    },
    swapToken: async (opts?: SwapTokenOptions) => {
      window.open(buildUniswapArbUsdcUrl(opts?.buyAmount), '_blank', 'noopener,noreferrer');
    },
  };
}
