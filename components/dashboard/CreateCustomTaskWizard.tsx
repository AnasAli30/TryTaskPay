'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faCode,
  faCopy,
  faFileLines,
  faImage,
  faLightbulb,
  faLink,
  faListCheck,
  faPen,
  faRocket,
  faSpinner,
  faTriangleExclamation,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import type { ParsedArbitrumTx } from '@/lib/alchemyTxParser';
import {
  CUSTOM_ACTION_CATEGORIES,
  formatOnChainTrigger,
  getCategoryLabel,
  isValidHttpsUrl,
} from '@/lib/customActionHelpers';
import type { CustomActionCategory, CustomActionDistributionChannel } from '@/lib/types';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { FarcasterLogo } from '@/components/icons';

const STEPS = [
  {
    id: 'metadata' as const,
    label: 'Metadata',
    title: 'Add metadata',
    subtitle: 'This is what users will see when they complete your action.',
    icon: faImage,
  },
  {
    id: 'transaction' as const,
    label: 'Transaction',
    title: 'Example transaction',
    subtitle: 'Paste a successful Celo or Arbitrum tx hash that demonstrates the on-chain action.',
    icon: faCode,
  },
  {
    id: 'describe' as const,
    label: 'Describe',
    title: 'Describe reward',
    subtitle: 'We use this for display and review when approving your action.',
    icon: faFileLines,
  },
  {
    id: 'review' as const,
    label: 'Review',
    title: 'Review the action',
    subtitle: 'Confirm everything looks correct, then submit for team review.',
    icon: faListCheck,
  },
];

const STEP_TIPS: Record<(typeof STEPS)[number]['id'], string[]> = {
  metadata: [
    'Use a square app image for best results in quest cards.',
    'Reward base URL is where earners go to perform the action.',
    'Pick at least one distribution channel.',
  ],
  transaction: [
    'Use a real successful transaction you or a user performed.',
    'We extract the contract, function call, and events automatically.',
    'Choose the event that best proves task completion.',
  ],
  describe: [
    'Write clearly what the user must do on-chain.',
    'Action name is shown to earners on quest cards.',
  ],
  review: [
    'Submission does not require wallet transactions.',
    'Review usually takes 2–3 business days.',
  ],
};

function truncateAddress(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

interface CustomActionPreview {
  appName: string;
  appImageUrl?: string;
  rewardBaseUrl: string;
  category: CustomActionCategory | '';
  channels: CustomActionDistributionChannel[];
  actionName: string;
  rewardDescription: string;
  parsed?: ParsedArbitrumTx | null;
  selectedEventLogIndex?: number;
}

function PreviewPanel({ data, step }: { data: CustomActionPreview; step: number }) {
  const selectedEvent = data.parsed?.events.find((e) => e.logIndex === data.selectedEventLogIndex);

  return (
    <div className="space-y-4">
      {data.appImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.appImageUrl}
          alt=""
          className="w-14 h-14 rounded-xl object-cover ring-2 ring-white shadow-sm"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center">
          <FontAwesomeIcon icon={faImage} className="text-gray-300" />
        </div>
      )}
      <div>
        <p className="font-black text-lg">{data.appName || 'Your app'}</p>
        {data.category && (
          <p className="text-xs text-gray-500 font-semibold mt-0.5">{getCategoryLabel(data.category)}</p>
        )}
      </div>
      {data.rewardBaseUrl && (
        <p className="text-xs text-gray-500 truncate" title={data.rewardBaseUrl}>
          {data.rewardBaseUrl}
        </p>
      )}
      {data.channels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.channels.map((c) => (
            <span
              key={c}
              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-violet-100 text-violet-800"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {data.actionName && (
        <div className="text-sm border-t border-violet-100 pt-3">
          <span className="text-gray-400 text-xs font-semibold uppercase">Action</span>
          <p className="font-bold mt-0.5">{data.actionName}</p>
        </div>
      )}
      {data.parsed && (
        <div className="text-sm space-y-1 border-t border-violet-100 pt-3">
          <p className="text-xs text-gray-400 font-semibold uppercase">On-chain</p>
          <p className="font-mono text-xs text-gray-700">{truncateAddress(data.parsed.contractAddress)}</p>
          {selectedEvent && (
            <p className="text-xs text-gray-500">{selectedEvent.name || selectedEvent.signature.slice(0, 14)}</p>
          )}
        </div>
      )}
      {step < STEPS.length - 1 && (
        <p className="text-xs text-violet-600/80 font-medium">Keep going — {STEPS.length - step - 1} steps left</p>
      )}
    </div>
  );
}

interface CreateCustomTaskWizardProps {
  onBackToKind: () => void;
}

export function CreateCustomTaskWizard({ onBackToKind }: CreateCustomTaskWizardProps) {
  const router = useRouter();
  const { fid, displayName, username, pfpUrl } = useBrowserAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [appName, setAppName] = useState('');
  const [appImageUrl, setAppImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [rewardBaseUrl, setRewardBaseUrl] = useState('https://');
  const [category, setCategory] = useState<CustomActionCategory | ''>('');
  const [channels, setChannels] = useState<CustomActionDistributionChannel[]>(['dapp']);

  const [txHash, setTxHash] = useState('');
  const [parsingTx, setParsingTx] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedTx, setParsedTx] = useState<ParsedArbitrumTx | null>(null);
  const [selectedEventLogIndex, setSelectedEventLogIndex] = useState<number | null>(null);

  const [actionName, setActionName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const preview: CustomActionPreview = {
    appName,
    appImageUrl,
    rewardBaseUrl,
    category,
    channels,
    actionName,
    rewardDescription,
    parsed: parsedTx,
    selectedEventLogIndex: selectedEventLogIndex ?? undefined,
  };

  const toggleChannel = (ch: CustomActionDistributionChannel) => {
    setChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c) => c !== ch) : prev) : [...prev, ch],
    );
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/ipfs/upload-image', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.ipfsUrl) {
        setAppImageUrl(data.ipfsUrl);
      } else {
        setStepError('Image upload failed. Try again.');
      }
    } catch {
      setStepError('Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  };

  const analyzeTx = async () => {
    setParseError(null);
    setParsingTx(true);
    try {
      const res = await axios.post('/api/custom-actions/parse-tx', { txHash: txHash.trim() });
      const parsed = res.data.parsed as ParsedArbitrumTx;
      setParsedTx(parsed);
      setSelectedEventLogIndex(parsed.recommendedEvent.logIndex);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : null;
      setParseError(typeof msg === 'string' ? msg : 'Failed to parse transaction');
      setParsedTx(null);
      setSelectedEventLogIndex(null);
    } finally {
      setParsingTx(false);
    }
  };

  const validateStep = useCallback((): string | null => {
    switch (STEPS[step].id) {
      case 'metadata':
        if (!appName.trim()) return 'Enter your app name.';
        if (!isValidHttpsUrl(rewardBaseUrl)) return 'Enter a valid HTTPS reward base URL.';
        if (!category) return 'Select a category.';
        if (channels.length === 0) return 'Select at least one distribution channel.';
        return null;
      case 'transaction':
        if (!parsedTx) return 'Analyze a successful on-chain transaction first.';
        if (selectedEventLogIndex == null) return 'Select an event to track.';
        return null;
      case 'describe':
        if (!rewardDescription.trim()) return 'Describe what users must do on-chain.';
        if (!actionName.trim()) return 'Enter an action name for earners.';
        return null;
      default:
        return null;
    }
  }, [step, appName, rewardBaseUrl, category, channels, parsedTx, selectedEventLogIndex, rewardDescription, actionName]);

  const handleNext = () => {
    setStepError(null);
    const err = validateStep();
    if (err) {
      setStepError(err);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setStepError(null);
    if (step === 0) {
      onBackToKind();
      return;
    }
    setStep((s) => s - 1);
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  const handleSubmit = async () => {
    setStepError(null);
    if (!parsedTx || selectedEventLogIndex == null) {
      setStepError('Missing transaction data.');
      return;
    }
    const tracked = parsedTx.events.find((e) => e.logIndex === selectedEventLogIndex);
    if (!tracked) {
      setStepError('Invalid tracked event.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/api/custom-actions/submit', {
        creatorFid: fid,
        creatorProfile: {
          displayName,
          username,
          pfpUrl,
        },
        appName: appName.trim(),
        appImageUrl: appImageUrl || undefined,
        rewardBaseUrl: rewardBaseUrl.trim(),
        category,
        distributionChannels: channels,
        actionName: actionName.trim(),
        rewardDescription: rewardDescription.trim(),
        exampleTxHash: parsedTx.txHash,
        trackedEvent: {
          signature: tracked.signature,
          name: tracked.name,
          logIndex: tracked.logIndex,
          address: tracked.address,
        },
      });
      setSubmitSuccess(true);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.error : null;
      setStepError(typeof msg === 'string' ? msg : 'Submission failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black mb-2">Action submitted</h2>
        <p className="text-gray-500 mb-8">
          We&apos;re reviewing your on-chain action now. Check your profile for status — most
          submissions clear within 2–3 business days.
        </p>
        <button
          type="button"
          onClick={() => router.push('/app/profile')}
          className="px-8 py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900"
        >
          View profile
        </button>
      </div>
    );
  }

  const selectedEvent = parsedTx?.events.find((e) => e.logIndex === selectedEventLogIndex);

  return (
    <div>
      <div className="lg:hidden mb-6">
        <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-black">{currentStep.label}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-600 to-blue-500 rounded-full"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 mb-8 p-2 bg-gray-50 rounded-2xl border border-gray-100">
        {STEPS.map((s, i) => {
          const isDone = i < step;
          const isActive = i === step;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <div
                className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 rounded-xl ${
                  isActive ? 'bg-white shadow-sm border border-gray-200' : isDone ? '' : 'opacity-50'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                    isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {isDone ? <FontAwesomeIcon icon={faCircleCheck} className="text-sm" /> : i + 1}
                </div>
                <div className="min-w-0 hidden xl:block">
                  <div className={`text-sm font-black truncate ${isActive ? 'text-black' : 'text-gray-500'}`}>
                    {s.label}
                  </div>
                </div>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-6 h-px shrink-0 mx-1 ${i < step ? 'bg-emerald-300' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <FontAwesomeIcon icon={currentStep.icon} className="text-violet-700" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black tracking-tight">{currentStep.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{currentStep.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {stepError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-start gap-2">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
                  {stepError}
                </div>
              )}

              {step === 0 && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      App image
                    </label>
                    <div className="flex items-center gap-4">
                      {appImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={appImageUrl} alt="" className="w-20 h-20 rounded-xl object-cover ring-2 ring-gray-100" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center">
                          <FontAwesomeIcon icon={faImage} className="text-2xl text-gray-300" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
                        >
                          {uploadingImage ? (
                            <FontAwesomeIcon icon={faSpinner} spin />
                          ) : (
                            <FontAwesomeIcon icon={faUpload} />
                          )}
                          Upload image
                        </button>
                        <p className="text-xs text-gray-400 mt-1">Square dimensions recommended</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      App name
                    </label>
                    <input
                      type="text"
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="What is your app called?"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Reward base URL
                    </label>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faLink} className="text-gray-300 shrink-0" />
                      <input
                        type="url"
                        value={rewardBaseUrl}
                        onChange={(e) => setRewardBaseUrl(e.target.value)}
                        placeholder="https://app.example.com/"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400"
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Where users perform your on-chain action</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CustomActionCategory)}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    >
                      <option value="">Select a category</option>
                      {CUSTOM_ACTION_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Distribution channel
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(['farcaster', 'dapp'] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => toggleChannel(ch)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
                            channels.includes(ch)
                              ? 'bg-black text-white border-black'
                              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {ch === 'farcaster' && <FarcasterLogo size={14} />}
                          {ch === 'farcaster' ? 'Farcaster' : 'Dapp'}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Transaction hash (Celo or Arbitrum)
                    </label>
                    <input
                      type="text"
                      value={txHash}
                      onChange={(e) => {
                        setTxHash(e.target.value);
                        setParseError(null);
                      }}
                      placeholder="0x…"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={analyzeTx}
                    disabled={parsingTx || !txHash.trim()}
                    className="px-6 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-black disabled:opacity-50 flex items-center gap-2"
                  >
                    {parsingTx ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCode} />}
                    Analyze transaction
                  </button>
                  {parseError && (
                    <p className="text-sm text-red-600 font-medium">{parseError}</p>
                  )}

                  {parsedTx && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Network</span>
                        <span className="font-bold">Celo / Arbitrum</span>
                      </div>
                      <div className="flex justify-between text-sm items-center gap-2">
                        <span className="text-gray-500">Contract</span>
                        <span className="font-mono text-xs flex items-center gap-2">
                          {truncateAddress(parsedTx.contractAddress)}
                          <button
                            type="button"
                            onClick={() => copyText(parsedTx.contractAddress)}
                            className="text-gray-400 hover:text-black"
                          >
                            <FontAwesomeIcon icon={faCopy} className="text-xs" />
                          </button>
                        </span>
                      </div>
                      {parsedTx.functionSelector && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Function called</span>
                          <span className="font-mono text-xs">
                            {parsedTx.functionName || parsedTx.functionSelector}
                          </span>
                        </div>
                      )}
                      {selectedEvent && (
                        <div className="flex justify-between text-sm gap-3">
                          <span className="text-gray-500 shrink-0">On-chain trigger</span>
                          <span className="font-mono text-xs text-right">
                            {formatOnChainTrigger({
                              functionName: parsedTx.functionName,
                              functionSelector: parsedTx.functionSelector,
                              eventName: selectedEvent.name,
                              eventSignature: selectedEvent.signature,
                            })}
                          </span>
                        </div>
                      )}
                      <a
                        href={`https://arbiscan.io/tx/${parsedTx.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-violet-600 hover:underline"
                      >
                        View on Arbiscan →
                      </a>

                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                          Events to track
                        </p>
                        <div className="space-y-2">
                          {parsedTx.events.map((ev) => (
                            <label
                              key={ev.logIndex}
                              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedEventLogIndex === ev.logIndex
                                  ? 'border-violet-400 bg-violet-50'
                                  : 'border-gray-200 bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="trackedEvent"
                                checked={selectedEventLogIndex === ev.logIndex}
                                onChange={() => setSelectedEventLogIndex(ev.logIndex)}
                                className="mt-1"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold font-mono">
                                  {formatOnChainTrigger({
                                    functionName: parsedTx.functionName,
                                    functionSelector: parsedTx.functionSelector,
                                    eventName: ev.name,
                                    eventSignature: ev.signature,
                                  })}
                                </p>
                                <p className="text-xs font-mono text-gray-400 truncate">{ev.signature}</p>
                              </div>
                              {parsedTx.recommendedEvent.logIndex === ev.logIndex && (
                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
                                  Recommended
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Action name (shown to earners)
                    </label>
                    <input
                      type="text"
                      value={actionName}
                      onChange={(e) => setActionName(e.target.value)}
                      placeholder="e.g. Swap on Uniswap"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 block">
                      Describe the reward
                    </label>
                    <textarea
                      value={rewardDescription}
                      onChange={(e) => setRewardDescription(e.target.value)}
                      rows={5}
                      placeholder="Mint a new nft"
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      We use this to configure and review your action automatically.
                    </p>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="space-y-0 divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
                  {[
                    {
                      key: 'actionName',
                      label: 'Action name',
                      value: actionName,
                      edit: () => setStep(2),
                    },
                    {
                      key: 'app',
                      label: 'Reward app and URL',
                      value: `${appName} (${rewardBaseUrl})`,
                      edit: () => setStep(0),
                    },
                    {
                      key: 'category',
                      label: 'Category',
                      value: category ? getCategoryLabel(category) : '—',
                      edit: () => setStep(0),
                    },
                    {
                      key: 'channels',
                      label: 'Distribution channel',
                      value: channels.map((c) => (c === 'farcaster' ? 'Farcaster' : 'Dapp')).join(', '),
                      edit: () => setStep(0),
                    },
                    {
                      key: 'description',
                      label: 'Description',
                      value: rewardDescription,
                      edit: () => setStep(2),
                    },
                    {
                      key: 'contract',
                      label: 'Contract address',
                      value: parsedTx ? truncateAddress(parsedTx.contractAddress) : '—',
                      copy: parsedTx?.contractAddress,
                    },
                    {
                      key: 'trigger',
                      label: 'On-chain trigger',
                      value: parsedTx
                        ? formatOnChainTrigger({
                            functionName: parsedTx.functionName,
                            functionSelector: parsedTx.functionSelector,
                            eventName: selectedEvent?.name,
                            eventSignature: selectedEvent?.signature,
                          })
                        : '—',
                      edit: () => setStep(1),
                      badge: 'Event + function',
                    },
                  ].map((row) => (
                    <div key={row.key} className="flex items-start justify-between gap-3 px-4 py-3.5 bg-white">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-black break-words">{row.value}</p>
                        <p className="text-[11px] text-gray-400 font-medium mt-0.5">{row.label}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {'badge' in row && row.badge && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            {row.badge}
                          </span>
                        )}
                        {'copy' in row && row.copy && (
                          <button
                            type="button"
                            onClick={() => copyText(row.copy!)}
                            className="text-xs font-bold text-violet-600 hover:underline"
                          >
                            Copy
                          </button>
                        )}
                        {'edit' in row && row.edit && (
                          <button
                            type="button"
                            onClick={() => row.edit!()}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-black"
                          >
                            <FontAwesomeIcon icon={faPen} className="text-xs" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                  <FontAwesomeIcon icon={faTriangleExclamation} className="text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Queued for review</p>
                    <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
                      We&apos;ll verify your contract and tracked event before this action can power
                      reward quests. Most reviews finish within 2–3 business days.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                {step === 0 ? 'Change type' : 'Back'}
              </button>
              {isLastStep ? (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 disabled:opacity-50"
                >
                  {submitting ? (
                    <FontAwesomeIcon icon={faSpinner} spin />
                  ) : (
                    <FontAwesomeIcon icon={faRocket} className="text-xs" />
                  )}
                  Submit for review
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900"
                >
                  Continue
                  <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="lg:sticky lg:top-28 rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5 sm:p-6">
            <h3 className="font-black text-lg mb-4 flex items-center gap-2">
              <FontAwesomeIcon icon={faRocket} className="text-violet-600" />
              Action preview
            </h3>
            <PreviewPanel data={preview} step={step} />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h3 className="font-black text-base mb-3 flex items-center gap-2">
              <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
              Tips for this step
            </h3>
            <ul className="space-y-2.5">
              {STEP_TIPS[currentStep.id].map((tip) => (
                <li key={tip} className="text-sm text-gray-600 flex items-start gap-2">
                  <span className="text-violet-400 mt-1 shrink-0">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
