import { getChainConfig, getCustomEscrowAddress, getTaskChainId } from '@/lib/chainConfig';
import type { SupportedChainId } from '@/lib/chainConfig';

export function getCustomTaskEip712Domain(chainId?: number | null) {
  const config = getChainConfig(chainId);
  const verifyingContract = getCustomEscrowAddress(chainId);
  if (!verifyingContract) {
    throw new Error('Custom task escrow contract is not configured for this chain');
  }
  return {
    name: config.eip712.customDomain,
    version: '1',
    chainId: config.chainId as SupportedChainId,
    verifyingContract,
  };
}

export function getSocialTaskEip712Domain(chainId?: number | null) {
  const config = getChainConfig(chainId);
  return {
    name: config.eip712.socialDomain,
    version: '1',
    chainId: config.chainId as SupportedChainId,
    verifyingContract: config.escrow.social,
  };
}

export function resolveTaskChainId(task: { chainId?: number | null }): SupportedChainId {
  return getTaskChainId(task);
}

export const CUSTOM_CLAIM_TYPES = {
  Claim: [
    { name: 'taskId', type: 'bytes32' },
    { name: 'creator', type: 'address' },
    { name: 'claimer', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

export const CUSTOM_RECLAIM_TYPES = {
  Reclaim: [
    { name: 'taskId', type: 'bytes32' },
    { name: 'creator', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ],
};

export const ESCROW_SIGNER_PRIVATE_KEY = process.env.ESCROW_SIGNER_PRIVATE_KEY;
