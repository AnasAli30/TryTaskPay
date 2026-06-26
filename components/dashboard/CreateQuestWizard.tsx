'use client';

import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faPlus,
  faLayerGroup,
  faListCheck,
  faRocket,
  faChevronLeft,
  faChevronRight,
  faCircleCheck,
  faLightbulb,
  faCoins,
  faUsers,
  faClock,
  faTriangleExclamation,
  faCodeBranch,
  faShareNodes,
} from '@fortawesome/free-solid-svg-icons';
import CreateTask, {
  type CreateTaskHandle,
  type CreateTaskSummary,
  type CreateTaskWizardStep,
  QUEST_TYPE_LABELS,
} from '@/components/Promote/CreateTask';
import { CreateCustomTaskWizard } from '@/components/dashboard/CreateCustomTaskWizard';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';
import { useAuthGate } from '@/components/dashboard/AuthContext';
import { FarcasterLogo, XLogo } from '@/components/icons';

type CampaignKind = 'quest' | 'custom';

const QUEST_STEPS = [
  {
    id: 'type' as const,
    label: 'Type',
    title: 'Choose your quest type',
    subtitle: 'Pick a platform and the action you want participants to complete.',
    icon: faLayerGroup,
  },
  {
    id: 'details' as const,
    label: 'Details',
    title: 'Set quest details',
    subtitle: 'Add the target user, post, or link — plus optional eligibility filters.',
    icon: faListCheck,
  },
  {
    id: 'budget' as const,
    label: 'Budget & Launch',
    title: 'Fund and launch',
    subtitle: 'Set your reward pool, review costs, and launch when ready.',
    icon: faRocket,
  },
];

const STEP_TIPS: Record<CreateTaskWizardStep, string[]> = {
  type: [
    'Grow quests are great for building your Farcaster following.',
    'Boost & Amplify drive engagement on a specific cast.',
    'X quests reach users outside the Farcaster ecosystem.',
  ],
  details: [
    'Search by username to find the exact profile or post.',
    'Targeting is optional — leave it off to allow anyone to join.',
    'Double-check URLs before continuing; they cannot be changed after launch.',
  ],
  budget: [
    'Funds are held in escrow until participants verify completion.',
    'Higher budgets reach more users — see estimated reach update live.',
    'You pay a small platform fee on top of the reward pool.',
  ],
  all: [],
};

function KindSelector({ onSelect }: { onSelect: (kind: CampaignKind) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl">
      <button
        type="button"
        onClick={() => onSelect('quest')}
        className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 sm:p-8 hover:border-violet-400 hover:shadow-lg transition-all"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <FontAwesomeIcon icon={faShareNodes} className="text-xl text-violet-700" />
        </div>
        <h3 className="text-xl font-black mb-2">Social Quest</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">
          Reward Farcaster or X actions — follow, boost, quote, mini apps, and more. Launch instantly with G$ or USDC escrow.
        </p>
        <div className="flex items-center gap-2">
          <FarcasterLogo size={16} />
          <XLogo size={14} />
          <span className="text-xs font-bold text-gray-400">Farcaster · X</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect('custom')}
        className="group text-left rounded-2xl border-2 border-gray-200 bg-white p-6 sm:p-8 hover:border-black hover:shadow-lg transition-all"
      >
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <FontAwesomeIcon icon={faCodeBranch} className="text-xl text-gray-800" />
        </div>
        <h3 className="text-xl font-black mb-2">Custom On-chain Task</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">
          Define any Celo or Arbitrum contract action via example transaction. Submit for review — no launch until approved.
        </p>
        <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
          Team review · up to 72h
        </span>
      </button>
    </div>
  );
}

function QuestSummaryPanel({ summary, step }: { summary: CreateTaskSummary | null; step: number }) {
  if (!summary) {
    return (
      <div className="text-sm text-gray-400 italic">
        Fill in each step to see your quest preview here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {summary.platform === 'farcaster' ? (
          <FarcasterLogo size={18} />
        ) : (
          <XLogo size={16} />
        )}
        <span className="font-bold capitalize">{summary.platform}</span>
        <span className="text-gray-300">·</span>
        <span className="font-bold">{QUEST_TYPE_LABELS[summary.selectedType]}</span>
      </div>

      {summary.targetLabel && (
        <div className="text-sm text-gray-600 truncate" title={summary.targetLabel}>
          <span className="text-gray-400 font-medium">Target: </span>
          {summary.targetLabel}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white/70 border border-violet-100 p-3">
          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
            <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
            Pool
          </div>
          <div className="font-black text-lg">{summary.tokenSymbol === 'G$' ? Math.round(summary.totalBudget).toLocaleString() : summary.totalBudget} {summary.tokenSymbol || 'USDC'}</div>
        </div>
        <div className="rounded-xl bg-white/70 border border-violet-100 p-3">
          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-1 flex items-center gap-1">
            <FontAwesomeIcon icon={faUsers} className="text-violet-500" />
            Reach
          </div>
          <div className="font-black text-lg">{summary.estimatedReach}</div>
        </div>
      </div>

      <div className="text-sm space-y-1.5 pt-1 border-t border-violet-100">
        <div className="flex justify-between text-gray-500">
          <span className="flex items-center gap-1.5">
            <FontAwesomeIcon icon={faClock} className="text-gray-300 text-xs" />
            Duration
          </span>
          <span className="font-bold text-gray-700">
            {summary.expiresInDays === 1 ? '24 hours' : '72 hours'}
          </span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>Per user</span>
          <span className="font-bold text-gray-700">
            ~{summary.tokenSymbol === 'G$' ? Math.round(summary.perUserReward).toLocaleString() : summary.perUserReward.toFixed(3)} {summary.tokenSymbol || 'USDC'}
          </span>
        </div>
        <div className="flex justify-between font-bold text-black pt-1">
          <span>Total cost</span>
          <span>{summary.tokenSymbol === 'G$' ? Math.round(summary.totalCost).toLocaleString() : summary.totalCost.toFixed(2)} {summary.tokenSymbol || 'USDC'}</span>
        </div>
      </div>

      {step < QUEST_STEPS.length - 1 && (
        <p className="text-xs text-violet-600/80 font-medium">
          {step === 0 ? 'Continue to add quest details →' : 'Almost there — set your budget next →'}
        </p>
      )}
    </div>
  );
}

export function CreateQuestWizard() {
  const { siweVerified } = useBrowserAuth();
  const { openAuthGate } = useAuthGate();
  const [campaignKind, setCampaignKind] = useState<CampaignKind | null>(null);
  const [platform, setPlatform] = useState<'farcaster' | 'x'>('farcaster');
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CreateTaskSummary | null>(null);
  const createTaskRef = useRef<CreateTaskHandle>(null);

  const handleSummaryChange = useCallback((s: CreateTaskSummary) => setSummary(s), []);

  const wizardStep: CreateTaskWizardStep = QUEST_STEPS[step].id;
  const currentStep = QUEST_STEPS[step];
  const isLastStep = step === QUEST_STEPS.length - 1;

  const goToStep = (target: number) => {
    if (target < step) {
      setStepError(null);
      setStep(target);
    }
  };

  const handleNext = () => {
    setStepError(null);
    if (step === 1) {
      const err = createTaskRef.current?.validateDetails();
      if (err) {
        setStepError(err);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, QUEST_STEPS.length - 1));
  };

  const handleBack = () => {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  if (!siweVerified) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mx-auto mb-6">
          <FontAwesomeIcon icon={faLock} className="text-2xl text-violet-700" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-3">Create a Quest</h1>
        <p className="text-gray-500 mb-8">
          Sign in with your wallet to promote your content with G$ or USDC rewards.
        </p>
        <button
          type="button"
          onClick={openAuthGate}
          className="px-8 py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 transition-colors"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 flex items-center gap-3">
          <FontAwesomeIcon icon={faPlus} className="text-violet-600" />
          {campaignKind === 'custom' ? 'Create Custom Task' : 'Create'}
        </h1>
        <p className="text-gray-500">
          {campaignKind === null
            ? 'Choose social quests or custom on-chain tasks.'
            : campaignKind === 'custom'
              ? 'Submit a custom on-chain action for team review.'
              : 'Launch a reward campaign on Farcaster or X — step by step.'}
        </p>
      </div>

      {campaignKind === null && (
        <div>
          <h2 className="text-lg font-black mb-4">What do you want to create?</h2>
          <KindSelector onSelect={setCampaignKind} />
        </div>
      )}

      {campaignKind === 'custom' && (
        <CreateCustomTaskWizard onBackToKind={() => setCampaignKind(null)} />
      )}

      {campaignKind === 'quest' && (
        <>
          <div className="mb-4">
            <button
              type="button"
              onClick={() => {
                setCampaignKind(null);
                setStep(0);
                setStepError(null);
              }}
              className="text-sm font-bold text-gray-500 hover:text-black flex items-center gap-1.5"
            >
              <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
              Change type
            </button>
          </div>

          <div className="lg:hidden mb-6">
            <div className="flex items-center justify-between text-xs font-bold text-gray-400 mb-2">
              <span>
                Step {step + 1} of {QUEST_STEPS.length}
              </span>
              <span className="text-black">{currentStep.label}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-violet-600 to-blue-500 rounded-full"
                initial={false}
                animate={{ width: `${((step + 1) / QUEST_STEPS.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2 mb-8 p-2 bg-gray-50 rounded-2xl border border-gray-100">
            {QUEST_STEPS.map((s, i) => {
              const isDone = i < step;
              const isActive = i === step;
              return (
                <div key={s.id} className="flex items-center flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={i > step}
                    className={`flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 rounded-xl transition-all text-left ${
                      isActive
                        ? 'bg-white shadow-sm border border-gray-200'
                        : isDone
                          ? 'hover:bg-white/80 cursor-pointer'
                          : 'opacity-50 cursor-default'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isActive
                            ? 'bg-black text-white'
                            : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isDone ? (
                        <FontAwesomeIcon icon={faCircleCheck} className="text-sm" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className={`text-sm font-black truncate ${isActive ? 'text-black' : 'text-gray-500'}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate hidden xl:block">{s.subtitle}</div>
                    </div>
                  </button>
                  {i < QUEST_STEPS.length - 1 && (
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
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-black tracking-tight">{currentStep.title}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{currentStep.subtitle}</p>
                    </div>
                  </div>

                  {step === 0 && (
                    <div className="mt-4 flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
                      {(['farcaster', 'x'] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPlatform(p)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                            platform === p
                              ? 'bg-white text-black shadow-sm'
                              : 'text-gray-500 hover:text-black'
                          }`}
                        >
                          {p === 'farcaster' ? (
                            <>
                              <FarcasterLogo size={14} /> Farcaster
                            </>
                          ) : (
                            <>
                              <XLogo size={12} /> X
                            </>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {step > 0 && (
                    <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                      {platform === 'farcaster' ? <FarcasterLogo size={12} /> : <XLogo size={10} />}
                      {platform === 'farcaster' ? 'Farcaster' : 'X'}
                      {summary && (
                        <>
                          <span className="text-gray-300">·</span>
                          {QUEST_TYPE_LABELS[summary.selectedType]}
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-6">
                  {stepError && (
                    <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-medium flex items-start gap-2">
                      <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
                      {stepError}
                    </div>
                  )}

                  <CreateTask
                    ref={createTaskRef}
                    platform={platform}
                    wizardStep={wizardStep}
                    dashboard
                    onSummaryChange={handleSummaryChange}
                  />
                </div>

                {!isLastStep && (
                  <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={handleBack}
                      disabled={step === 0}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNext}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black text-white text-sm font-bold hover:bg-gray-900 transition-colors shadow-sm"
                    >
                      Continue
                      <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                    </button>
                  </div>
                )}

                {isLastStep && step > 0 && (
                  <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                      <FontAwesomeIcon icon={faChevronLeft} className="text-xs" />
                      Back to details
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="lg:sticky lg:top-28 rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-50 to-blue-50 p-5 sm:p-6">
                <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                  <FontAwesomeIcon icon={faLayerGroup} className="text-violet-600" />
                  Quest preview
                </h3>
                <QuestSummaryPanel summary={summary} step={step} />
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
                <h3 className="font-black text-base mb-3 flex items-center gap-2">
                  <FontAwesomeIcon icon={faLightbulb} className="text-amber-500" />
                  Tips for this step
                </h3>
                <ul className="space-y-2.5">
                  {STEP_TIPS[wizardStep].map((tip) => (
                    <li key={tip} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-violet-400 mt-1 shrink-0">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
