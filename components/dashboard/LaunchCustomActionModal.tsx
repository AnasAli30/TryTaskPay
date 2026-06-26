'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBullseye,
  faCalendarDays,
  faCheck,
  faCircleInfo,
  faClock,
  faCoins,
  faImage,
  faRocket,
  faShieldHalved,
  faSpinner,
  faStar,
  faUsers,
  faWallet,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { encodeFunctionData, parseUnits } from 'viem';
import { arbitrum, celo } from 'wagmi/chains';
import { useConfig, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi';
import {
  CUSTOM_TASK_ESCROW_ABI,
  G_DOLLAR_ABI,
  USDC_ABI,
} from '@/lib/contracts';
import { CELO_CHAIN_ID } from '@/lib/chainConfig';
import { getQuestChainUi } from '@/lib/questChainClient';
import {
  CUSTOM_LAUNCH_MAX_PER_USER_USDC,
  CUSTOM_LAUNCH_MAX_TOTAL_USDC,
  CUSTOM_LAUNCH_MIN_PER_USER_USDC,
  CUSTOM_LAUNCH_MIN_TOTAL_USDC,
  getCustomMaxCompletions,
  getCustomLaunchLimits,
  validateCustomLaunchInput,
} from '@/lib/customActionLaunch';
import { formatOnChainTrigger, getCategoryLabel } from '@/lib/customActionHelpers';
import { pickEscrowDepositTxHash } from '@/components/Promote/createTaskUtils';
import { ensureBrowserWalletClient } from '@/lib/ensureBrowserWallet';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import type { CustomActionLaunchDraft, CustomActionDistributionChannel } from '@/lib/types';
import type { CustomActionRow } from '@/components/hooks/useProfileDashboard';

interface LaunchCustomActionModalProps {
  action: CustomActionRow | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type LaunchStep =
  | 'idle'
  | 'saving_config'
  | 'creating_task'
  | 'batching'
  | 'waiting_tx'
  | 'confirming'
  | 'done'
  | 'error';

type SequentialTxKey = 'approve' | 'deposit' | 'fee';
type SequentialTxStatus = 'pending' | 'wallet' | 'confirming' | 'done';

const SEQUENTIAL_TX_PENDING: Record<SequentialTxKey, SequentialTxStatus> = {
  approve: 'pending',
  deposit: 'pending',
  fee: 'pending',
};

export function LaunchCustomActionModal({ action, open, onClose, onSaved }: LaunchCustomActionModalProps) {
  const wagmiConfig = useConfig();
  const rewardChain = action?.chainId === CELO_CHAIN_ID ? 'celo' : 'arbitrum';
  const questChain = getQuestChainUi(rewardChain);
  const activeChain = rewardChain === 'celo' ? celo : arbitrum;
  const publicClient = usePublicClient({ chainId: questChain.chainId });
  const { data: walletClient } = useWalletClient({ chainId: questChain.chainId });
  const { switchChainAsync } = useSwitchChain();
  const { walletAddress, siweVerified } = useBrowserAuth();

  const [perUserReward, setPerUserReward] = useState(0.04);
  const [totalBudget, setTotalBudget] = useState(10);
  const [expiresInDays, setExpiresInDays] = useState<1 | 3>(3);
  const [targetingEnabled, setTargetingEnabled] = useState(false);
  const [minFollowers, setMinFollowers] = useState<number | ''>('');
  const [minNeynarScore, setMinNeynarScore] = useState<number | ''>('');
  const [minAccountAgeDays, setMinAccountAgeDays] = useState<number | ''>('');
  const [nonSpamOnly, setNonSpamOnly] = useState(false);
  const [launchStep, setLaunchStep] = useState<LaunchStep>('idle');
  const [depositTxMode, setDepositTxMode] = useState<'batch' | 'sequential' | null>(null);
  const [sequentialTxStep, setSequentialTxStep] = useState(SEQUENTIAL_TX_PENDING);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const escrowAddress = questChain.customEscrow;
  const launching = launchStep !== 'idle' && launchStep !== 'done' && launchStep !== 'error';
  const channels = action?.distributionChannels ?? [];
  const hasFarcaster = channels.includes('farcaster');
  const dappOnly = channels.length === 1 && channels[0] === 'dapp';
  const maxCompletions = getCustomMaxCompletions(totalBudget, perUserReward);
  const totalCost = totalBudget + questChain.feeAmount;
  const tokenSymbol = questChain.tokenSymbol;
  const isG = rewardChain === 'celo';

  useEffect(() => {
    if (!open || !action) return;
    setError(null);
    setSuccess(false);
    setLaunchStep('idle');
    setDepositTxMode(null);
    setSequentialTxStep(SEQUENTIAL_TX_PENDING);
    const draft = action.launchDraft as CustomActionLaunchDraft | undefined;
    if (draft) {
      setPerUserReward(draft.perUserRewardUsdc);
      setTotalBudget(draft.totalBudgetUsdc);
      setExpiresInDays(draft.expiresInDays);
      setTargetingEnabled(!!draft.targetingEnabled);
      setMinFollowers(draft.minFollowers ?? '');
      setMinNeynarScore(draft.minNeynarScore ?? '');
      setMinAccountAgeDays(draft.minAccountAgeDays ?? '');
      setNonSpamOnly(!!draft.nonSpamOnly);
    } else {
      setPerUserReward(0.04);
      setTotalBudget(10);
      setExpiresInDays(3);
      setTargetingEnabled(false);
      setMinFollowers('');
      setMinNeynarScore('');
      setMinAccountAgeDays('');
      setNonSpamOnly(false);
    }
  }, [open, action]);

  if (!open || !action) return null;

  const buildLaunchInput = () => ({
    perUserRewardUsdc: perUserReward,
    totalBudgetUsdc: totalBudget,
    expiresInDays,
    targetingEnabled: hasFarcaster && targetingEnabled,
    minFollowers: minFollowers === '' ? undefined : Number(minFollowers),
    minNeynarScore: minNeynarScore === '' ? undefined : Number(minNeynarScore),
    minAccountAgeDays: minAccountAgeDays === '' ? undefined : Number(minAccountAgeDays),
    nonSpamOnly: hasFarcaster && targetingEnabled ? nonSpamOnly : undefined,
  });

  const handleLaunch = async () => {
    setError(null);
    setSuccess(false);

    if (!escrowAddress) {
      setError(
        isG
          ? 'Celo custom task escrow is not configured. Deploy GoodCustomTaskPay.sol and set NEXT_PUBLIC_CELO_CUSTOM_ESCROW_ADDRESS.'
          : 'Custom task escrow is not configured. Deploy CustomTaskPay.sol and set NEXT_PUBLIC_CUSTOM_TASK_ESCROW_ADDRESS.',
      );
      return;
    }

    const input = buildLaunchInput();
    const validationError = validateCustomLaunchInput(input, hasFarcaster, tokenSymbol);
    if (validationError) {
      setError(validationError);
      return;
    }

    let txAddress = walletAddress as `0x${string}` | undefined;
    let txWalletClient = walletClient;

    if ((!txAddress || !txWalletClient) && siweVerified) {
      const ensured = await ensureBrowserWalletClient(wagmiConfig, walletAddress ?? undefined);
      if (ensured) {
        txAddress = ensured.address;
        txWalletClient = ensured.walletClient as typeof walletClient;
      }
    }

    if (!txAddress || !txWalletClient) {
      setError('Connect your wallet to fund and launch this task.');
      return;
    }

    if (!publicClient) {
      setError(`Wallet not ready. Switch to ${questChain.chainName} and try again.`);
      return;
    }

    try {
      await switchChainAsync({ chainId: questChain.chainId });
      setLaunchStep('saving_config');
      await axios.post('/api/custom-actions/launch-config', {
        customActionId: action._id,
        ...input,
      });

      setLaunchStep('creating_task');
      const launchRes = await axios.post('/api/custom-actions/launch', {
        customActionId: action._id,
      });
      const { taskId, onChainTaskId } = launchRes.data;
      if (!taskId || !onChainTaskId) {
        throw new Error('Failed to create task');
      }

      const amountWei = parseUnits(totalBudget.toString(), questChain.tokenDecimals);
      const feeWei = parseUnits(questChain.feeAmount.toString(), questChain.tokenDecimals);
      const tokenAddress = questChain.tokenAddress;
      const tokenAbi = isG ? G_DOLLAR_ABI : USDC_ABI;
      const feeRecipient = questChain.feeRecipient;
      let txHash: `0x${string}` | undefined;

      setLaunchStep('batching');
      try {
        setDepositTxMode('batch');
        const { id } = await txWalletClient.sendCalls({
          account: txAddress,
          calls: [
            {
              to: tokenAddress,
              data: encodeFunctionData({
                abi: tokenAbi,
                functionName: 'approve',
                args: [escrowAddress, amountWei],
              }),
            },
            {
              to: escrowAddress,
              data: encodeFunctionData({
                abi: CUSTOM_TASK_ESCROW_ABI,
                functionName: 'deposit',
                args: [tokenAddress, onChainTaskId as `0x${string}`, amountWei],
              }),
            },
            {
              to: tokenAddress,
              data: encodeFunctionData({
                abi: tokenAbi,
                functionName: 'transfer',
                args: [feeRecipient, feeWei],
              }),
            },
          ],
        });
        setLaunchStep('waiting_tx');
        const result = await txWalletClient.waitForCallsStatus({ id });
        if (result.status === 'success' && result.receipts?.length) {
          txHash = pickEscrowDepositTxHash(result.receipts, escrowAddress);
        }
      } catch {
        setDepositTxMode('sequential');
        setLaunchStep('waiting_tx');

        setSequentialTxStep((s) => ({ ...s, approve: 'wallet' }));
        const approveHash = await txWalletClient.writeContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: 'approve',
          args: [escrowAddress, amountWei],
          account: txAddress,
          chain: activeChain,
        });
        setSequentialTxStep((s) => ({ ...s, approve: 'confirming' }));
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        setSequentialTxStep((s) => ({ ...s, approve: 'done', deposit: 'wallet' }));

        const depositHash = await txWalletClient.writeContract({
          address: escrowAddress,
          abi: CUSTOM_TASK_ESCROW_ABI,
          functionName: 'deposit',
          args: [tokenAddress, onChainTaskId as `0x${string}`, amountWei],
          account: txAddress,
          chain: activeChain,
        });
        setSequentialTxStep((s) => ({ ...s, deposit: 'confirming' }));
        await publicClient.waitForTransactionReceipt({ hash: depositHash });
        txHash = depositHash;
        setSequentialTxStep((s) => ({ ...s, deposit: 'done', fee: 'wallet' }));

        const feeHash = await txWalletClient.writeContract({
          address: tokenAddress,
          abi: tokenAbi,
          functionName: 'transfer',
          args: [feeRecipient, feeWei],
          account: txAddress,
          chain: activeChain,
        });
        setSequentialTxStep((s) => ({ ...s, fee: 'confirming' }));
        await publicClient.waitForTransactionReceipt({ hash: feeHash });
        setSequentialTxStep((s) => ({ ...s, fee: 'done' }));
      }

      if (!txHash) {
        throw new Error('Deposit transaction did not complete.');
      }

      setLaunchStep('confirming');
      await axios.post('/api/custom-actions/confirm-deposit', {
        taskId,
        depositTxHash: txHash,
        creatorAddress: txAddress,
      });

      setLaunchStep('done');
      setSuccess(true);
      onSaved();
      setTimeout(() => onClose(), 1800);
    } catch (e: unknown) {
      setLaunchStep('error');
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : null;
      const errMsg = e instanceof Error ? e.message : null;
      if (typeof msg === 'string') {
        setError(msg);
      } else if (errMsg?.includes('User rejected') || errMsg?.includes('rejected')) {
        setError('Transaction cancelled.');
      } else {
        setError(errMsg || 'Failed to launch task.');
      }
    }
  };

  const stepLabel = () => {
    switch (launchStep) {
      case 'saving_config':
        return 'Saving configuration…';
      case 'creating_task':
        return 'Creating task…';
      case 'batching':
        return 'Confirm in wallet (approve + deposit + fee)…';
      case 'waiting_tx':
        return depositTxMode === 'sequential' ? 'Processing wallet transactions…' : 'Waiting for confirmation…';
      case 'confirming':
        return 'Activating quest…';
      default:
        return null;
    }
  };

  const activeStepLabel = stepLabel();

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={launching ? undefined : onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="launch-modal-title"
      >
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <FontAwesomeIcon icon={faRocket} className="text-violet-700" />
            </div>
            <div className="min-w-0">
              <h2 id="launch-modal-title" className="text-lg font-black tracking-tight truncate">
                Fund &amp; launch
              </h2>
              <p className="text-xs text-gray-400 truncate">{action.actionName || action.appName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black shrink-0 disabled:opacity-40"
            aria-label="Close"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center gap-3">
              {action.appImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={action.appImageUrl} alt="" className="w-11 h-11 rounded-lg object-cover ring-1 ring-gray-100" />
              ) : (
                <div className="w-11 h-11 rounded-lg bg-gray-200 flex items-center justify-center">
                  <FontAwesomeIcon icon={faImage} className="text-gray-400" />
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold truncate">{action.appName}</p>
                {action.category && (
                  <p className="text-xs text-gray-500">{getCategoryLabel(action.category)}</p>
                )}
              </div>
            </div>
            <p className="text-xs font-mono text-gray-600">
              {formatOnChainTrigger({
                functionName: action.functionName,
                functionSelector: action.functionSelector,
                eventName: action.trackedEvent?.name,
                eventSignature: action.trackedEvent?.signature,
              })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {channels.map((c: CustomActionDistributionChannel) => (
                <span
                  key={c}
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-violet-100 text-violet-800"
                >
                  {c === 'farcaster' ? 'Farcaster' : 'Dapp'}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-5">
            <h3 className="font-bold text-base flex items-center gap-2">
              <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
              Reward pool
            </h3>

            <div className="space-y-2">
              <label className="text-sm text-gray-500 font-medium">Per person reward ({tokenSymbol})</label>
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                <input
                  type="number"
                  min={isG ? 1 : CUSTOM_LAUNCH_MIN_PER_USER_USDC}
                  max={isG ? questChain.budgetMax : CUSTOM_LAUNCH_MAX_PER_USER_USDC}
                  step={isG ? 1 : 0.01}
                  value={perUserReward}
                  disabled={launching}
                  onChange={(e) => {
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n)) {
                      setPerUserReward(
                        Math.min(
                          isG ? questChain.budgetMax : CUSTOM_LAUNCH_MAX_PER_USER_USDC,
                          Math.max(isG ? 1 : CUSTOM_LAUNCH_MIN_PER_USER_USDC, isG ? Math.round(n) : n),
                        ),
                      );
                    }
                  }}
                  className="flex-1 text-right font-bold focus:outline-none bg-transparent disabled:opacity-60"
                />
                <span className="text-gray-500 text-sm">{tokenSymbol}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-500 font-medium">Total amount ({tokenSymbol})</label>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <input
                    type="number"
                    min={isG ? questChain.budgetMin : CUSTOM_LAUNCH_MIN_TOTAL_USDC}
                    max={isG ? questChain.budgetMax : CUSTOM_LAUNCH_MAX_TOTAL_USDC}
                    step={isG ? 100 : 0.1}
                    value={totalBudget}
                    disabled={launching}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n)) {
                        setTotalBudget(
                          Math.min(
                            isG ? questChain.budgetMax : CUSTOM_LAUNCH_MAX_TOTAL_USDC,
                            Math.max(
                              isG ? questChain.budgetMin : CUSTOM_LAUNCH_MIN_TOTAL_USDC,
                              isG ? Math.round(n) : Math.round(n * 10) / 10,
                            ),
                          ),
                        );
                      }
                    }}
                    className="w-14 text-right font-bold focus:outline-none bg-transparent disabled:opacity-60"
                  />
                  <span className="text-gray-500 text-sm">{tokenSymbol}</span>
                </div>
              </div>
              <input
                type="range"
                min={isG ? questChain.budgetMin : CUSTOM_LAUNCH_MIN_TOTAL_USDC}
                max={isG ? questChain.budgetMax : CUSTOM_LAUNCH_MAX_TOTAL_USDC}
                step={isG ? 500 : 0.5}
                value={totalBudget}
                disabled={launching}
                onChange={(e) => setTotalBudget(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-black disabled:opacity-60"
              />
            </div>

            <div>
              <label className="text-sm text-gray-500 font-medium mb-2 flex items-center gap-2">
                <FontAwesomeIcon icon={faClock} className="text-gray-400 text-xs" />
                Duration
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { days: 1 as const, label: '24 hours' },
                    { days: 3 as const, label: '72 hours' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.days}
                    type="button"
                    disabled={launching}
                    onClick={() => setExpiresInDays(opt.days)}
                    className={`py-2.5 text-sm font-bold rounded-xl transition-all disabled:opacity-60 ${
                      expiresInDays === opt.days
                        ? 'bg-black text-white'
                        : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex justify-between items-center">
              <span className="text-gray-500 text-sm flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                Estimated completions
              </span>
              <span className="font-bold text-lg">{maxCompletions}</span>
            </div>

            <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Reward pool</span>
                <span className="font-semibold">{totalBudget} {tokenSymbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">{questChain.feeLabel}</span>
                <span className="font-semibold">{questChain.feeAmount} {tokenSymbol}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                <span>Total cost</span>
                <span>{totalCost.toFixed(isG ? 0 : 2)} {tokenSymbol}</span>
              </div>
              <p className="text-[11px] text-gray-400 pt-1 flex items-center gap-1.5">
                <FontAwesomeIcon icon={faWallet} className="text-gray-400" />
                {isG
                  ? `You will approve G$, deposit to Celo escrow, and send ${questChain.feeAmount} G$ to the UBI Pool in one wallet flow.`
                  : 'You will approve USDC, deposit to escrow, and pay the platform fee in one wallet flow.'}
              </p>
            </div>
          </div>

          {dappOnly ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 flex items-start gap-3">
              <FontAwesomeIcon icon={faCircleInfo} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-800">
                No Farcaster eligibility filters — open to any wallet that completes the on-chain action.
              </p>
            </div>
          ) : hasFarcaster ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-200/80 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faBullseye} className="text-slate-600 text-sm" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      Targeting <span className="text-slate-400 font-medium">(Optional)</span>
                    </h3>
                    <p className="text-xs text-slate-500">Farcaster earners only</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={launching}
                  onClick={() => setTargetingEnabled((p) => !p)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all disabled:opacity-60 ${
                    targetingEnabled ? 'bg-black text-white shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <div className={`w-8 h-4 rounded-full relative ${targetingEnabled ? 'bg-white/30' : 'bg-slate-400'}`}>
                    <div
                      className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${
                        targetingEnabled ? 'left-4' : 'left-0.5'
                      }`}
                    />
                  </div>
                </button>
              </div>

              <AnimatePresence>
                {targetingEnabled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200/80">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faUsers} className="text-slate-400 text-[10px]" />
                          Minimum followers
                        </label>
                        <input
                          type="number"
                          min={0}
                          placeholder="e.g. 100"
                          disabled={launching}
                          value={minFollowers === '' ? '' : minFollowers}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') setMinFollowers('');
                            else {
                              const n = parseInt(v, 10);
                              if (!Number.isNaN(n) && n >= 0) setMinFollowers(n);
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faStar} className="text-slate-400 text-[10px]" />
                          Minimum Neynar score
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step={0.01}
                          placeholder="0–1"
                          disabled={launching}
                          value={minNeynarScore === '' ? '' : minNeynarScore}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') setMinNeynarScore('');
                            else {
                              const n = parseFloat(v);
                              if (!Number.isNaN(n)) setMinNeynarScore(Math.min(1, Math.max(0, n)));
                            }
                          }}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-60"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5 mb-2">
                        <FontAwesomeIcon icon={faCalendarDays} className="text-slate-400 text-[10px]" />
                        Minimum account age
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: '' as const, label: 'None' },
                          { value: 10, label: '10 days' },
                          { value: 30, label: '30 days' },
                          { value: 60, label: '60 days' },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            type="button"
                            disabled={launching}
                            onClick={() => setMinAccountAgeDays(opt.value)}
                            className={`py-2 px-3 rounded-xl text-xs font-semibold disabled:opacity-60 ${
                              minAccountAgeDays === opt.value
                                ? 'bg-black text-white'
                                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200/80">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <FontAwesomeIcon icon={faShieldHalved} className="text-emerald-600 text-sm" />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-700 block">Non-spam only</span>
                          <span className="text-[11px] text-slate-400">Block spam accounts</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={launching}
                        onClick={() => setNonSpamOnly((p) => !p)}
                        className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 ${
                          nonSpamOnly ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {nonSpamOnly ? 'On' : 'Off'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null}

          {activeStepLabel && (
            <p className="text-sm text-violet-700 font-medium bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faSpinner} spin />
              {activeStepLabel}
            </p>
          )}

          {depositTxMode === 'sequential' && launching && (
            <div className="text-xs text-gray-500 space-y-1 px-1">
              <p>Approve: {sequentialTxStep.approve}</p>
              <p>Deposit: {sequentialTxStep.deposit}</p>
              <p>{questChain.feeLabel}: {sequentialTxStep.fee}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faCheck} />
              Task launched! Your quest is now live.
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="flex-1 py-3 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLaunch}
            disabled={launching || success}
            className="flex-1 py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {launching ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faRocket} />}
            {launching ? 'Launching…' : 'Fund & launch'}
          </button>
        </div>
      </div>
    </div>
  );
}
