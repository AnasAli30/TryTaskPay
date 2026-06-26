'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { ConnectFarcaster } from '@/components/browser/ConnectFarcaster';
import { ConnectX } from '@/components/browser/ConnectX';
import type { QuestTask } from '@/lib/questHelpers';
import { CUSTOM_ONCHAIN_VERIFY_DIALOG } from '@/lib/questHelpers';

interface PlatformConnectDialogProps {
  task: QuestTask | null;
  onClose: () => void;
}

export function PlatformConnectDialog({ task, onClose }: PlatformConnectDialogProps) {
  const isX = task && String(task.type ?? '').startsWith('x_');

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Connect account</h3>
              <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              {isX
                ? 'Link your X account to verify this quest.'
                : 'Link your Farcaster account to verify this quest.'}
            </p>
            {isX ? <ConnectX /> : <ConnectFarcaster />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface VerifyDialogProps {
  open: boolean;
  error: string | null;
  verifying: boolean;
  onVerify: () => void;
  onClose: () => void;
  title?: string;
  isCustomOnchain?: boolean;
}

export function VerifyDialog({
  open,
  error,
  verifying,
  onVerify,
  onClose,
  title,
  isCustomOnchain,
}: VerifyDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black mb-2">{title || 'Verify completion'}</h3>
            <p className="text-sm text-gray-500 mb-6">
              {isCustomOnchain
                ? CUSTOM_ONCHAIN_VERIFY_DIALOG
                : 'Complete the quest action first, then verify on-chain to claim your reward.'}
            </p>
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onVerify}
                disabled={verifying}
                className="flex-1 py-2.5 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {verifying && <FontAwesomeIcon icon={faSpinner} spin />}
                {isCustomOnchain ? 'Verify completion' : 'Verify on-chain'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
