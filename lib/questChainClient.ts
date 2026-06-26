import {
  ARBITRUM_CHAIN_ID,
  CELO_CHAIN_ID,
  getChainConfig,
  getCustomEscrowAddress,
  getSocialEscrowAddress,
  getTaskChainId,
  type RewardTokenSymbol,
} from '@/lib/chainConfig';
import {
  CUSTOM_TASK_ESCROW_ABI,
  G_DOLLAR_ABI,
  TASK_ESCROW_ABI,
  USDC_ABI,
} from '@/lib/contracts';
import { createPublicClient, http } from 'viem';
import { arbitrum, celo } from 'wagmi/chains';
import { getRpcUrl } from '@/lib/chainRpc';

export type RewardChainChoice = 'arbitrum' | 'celo';

export function rewardChainToChainId(choice: RewardChainChoice): typeof ARBITRUM_CHAIN_ID | typeof CELO_CHAIN_ID {
  return choice === 'celo' ? CELO_CHAIN_ID : ARBITRUM_CHAIN_ID;
}

export function getQuestChainUi(choice: RewardChainChoice) {
  const chainId = rewardChainToChainId(choice);
  const config = getChainConfig(chainId);
  const isG = config.token.symbol === 'G$';
  return {
    chainId,
    config,
    choice,
    tokenAddress: config.token.address,
    tokenAbi: isG ? G_DOLLAR_ABI : USDC_ABI,
    tokenDecimals: config.token.decimals,
    tokenSymbol: config.token.symbol as RewardTokenSymbol,
    socialEscrow: config.escrow.social,
    customEscrow: config.escrow.custom,
    escrowAbi: TASK_ESCROW_ABI,
    customEscrowAbi: CUSTOM_TASK_ESCROW_ABI,
    feeAmount: isG ? config.ubiFeeAmount : config.platformFee,
    feeRecipient: config.feeRecipient,
    feeLabel: isG ? 'UBI contribution' : 'Platform fee',
    budgetMin: 1,
    budgetMax: isG ? 50000 : 50,
    chainName: config.name,
  };
}

export function getViemPublicClient(chainId: number) {
  return createPublicClient({
    chain: chainId === CELO_CHAIN_ID ? celo : arbitrum,
    transport: http(getRpcUrl(chainId)),
  });
}

export function getTaskChainUi(task: { chainId?: number | null; rewardToken?: string | null; type?: string }) {
  const chainId = getTaskChainId(task);
  const config = getChainConfig(chainId);
  const isCustom = task.type === 'custom_onchain';
  const isG = config.token.symbol === 'G$';
  return {
    chainId,
    config,
    tokenAddress: config.token.address,
    tokenAbi: isG ? G_DOLLAR_ABI : USDC_ABI,
    tokenDecimals: config.token.decimals,
    tokenSymbol: config.token.symbol as RewardTokenSymbol,
    escrowAddress: isCustom ? getCustomEscrowAddress(chainId) : getSocialEscrowAddress(chainId),
    escrowAbi: isCustom ? CUSTOM_TASK_ESCROW_ABI : TASK_ESCROW_ABI,
    chainName: config.name,
  };
}
