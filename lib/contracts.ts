// Contract addresses and ABIs for TaskEscrow + USDC + G$

import { ARBITRUM_CHAIN_ID, getCustomEscrowAddress } from '@/lib/chainConfig';

export {
  ARBITRUM_CHAIN_ID,
  CELO_CHAIN_ID,
  CHAIN_CONFIGS,
  CUSTOM_TASK_ESCROW_ADDRESS,
  G_DOLLAR_ADDRESS,
  PLATFORM_FEE_ADDRESS,
  PLATFORM_FEE_USDC,
  TASK_ESCROW_ADDRESS,
  UBI_SCHEME_ADDRESS,
  USDC_ADDRESS,
  getChainConfig,
  getCustomEscrowAddress,
  getRewardTokenSymbol,
  getSocialEscrowAddress,
  getTaskChainId,
  getTokenAddress,
  isCeloChain,
  validateChainTokenPair,
  type ChainConfig,
  type RewardTokenSymbol,
  type SupportedChainId,
} from '@/lib/chainConfig';

export function getCustomTaskEscrowAddress(): `0x${string}` | null {
  return getCustomEscrowAddress(ARBITRUM_CHAIN_ID);
}

export const USDC_ABI = [
    {
        name: 'approve',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'decimals',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
    },
    {
        name: 'transfer',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'to', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
] as const;

export const TASK_ESCROW_ABI = [
    // deposit
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
    },
    // claim
    {
        name: 'claim',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
            { name: 'creator', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
    // verifyTask
    {
        name: 'verifyTask',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'taskId', type: 'bytes32' }],
        outputs: [],
    },
    // getDeposit
    {
        name: 'getDeposit',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'creator', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    // getDepositToken (token used for creator's task deposit)
    {
        name: 'getDepositToken',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'creator', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'address' }],
    },
    // getDepositLimits
    {
        name: 'getDepositLimits',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'token', type: 'address' }],
        outputs: [
            { name: 'minAmount', type: 'uint256' },
            { name: 'maxAmount', type: 'uint256' },
        ],
    },
    // isNonceUsed
    {
        name: 'isNonceUsed',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'claimer', type: 'address' },
            { name: 'nonce', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    // hasClaimedTask — check if claimer has already claimed for this task
    {
        name: 'hasClaimedTask',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'claimer', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    // getDomainSeparator
    {
        name: 'getDomainSeparator',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
    },
    // Events
    {
        name: 'Deposited',
        type: 'event',
        inputs: [
            { name: 'creator', type: 'address', indexed: true },
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
            { name: 'token', type: 'address', indexed: false },
        ],
    },
    {
        name: 'Claimed',
        type: 'event',
        inputs: [
            { name: 'claimer', type: 'address', indexed: true },
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        name: 'TaskVerified',
        type: 'event',
        inputs: [
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'verifier', type: 'address', indexed: true },
        ],
    },
] as const;

export const CUSTOM_TASK_ESCROW_ABI = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
    },
    {
        name: 'claim',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
            { name: 'creator', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        name: 'reclaim',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'token', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
            { name: 'amount', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'signature', type: 'bytes' },
        ],
        outputs: [],
    },
    {
        name: 'getDeposit',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'creator', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'getDepositToken',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'creator', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'address' }],
    },
    {
        name: 'hasClaimedTask',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'claimer', type: 'address' },
            { name: 'taskId', type: 'bytes32' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'isNonceUsed',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'claimer', type: 'address' },
            { name: 'nonce', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'getDomainSeparator',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'bytes32' }],
    },
    {
        name: 'Deposited',
        type: 'event',
        inputs: [
            { name: 'creator', type: 'address', indexed: true },
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'fee', type: 'uint256', indexed: false },
            { name: 'token', type: 'address', indexed: false },
        ],
    },
    {
        name: 'Claimed',
        type: 'event',
        inputs: [
            { name: 'claimer', type: 'address', indexed: true },
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'creator', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        name: 'Reclaimed',
        type: 'event',
        inputs: [
            { name: 'creator', type: 'address', indexed: true },
            { name: 'taskId', type: 'bytes32', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
] as const;

/** G$ uses the same ERC-20 interface as USDC for approve/transfer/balanceOf */
export const G_DOLLAR_ABI = USDC_ABI;

// ── TaskPayChat (Community Chat Registration) ──
// TODO: Update this after deploying TaskPayChat.sol
export const TASKPAY_CHAT_ADDRESS = '0xdf1937B71E88dE6f8CDa5fA6F5Ddfba8bFA72fea' as const;

export const TASKPAY_CHAT_ABI = [
    {
        name: 'register',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [],
        outputs: [],
    },
    {
        name: 'checkRegistered',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'isRegistered',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
    },
    {
        name: 'memberCount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
    {
        name: 'MemberRegistered',
        type: 'event',
        inputs: [
            { name: 'user', type: 'address', indexed: true },
            { name: 'memberIndex', type: 'uint256', indexed: true },
        ],
    },
] as const;
