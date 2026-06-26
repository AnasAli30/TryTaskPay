'use client';

import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faCheck } from '@fortawesome/free-solid-svg-icons';
import { ConnectWalletButton } from '@/components/browser/ConnectWalletButton';
import { useBrowserAuth } from '@/components/hooks/useUserIdentity';

interface ConnectFlowProps {
  onComplete?: () => void;
}

export function ConnectFlow({ onComplete }: ConnectFlowProps) {
  const { siweVerified } = useBrowserAuth();

  if (siweVerified) {
    onComplete?.();
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[80] flex flex-col bg-white"
    >
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400" />
      <div className="flex-1 flex flex-col items-center justify-center px-8 max-w-md mx-auto w-full">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-6">
          <FontAwesomeIcon icon={faWallet} className="text-2xl text-gray-700" />
        </div>
        <h2 className="text-2xl font-black text-center mb-2">Connect your wallet</h2>
        <p className="text-gray-500 text-center text-sm mb-8">
          Sign in with your wallet to earn rewards, create quests, and manage your profile.
        </p>
        <div className="w-full space-y-3">
          <ConnectWalletButton />
        </div>
        <div className="flex items-center gap-2 mt-8 text-xs text-gray-400">
          <FontAwesomeIcon icon={faCheck} />
          <span>Free · No gas to sign in</span>
        </div>
      </div>
    </motion.div>
  );
}
