export const ARBITRUM_CHAIN_ID = 42161 as const;

// Arbitrum Mainnet USDC (native, 6 decimals)
export const USDC_ADDRESS = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const;

// Platform fee: 0.25 USDC per quest creation
export const PLATFORM_FEE_ADDRESS = '0xe6CfdAf74bFEC00FafdE9724A46cb052548C8488' as const;
export const PLATFORM_FEE_USDC = 0.25;

export const TASK_ESCROW_ADDRESS = '0xaFbB51Edf73390F4181492b5227E99936729d043' as const;

export const CUSTOM_TASK_ESCROW_ADDRESS: `0x${string}` =
  (process.env.NEXT_PUBLIC_CUSTOM_TASK_ESCROW_ADDRESS as `0x${string}` | undefined) ??
  '0x0000000000000000000000000000000000000000';export const CELO_CHAIN_ID = 42220 as const;

export type SupportedChainId = typeof ARBITRUM_CHAIN_ID | typeof CELO_CHAIN_ID;

export const G_DOLLAR_ADDRESS =
  '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A' as const;

/** GoodDollar UBIScheme on Celo — G$ sent here funds daily UBI for verified users */
export const UBI_SCHEME_ADDRESS =
  '0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1' as const;

const UNCONFIGURED = '0x0000000000000000000000000000000000000000';

export type RewardTokenSymbol = 'USDC' | 'G$';

export interface ChainConfig {
  chainId: SupportedChainId;
  name: string;
  token: {
    symbol: RewardTokenSymbol;
    address: `0x${string}`;
    decimals: number;
  };
  escrow: {
    social: `0x${string}`;
    custom: `0x${string}` | null;
  };
  eip712: {
    socialDomain: string;
    customDomain: string;
  };
  rpcUrls: string[];
  blockExplorer: string;
  /** Platform fee in token units (USDC) or 0 when using UBI fee */
  platformFee: number;
  /** Optional fee recipient — platform wallet (USDC) or UBI pool (G$) */
  feeRecipient: `0x${string}`;
  /** G$ amount sent to UBI pool per quest (human-readable, 18 decimals on-chain) */
  ubiFeeAmount: number;
}

function resolveCeloSocialEscrow(): `0x${string}` {
  const addr =
    (process.env.NEXT_PUBLIC_CELO_SOCIAL_ESCROW_ADDRESS as `0x${string}` | undefined) ??
    UNCONFIGURED;
  return addr;
}

function resolveCeloCustomEscrow(): `0x${string}` | null {
  const addr =
    (process.env.NEXT_PUBLIC_CELO_CUSTOM_ESCROW_ADDRESS as `0x${string}` | undefined) ??
    UNCONFIGURED;
  if (addr.toLowerCase() === UNCONFIGURED) return null;
  return addr;
}

function resolveUbiFeeAmount(): number {
  const raw = process.env.NEXT_PUBLIC_UBI_FEE_G_DOLLAR;
  const parsed = raw != null ? Number(raw) : 2200;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2200;
}

export const CHAIN_CONFIGS: Record<SupportedChainId, ChainConfig> = {
  [ARBITRUM_CHAIN_ID]: {
    chainId: ARBITRUM_CHAIN_ID,
    name: 'Arbitrum One',
    token: {
      symbol: 'USDC',
      address: USDC_ADDRESS,
      decimals: 6,
    },
    escrow: {
      social: TASK_ESCROW_ADDRESS,
      custom:
        CUSTOM_TASK_ESCROW_ADDRESS.toLowerCase() === UNCONFIGURED
          ? null
          : CUSTOM_TASK_ESCROW_ADDRESS,
    },
    eip712: {
      socialDomain: 'TaskPay',
      customDomain: 'CustomTaskPay',
    },
    rpcUrls: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://rpc.ankr.com/arbitrum',
      'https://1rpc.io/arb',
    ],
    blockExplorer: 'https://arbiscan.io',
    platformFee: PLATFORM_FEE_USDC,
    feeRecipient: PLATFORM_FEE_ADDRESS,
    ubiFeeAmount: 0,
  },
  [CELO_CHAIN_ID]: {
    chainId: CELO_CHAIN_ID,
    name: 'Celo',
    token: {
      symbol: 'G$',
      address: G_DOLLAR_ADDRESS,
      decimals: 18,
    },
    escrow: {
      social: resolveCeloSocialEscrow(),
      custom: resolveCeloCustomEscrow(),
    },
    eip712: {
      socialDomain: 'GoodTaskPay',
      customDomain: 'GoodCustomTaskPay',
    },
    rpcUrls: ['https://forno.celo.org', 'https://rpc.ankr.com/celo'],
    blockExplorer: 'https://celoscan.io',
    platformFee: 0,
    feeRecipient: UBI_SCHEME_ADDRESS,
    ubiFeeAmount: resolveUbiFeeAmount(),
  },
};

export function getChainConfig(chainId?: number | null): ChainConfig {
  if (chainId === CELO_CHAIN_ID) return CHAIN_CONFIGS[CELO_CHAIN_ID];
  return CHAIN_CONFIGS[ARBITRUM_CHAIN_ID];
}

export function getTaskChainId(task: { chainId?: number | null }): SupportedChainId {
  return task.chainId === CELO_CHAIN_ID ? CELO_CHAIN_ID : ARBITRUM_CHAIN_ID;
}

export function getRewardTokenSymbol(
  task: { rewardToken?: string | null; chainId?: number | null },
): RewardTokenSymbol {
  if (task.rewardToken === 'G$' || task.chainId === CELO_CHAIN_ID) return 'G$';
  return 'USDC';
}

export function isCeloChain(chainId?: number | null): boolean {
  return chainId === CELO_CHAIN_ID;
}

export function getSocialEscrowAddress(chainId?: number | null): `0x${string}` {
  return getChainConfig(chainId).escrow.social;
}

export function getCustomEscrowAddress(chainId?: number | null): `0x${string}` | null {
  return getChainConfig(chainId).escrow.custom;
}

export function getTokenAddress(chainId?: number | null): `0x${string}` {
  return getChainConfig(chainId).token.address;
}

export function validateChainTokenPair(
  chainId: number | undefined,
  rewardToken: string | undefined,
): string | null {
  const cid = chainId ?? ARBITRUM_CHAIN_ID;
  const token = rewardToken ?? 'USDC';
  if (cid === CELO_CHAIN_ID && token !== 'G$') {
    return 'Celo quests must use G$ as reward token';
  }
  if (cid === ARBITRUM_CHAIN_ID && token !== 'USDC') {
    return 'Arbitrum quests must use USDC as reward token';
  }
  if (cid !== ARBITRUM_CHAIN_ID && cid !== CELO_CHAIN_ID) {
    return 'Unsupported chain';
  }
  return null;
}
