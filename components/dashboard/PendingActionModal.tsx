'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleInfo, faClock } from '@fortawesome/free-solid-svg-icons';

interface PendingActionModalProps {
  open: boolean;
  onClose: () => void;
}

export function PendingActionModal({ open, onClose }: PendingActionModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="pending-action-title"
      >
        <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-4">
          <FontAwesomeIcon icon={faClock} className="text-xl text-amber-600" />
        </div>
        <h2 id="pending-action-title" className="text-xl font-black tracking-tight mb-3">
          Under review
        </h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          Your on-chain action is in our review queue before it can back reward quests. Most
          submissions are cleared within 2–3 business days.
        </p>
        <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
            What we verify
          </p>
          <ul className="text-sm text-gray-600 space-y-1.5">
            <li className="flex items-start gap-2">
              <FontAwesomeIcon icon={faCircleInfo} className="text-violet-400 mt-0.5 text-xs shrink-0" />
              The contract and tracked event match your example transaction
            </li>
            <li className="flex items-start gap-2">
              <FontAwesomeIcon icon={faCircleInfo} className="text-violet-400 mt-0.5 text-xs shrink-0" />
              The action is safe to verify and won&apos;t spam earners
            </li>
          </ul>
          <p className="text-xs text-gray-500 mt-3">
            You&apos;re all set for now. Once approved, you can attach a budget and launch quests
            with this action.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-black text-white font-bold hover:bg-gray-900 transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
