'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWallet, faCheck } from '@fortawesome/free-solid-svg-icons';
import { ConnectWalletButton } from '@/components/browser/ConnectWalletButton';
import { useBrowserAuth } from '@/components/browser/BrowserAuthProvider';
import { useAuthGate } from '@/components/dashboard/AuthContext';

export function AuthGate() {
  const { siweVerified, loading } = useBrowserAuth();
  const { showAuthGate, closeAuthGate } = useAuthGate();

  const visible = showAuthGate && !siweVerified && !loading;

  useEffect(() => {
    if (siweVerified && !loading) {
      closeAuthGate();
    }
  }, [siweVerified, loading, closeAuthGate]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={closeAuthGate}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600" />
            <div className="p-8 pt-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center mb-6 mx-auto">
                <FontAwesomeIcon icon={faWallet} className="text-xl text-violet-700" />
              </div>
              <h2 className="text-2xl font-black text-center mb-2 tracking-tight">Sign in with wallet</h2>
              <p className="text-gray-500 text-center text-sm mb-8 leading-relaxed">
                Connect your wallet and sign a message to access quests, create campaigns, and manage your profile.
              </p>
              <ConnectWalletButton />
              <div className="flex items-center justify-center gap-2 mt-6 text-xs text-gray-400">
                <FontAwesomeIcon icon={faCheck} />
                <span>Free · No gas to sign in</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
