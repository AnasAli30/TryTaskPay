'use client'

import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faHome, faPlus, faUser, faCheck, faComments, faTimes,
  faUserPlus, faRetweet, faQuoteRight, faHashtag, faLayerGroup, faBolt,
  faCoins, faShieldHalved, faClock, faArrowRight, faStar, faRocket, faLock, faGift, faTrophy, faWallet, faBullseye, faChevronRight, faSpinner, faCheckCircle, faExclamationCircle
} from '@fortawesome/free-solid-svg-icons'
import TaskFeed from '@/components/Promote/TaskFeed'
import CreateTask from '@/components/Promote/CreateTask'
import Profile from '@/components/Profile/Profile'
import Leaderboard from '@/components/Leaderboard/Leaderboard'
import axios from 'axios'
import { useAccount, useConnect, useSwitchChain } from 'wagmi'
import { arbitrum } from 'wagmi/chains'
import { useFrame } from '@/components/farcaster-provider'
import sdk from '@farcaster/miniapp-sdk'
import { XLogo, FarcasterLogo } from '@/components/icons'
import GroupChat from '@/components/Chat/GroupChat'

/* ───────────────────────────────────────────
   Floating decorative shapes for light theme
   ─────────────────────────────────────────── */
const SHAPE_CONFIGS = [
  { w: 45, h: 45, l: 15, t: 25, d: 6, del: 0.5, bg: 0 },
  { w: 70, h: 70, l: 75, t: 15, d: 8, del: 1.2, bg: 1 },
  { w: 30, h: 30, l: 85, t: 75, d: 5, del: 2.1, bg: 2 },
  { w: 55, h: 55, l: 25, t: 80, d: 7, del: 0.8, bg: 3 },
  { w: 25, h: 25, l: 50, t: 45, d: 4, del: 1.5, bg: 0 },
  { w: 60, h: 60, l: 10, t: 60, d: 6.5, del: 0.2, bg: 1 },
  { w: 40, h: 40, l: 90, t: 40, d: 5.5, del: 2.5, bg: 2 },
  { w: 65, h: 65, l: 60, t: 85, d: 8.5, del: 1.8, bg: 3 },
  { w: 35, h: 35, l: 40, t: 10, d: 4.5, del: 0.7, bg: 0 },
  { w: 50, h: 50, l: 80, t: 90, d: 7.5, del: 2.3, bg: 1 },
  { w: 20, h: 20, l: 30, t: 30, d: 4, del: 1.1, bg: 2 },
  { w: 75, h: 75, l: 5, t: 5, d: 9, del: 0.3, bg: 3 },
  { w: 45, h: 45, l: 65, t: 65, d: 6, del: 1.9, bg: 0 },
  { w: 55, h: 55, l: 45, t: 55, d: 7, del: 2.8, bg: 1 },
];

function FloatingShapes() {
  const bgColors = [
    'rgba(124,58,237,0.04)',
    'rgba(59,130,246,0.04)',
    'rgba(16,185,129,0.04)',
    'rgba(245,158,11,0.03)',
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {SHAPE_CONFIGS.map((config, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: config.w,
            height: config.h,
            background: bgColors[config.bg],
            left: `${config.l}%`,
            top: `${config.t}%`,
          }}
          animate={{
            y: [0, -15 - (config.w % 20), 0],
            x: [0, (config.h % 12) - 6, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: config.d,
            repeat: Infinity,
            delay: config.del,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/* ───────────────────────────────────────
   Full-page Intro / Welcome overlay
   ─────────────────────────────────────── */
function IntroOverlay({ onClose, helpSlide, setHelpSlide }: {
  onClose: () => void
  helpSlide: number
  setHelpSlide: React.Dispatch<React.SetStateAction<number>>
}) {
  const TOTAL_SLIDES = 6

  // Live platform stats
  const [platformStats, setPlatformStats] = useState({ totalRewards: 0, totalUsers: 0, totalQuests: 0 })
  const [statsLoaded, setStatsLoaded] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get('/api/tasks/platform-stats')
        const s = res.data?.stats
        if (s) {
          setPlatformStats({
            totalRewards: Number(s.totalRewards) || 0,
            totalUsers: Number(s.totalUsers) || 0,
            totalQuests: Number(s.totalQuests) || 0,
          })
        }
      } catch {
        // keep defaults
      } finally {
        setStatsLoaded(true)
      }
    })()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[70] flex flex-col bg-white"
    >
      <FloatingShapes />

      {/* Subtle gradient accent at top */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400" />



      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col px-5 pt-10 pb-6">
        <AnimatePresence mode="wait">
          {/* ── Slide 0: Welcome ── */}
          {helpSlide === 0 && (
            <motion.div
              key="s0"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col items-center justify-center text-center"
            >
              {/* Icon with ring animation */}
              <motion.div
                initial={{ scale: 0, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                className="relative mb-6"
              >
                <div
                  className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5"
                  style={{ boxShadow: '0 12px 40px rgba(124,58,237,0.15), 0 4px 16px rgba(0,0,0,0.08)' }}
                >
                  <img src="/images/icon.png" alt="TaskPay" className="w-full h-full object-cover" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-3xl border-2 border-purple-300"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.15, 0, 0.15] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute inset-0 rounded-3xl border border-blue-300"
                />
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-[28px] sm:text-3xl font-black text-black mb-2 tracking-tight leading-tight"
              >
                Welcome to <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">TaskPay</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-gray-500 text-base mb-6 max-w-[320px] leading-relaxed"
              >
                The decentralized quest marketplace built natively on Farcaster.
              </motion.p>

              {statsLoaded && (platformStats.totalQuests > 0 || platformStats.totalUsers > 0) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.45 }}
                  className="flex items-center justify-center gap-3 w-full max-w-sm mb-8"
                >
                  <div className="flex-1 flex flex-col items-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="text-xl font-black text-black">
                      {platformStats.totalQuests.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-0.5">Quests</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="text-xl font-black text-black">
                      {platformStats.totalUsers.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-0.5">Earners</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <span className="text-xl font-black text-black">
                      ${platformStats.totalRewards.toLocaleString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-0.5">Paid</span>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full max-w-sm space-y-3"
              >
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100">
                  <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faRocket} className="text-amber-600 text-lg" />
                  </div>
                  <div className="text-left">
                    <span className="text-[15px] font-bold text-black">For Creators</span>
                    <p className="text-sm text-gray-500 leading-relaxed">Get real, verifiable engagement on your Farcaster posts & apps.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
                  <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faWallet} className="text-blue-600 text-lg" />
                  </div>
                  <div className="text-left">
                    <span className="text-[15px] font-bold text-black">For Users</span>
                    <p className="text-sm text-gray-500 leading-relaxed">Complete quests and earn real G$ & USDC straight to your wallet.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100">
                  <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faShieldHalved} className="text-green-600 text-lg" />
                  </div>
                  <div className="text-left">
                    <span className="text-[15px] font-bold text-black">Fully Trustless</span>
                    <p className="text-sm text-gray-500 leading-relaxed">All quests, deposits, and payouts run on smart contracts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-cyan-50 to-sky-50 border border-cyan-100">
                  <div className="w-11 h-11 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faBolt} className="text-cyan-600 text-lg" />
                  </div>
                  <div className="text-left">
                    <span className="text-[15px] font-bold text-black">Auto-Quest</span>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Link your signer once in Profile — <strong className="text-gray-800">TaskPay does the work</strong> for you. You just have to{' '}
                      <strong className="text-gray-800">claim</strong> your rewards; no endless tapping.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2 leading-snug">
                      Note: Auto-Quest is only for <strong className="text-gray-600">Boost</strong> quests right now.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ── Slide 1: How it Works ── */}
          {helpSlide === 1 && (
            <motion.div
              key="s1"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-black mb-2 tracking-tight">How it Works</h2>
              <p className="text-base text-gray-500 mb-7">From creation to payout — seamlessly.</p>

              <div className="space-y-5">
                {[
                  { num: '1', color: 'from-blue-500 to-blue-600', title: 'Launch a Quest', desc: 'Creators set a budget and duration. Funds are locked on-chain via smart contracts.' },
                  { num: '2', color: 'from-purple-500 to-purple-600', title: 'Instant Notifications', desc: 'Users receive a push notification instantly, driving immediate traffic.' },
                  { num: '3', color: 'from-amber-500 to-amber-600', title: 'Complete & Verify', desc: 'Follow, like, or quote — then verify your action on-chain.' },
                  { num: '4', color: 'from-green-500 to-green-600', title: 'Claim Rewards', desc: 'Claim your G$ or USDC share. Creators reclaim unused budget when time expires.' },
                ].map((step, i) => (
                  <motion.div
                    key={step.num}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex gap-4 items-start"
                  >
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-lg`}>
                      {step.num}
                    </div>
                    <div>
                      <h4 className="font-bold text-black text-[15px]">{step.title}</h4>
                      <p className="text-sm text-gray-500 mt-1 leading-relaxed">{step.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Slide 2: Farcaster Quests ── */}
          {helpSlide === 2 && (
            <motion.div
              key="s2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-black mb-2 tracking-tight">Farcaster Quests</h2>
              <p className="text-base text-gray-500 mb-6">Six quest types for growth.</p>

              <div className="grid grid-cols-2 gap-3 pb-2">
                {[
                  { icon: faUserPlus, color: 'text-blue-500', bg: 'from-blue-50 to-blue-50/50', border: 'border-blue-100', title: 'Grow', desc: 'Increase followers.' },
                  { icon: faRetweet, color: 'text-green-500', bg: 'from-green-50 to-green-50/50', border: 'border-green-100', title: 'Amplify', desc: 'Boost: TaskPay can like and recast for you (Auto-Quest).' },
                  { icon: faQuoteRight, color: 'text-purple-500', bg: 'from-purple-50 to-purple-50/50', border: 'border-purple-100', title: 'Engage', desc: 'Thoughtful replies.' },
                  { icon: faHashtag, color: 'text-amber-500', bg: 'from-amber-50 to-amber-50/50', border: 'border-amber-100', title: 'Community', desc: 'Grow your channel.' },
                  { icon: faLayerGroup, color: 'text-indigo-500', bg: 'from-indigo-50 to-indigo-50/50', border: 'border-indigo-100', title: 'Bundle', desc: 'Follow + Amplify.' },
                  { icon: faBolt, color: 'text-red-500', bg: 'from-red-50 to-red-50/50', border: 'border-red-100', title: 'Mini App', desc: 'Real users to your app.' },
                ].map((q, i) => (
                  <motion.div
                    key={q.title}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08 * i }}
                    className={`p-4 rounded-2xl bg-gradient-to-br ${q.bg} border ${q.border} hover:shadow-sm transition-shadow`}
                  >
                    <FontAwesomeIcon icon={q.icon} className={`${q.color} text-xl mb-2`} />
                    <h4 className="font-bold text-black text-[15px]">{q.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{q.desc}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Slide 3: X (Twitter) Quests ── */}
          {helpSlide === 3 && (
            <motion.div
              key="s3"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-black mb-2 tracking-tight">X (Twitter) Quests</h2>
              <p className="text-base text-gray-500 mb-6">Cross-platform growth — now live!</p>

              <div className="space-y-3 mb-4">
                {[
                  { icon: faUserPlus, title: 'X · Grow', desc: 'Grow your X following with verified accounts.' },
                  { icon: faRetweet, title: 'X · Boost', desc: 'Get likes, retweets, quotes & comments.' },
                  { icon: faLayerGroup, title: 'X · Bundle', desc: 'Follow + engagement in one powerful quest.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                      <FontAwesomeIcon icon={item.icon} className="text-white" />
                    </div>
                    <div>
                      <h4 className="font-bold text-black text-[15px]">{item.title}</h4>
                      <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-500 leading-relaxed text-center">
                  X quests work the same way — create, verify, and earn rewards. Cross-platform growth made easy.
                </p>
              </div>
            </motion.div>
          )}

          {/* ── Slide 4: Pricing ── */}
          {helpSlide === 4 && (
            <motion.div
              key="s4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-black mb-2 tracking-tight">Pricing & Rewards</h2>
              <p className="text-base text-gray-500 mb-6">How the 0% fee bounty pool works.</p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="p-5 rounded-2xl bg-amber-50 border border-amber-100 mb-4"
              >
                <h4 className="font-bold text-amber-800 text-[15px] mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faCoins} className="text-amber-500" /> Dynamic Rewards
                </h4>
                <p className="text-amber-700 text-sm leading-relaxed">
                  The <strong>Total Reward</strong> on each quest is the full budget. It's <strong>divided equally</strong> among all who complete it.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="p-5 rounded-2xl bg-blue-50 border border-blue-100"
              >
                <h4 className="font-bold text-blue-800 text-[15px] mb-2 flex items-center gap-2">
                  <FontAwesomeIcon icon={faTrophy} className="text-blue-500" /> Be Early
                </h4>
                <p className="text-blue-700 text-sm leading-relaxed mb-2">
                  More participants = smaller share
                </p>
                <p className="text-blue-600/70 text-sm leading-relaxed">
                  Max participant caps exist to keep payouts meaningful.
                </p>
              </motion.div>
            </motion.div>
          )}

          {/* ── Slide 5: Why TaskPay ── */}
          {helpSlide === 5 && (
            <motion.div
              key="s5"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="flex-1 flex flex-col justify-center"
            >
              <h2 className="text-3xl font-black text-black mb-2 tracking-tight">Why TaskPay?</h2>
              <p className="text-base text-gray-500 mb-6">Unmatched features for everyone.</p>

              <div className="space-y-3">
                {[
                  { icon: faCoins, color: 'text-amber-600', bg: 'bg-amber-100', card: 'bg-gray-50 border-gray-100', title: '0% Fees, $1 Minimum', desc: '100% of budget goes to the reward pool.' },
                  { icon: faBullseye, color: 'text-blue-600', bg: 'bg-blue-100', card: 'bg-gray-50 border-gray-100', title: 'Advanced Targeting', desc: 'Filter bots. Set score, age & Pro rules.' },
                  { icon: faLock, color: 'text-green-600', bg: 'bg-green-100', card: 'bg-gray-50 border-gray-100', title: 'Untamperable', desc: '100% on-chain verification. Impossible to spoof.' },
                  { icon: faArrowRight, color: 'text-red-600', bg: 'bg-red-100', card: 'bg-gray-50 border-gray-100', title: 'Auto Reclaims', desc: 'Unused budget is always reclaimable.' },
                ].map((item, i) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i }}
                    className={`p-4 rounded-2xl ${item.card} border flex gap-4`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center shrink-0`}>
                      <FontAwesomeIcon icon={item.icon} className={item.color} />
                    </div>
                    <div>
                      <h4 className="font-bold text-black text-[15px] mb-0.5">{item.title}</h4>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer / Pagination */}
      <div className="shrink-0 px-5 py-4 flex items-center justify-between border-t border-gray-100 bg-white">
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_SLIDES }).map((_, step) => (
            <motion.div
              key={step}
              animate={{
                width: helpSlide === step ? 24 : 8,
                background: helpSlide === step
                  ? 'linear-gradient(90deg, #000, #333)'
                  : '#e5e7eb',
              }}
              className="h-2 rounded-full"
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {helpSlide > 0 && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => setHelpSlide(s => s - 1)}
              className="px-5 py-2.5 rounded-full font-bold text-sm text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
            >
              Back
            </motion.button>
          )}
          {helpSlide < TOTAL_SLIDES - 1 ? (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setHelpSlide(s => s + 1)}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white bg-black hover:bg-gray-800 transition-all shadow-lg flex items-center gap-1.5"
            >
              Next <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => { onClose(); setTimeout(() => setHelpSlide(0), 300) }}
              className="px-6 py-2.5 rounded-full font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:opacity-90 transition-all shadow-lg shadow-purple-500/20"
            >
              Start Earning
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ──────────────────────────────────────────────
   Full-page "Add Mini App + Follow" Gate Screen
   ────────────────────────────────────────────── */
function GateScreen({
  hasAddedApp,
  addingApp,
  handleAddApp,
  userFid,
  actions,
  onContinue,
}: {
  hasAddedApp: boolean
  addingApp: boolean
  handleAddApp: () => void
  userFid: number | undefined
  actions: any
  onContinue: () => void
}) {
  const TASKPAY_FID = 2808622
  const [followVerifyState, setFollowVerifyState] = useState<'idle' | 'checking' | 'verified' | 'not_following'>('idle')
  const [hasFollowed, setHasFollowed] = useState(false)

  const handleFollowOnFarcaster = useCallback(() => {
    actions?.viewProfile({ fid: TASKPAY_FID })
  }, [actions])

  const handleVerifyFollow = useCallback(async () => {
    if (!userFid) return
    setFollowVerifyState('checking')
    try {
      const res = await axios.get(`/api/user/verify-follow?fid=${userFid}`)
      if (res.data?.following) {
        setFollowVerifyState('verified')
        setHasFollowed(true)
      } else {
        setFollowVerifyState('not_following')
        setTimeout(() => setFollowVerifyState('idle'), 3000)
      }
    } catch (e) {
      setFollowVerifyState('not_following')
      setTimeout(() => setFollowVerifyState('idle'), 3000)
    }
  }, [userFid])

  const step1Done = hasAddedApp
  const step2Done = hasFollowed

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col bg-white"
    >
      <FloatingShapes />

      {/* Gradient accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500" />

      {/* Hero section */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-5 py-8 relative">
        {/* App icon with pulse */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 12, stiffness: 180, delay: 0.1 }}
          className="relative mb-5"
        >

          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-[26px] border-2 border-purple-300"
          />
          <motion.div
            animate={{ scale: [1, 1.4, 1], opacity: [0.15, 0, 0.15] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
            className="absolute inset-0 rounded-[26px] border border-blue-300"
          />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[26px] sm:text-[30px] font-black text-black mb-2 tracking-tight text-center leading-tight"
        >
          Get Started with{' '}
          <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-blue-600 bg-clip-text text-transparent">
            TaskPay
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-gray-500 text-[14px] mb-8 text-center max-w-[320px] leading-relaxed"
        >
          Complete two quick steps to unlock quests, earn G$ & USDC, and grow your audience.
        </motion.p>

        {/* Steps */}
        <div className="w-full max-w-sm space-y-4">
          {/* ── Step 1: Add Mini App ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={`relative rounded-2xl border transition-all duration-300 ${step1Done
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
              }`}
          >
            <div className="p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${step1Done
                ? 'bg-green-100'
                : 'bg-gradient-to-br from-purple-100 to-blue-100'
                }`}>
                {step1Done ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-lg" />
                ) : (
                  <span className="text-black font-bold text-sm">1</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-black mb-1">
                  {step1Done ? 'App Added ✓' : 'Add TaskPay Mini App'}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  Add TaskPay to your Farcaster apps to access quests and earn rewards.
                </p>

                {!step1Done && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleAddApp}
                    disabled={addingApp}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
                    style={{ boxShadow: '0 6px 20px rgba(124, 58, 237, 0.25)' }}
                  >
                    {addingApp ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faPlus} className="text-xs" />
                        Add TaskPay
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Step 2: Follow on Farcaster ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className={`relative rounded-2xl border transition-all duration-300 ${step2Done
              ? 'bg-green-50 border-green-200'
              : step1Done
                ? 'bg-gray-50 border-gray-200'
                : 'bg-gray-50/50 border-gray-100 opacity-50'
              }`}
          >
            <div className="p-4 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${step2Done
                ? 'bg-green-100'
                : 'bg-gradient-to-br from-violet-100 to-purple-100'
                }`}>
                {step2Done ? (
                  <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-lg" />
                ) : (
                  <span className="text-black font-bold text-sm">2</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-bold text-black mb-1">
                  {step2Done ? 'Following ✓' : 'Follow TaskPay on Farcaster'}
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed mb-3">
                  Stay updated with new quests, rewards, and platform updates.
                </p>

                {!step2Done && (
                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleFollowOnFarcaster}
                      disabled={!step1Done}
                      className="flex-1 py-3 rounded-xl bg-black text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:bg-gray-800"
                    >
                      <FontAwesomeIcon icon={faUserPlus} className="text-xs" />
                      Follow
                    </motion.button>

                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleVerifyFollow}
                      disabled={!step1Done || followVerifyState === 'checking'}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${followVerifyState === 'verified'
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : followVerifyState === 'not_following'
                          ? 'bg-red-50 border-red-200 text-red-500'
                          : 'bg-white border-gray-200 text-black hover:bg-gray-50'
                        }`}
                    >
                      {followVerifyState === 'checking' ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} className="text-xs animate-spin" />
                          Checking...
                        </>
                      ) : followVerifyState === 'verified' ? (
                        <>
                          <FontAwesomeIcon icon={faCheckCircle} className="text-xs" />
                          Verified!
                        </>
                      ) : followVerifyState === 'not_following' ? (
                        <>
                          <FontAwesomeIcon icon={faExclamationCircle} className="text-xs" />
                          Not yet
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faCheck} className="text-xs" />
                          Verify
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Continue Button (Appears when both steps done) ── */}
        <AnimatePresence>
          {step1Done && step2Done && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 w-full max-w-sm"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onContinue}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white font-black text-base flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl transition-all"
                style={{ boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)' }}
              >
                Continue to TaskPay
                <FontAwesomeIcon icon={faArrowRight} className="text-sm" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {['💰 Earn G$ & USDC', '🔗 On-chain', '⚡ Instant', '🛡️ Trustless'].map((badge) => (
            <span key={badge} className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200">
              {badge}
            </span>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-[11px] text-gray-400 mt-4 text-center"
        >
          Takes 5 seconds · Free · No gas fees
        </motion.p>
      </div>
    </motion.div>
  )
}


/* ─────────────────────
   Main Demo component
   ───────────────────── */
export function Demo() {
  const [currentView, setCurrentView] = useState<'earn' | 'promote' | 'profile' | 'leaderboard'>('earn')
  const [headerSuccess, setHeaderSuccess] = useState<string | null>(null)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [helpSlide, setHelpSlide] = useState(0)
  const { isConnected, chainId } = useAccount()
  const { actions, context } = useFrame()
  const [initializing, setInitializing] = useState(false)
  const { connect, connectors } = useConnect()
  const { switchChainAsync } = useSwitchChain()
  const [hasAddedApp, setHasAddedApp] = useState(false)
  const [addingApp, setAddingApp] = useState(false)
  const [unclaimedUsdc, setUnclaimedUsdc] = useState(0)
  const [showUnclaimedBanner, setShowUnclaimedBanner] = useState(false)
  const [earnFilter, setEarnFilter] = useState<'active' | 'filled' | 'completed'>('active')
  const [visibleQuestCount, setVisibleQuestCount] = useState(0)
  const [hasFollowed, setHasFollowed] = useState(false)
  const [promotePlatform, setPromotePlatform] = useState<'farcaster' | 'x'>('farcaster')
  const [showChat, setShowChat] = useState(false)
  const [unreadMentions, setUnreadMentions] = useState(0)

  // localStorage gate: show the full gate until both steps done
  const [gateCompleted, setGateCompleted] = useState(false)

  // Read before paint so follow-check and other effects do not run verify-follow when gate is already done
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem('taskpay_gate_v2') === 'true') setGateCompleted(true)
  }, [])

  useEffect(() => {
    if (!headerSuccess) return
    const t = setTimeout(() => setHeaderSuccess(null), 5000)
    return () => clearTimeout(t)
  }, [headerSuccess])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasSeen = localStorage.getItem('hasSeenTaskPay')
      if (!hasSeen) {
        setShowHelpModal(true)
        localStorage.setItem('hasSeenTaskPay', 'true')
      }
    }
  }, [])

  useEffect(() => {
    setInitializing(true)
    const connectAttempts = [100, 800, 1500];
    const connectTimers: NodeJS.Timeout[] = [];

    if (connectors && connectors[0]) {
      connectAttempts.forEach(delay => {
        const timer = setTimeout(() => {
          try {
            connect({ connector: connectors[0] });
          } catch (err) {
            console.log('Connection attempt failed:', err);
          }
        }, delay);
        connectTimers.push(timer);
      });
    }

    const finalTimer = setTimeout(() => {
      setInitializing(false);
    }, 2000);

    return () => {
      connectTimers.forEach(timer => clearTimeout(timer));
      clearTimeout(finalTimer);
    }
  }, [connect, connectors])

  // Check if user has added the mini app (dynamically forces gate if removed)
  useEffect(() => {
    if (context?.client) {
      if (context.client.added === true) {
        setHasAddedApp(true)
      } else if (context.client.added === false) {
        setHasAddedApp(false)
        setGateCompleted(false)
        localStorage.removeItem('taskpay_gate_v2')
      }
    }
  }, [context])

  // Check if user already follows TaskPay on mount (skip if gate already stored — no follow API)
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('taskpay_gate_v2') === 'true') return
    if (!context?.user?.fid || gateCompleted) return
    let cancelled = false
      ; (async () => {
        try {
          const res = await axios.get(`/api/user/verify-follow?fid=${context.user.fid}`)
          if (!cancelled && res.data?.following) {
            setHasFollowed(true)
          }
        } catch {
          // ignore
        }
      })()
    return () => { cancelled = true }
  }, [context?.user?.fid, gateCompleted])

  const handleAddApp = async () => {
    setAddingApp(true)
    try {
       sdk.actions.addMiniApp()
      setHasAddedApp(true)
    } catch (err: any) {
      console.warn('Add mini app failed:', err)
    } finally {
      setAddingApp(false)
    }
  }

  // After connect, switch to Arbitrum if not already on it
  useEffect(() => {
    if (!isConnected || !switchChainAsync || chainId === arbitrum.id) return
    switchChainAsync({ chainId: arbitrum.id }).catch(() => { })
  }, [isConnected, chainId, switchChainAsync])

  // Fetch unclaimed USDC on mount
  useEffect(() => {
    const fid = context?.user?.fid
    if (!gateCompleted || !fid) return
    let cancelled = false
      ; (async () => {
        try {
          const res = await axios.get(`/api/tasks/user-completions?userFid=${fid}`)
          const completions = res.data?.completions || []
          const unclaimed = completions
            .filter((c: any) => c.status === 'success' && c.claimStatus === 'unclaimed' && c.task?.computedRewardPerUser)
            .reduce((sum: number, c: any) => sum + (c.task?.computedRewardPerUser || 0), 0)
          if (!cancelled && unclaimed > 0) {
            setUnclaimedUsdc(unclaimed)
            setShowUnclaimedBanner(true)
            setTimeout(() => {
              if (!cancelled) setShowUnclaimedBanner(false)
            }, 8000)
          }
        } catch (e) {
          // ignore
        }
      })()
    return () => { cancelled = true }
  }, [context?.user?.fid, gateCompleted])

  // Poll for unread chat mentions every 30s
  useEffect(() => {
    if (!context?.user?.fid || !gateCompleted) return
    let cancelled = false
    const fetchMentions = async () => {
      try {
        const res = await axios.get(`/api/chat/mentions?fid=${context.user!.fid}`)
        if (!cancelled) setUnreadMentions(res.data?.unreadCount || 0)
      } catch { /* ignore */ }
    }
    fetchMentions()
    const interval = setInterval(fetchMentions, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [context?.user?.fid, gateCompleted, showChat])

  const appUnlocked = gateCompleted
  const showGate = !gateCompleted

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-black font-sans overflow-hidden max-w-[100vw]">
      {/* Header */}
      <header className="shrink-0 z-40 glass-light px-4 py-3 flex items-center justify-between border-b border-gray-100/50">
        {currentView === 'earn' ? (
          <div className="flex flex-col items-center gap-1 mt-1">
            <div className="flex bg-gray-100/60 p-1 rounded-[14px] shadow-inner backdrop-blur-md relative border border-gray-200/50 min-w-[200px]">
              {[{ id: 'active', label: 'Active' }, { id: 'completed', label: 'Completed' }].map((tab) => {
                const isSelected = earnFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setEarnFilter(tab.id as 'active' | 'completed')}
                    className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[14px] font-bold transition-colors z-10 focus:outline-none ${isSelected ? 'text-black' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="earnFilterTab"
                        className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/5 z-[-1]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">
              {visibleQuestCount} Quests
            </span>
          </div>
        ) : currentView === 'promote' ? (
          <div className="flex bg-gray-100/60 p-1 rounded-[14px] shadow-inner backdrop-blur-md relative border border-gray-200/50 min-w-[200px]">
            {['farcaster', 'x'].map((tab) => {
              const isSelected = promotePlatform === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setPromotePlatform(tab as 'farcaster' | 'x')}
                  className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-bold transition-colors z-10 focus:outline-none ${isSelected ? 'text-black' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="navPlatformTab"
                      className="absolute inset-0 bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] border border-black/5 z-[-1]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  {tab === 'farcaster' ? (
                    <><FarcasterLogo size={13} /> Farcaster</>
                  ) : (
                    <><XLogo size={11} /> X (Twitter)</>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <h1 className="text-lg font-bold tracking-tight">
            {currentView === 'profile' && 'Me'}
            {currentView === 'leaderboard' && 'Leaderboard'}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowChat(true); setUnreadMentions(0) }}
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            aria-label="Community Chat"
          >
            <FontAwesomeIcon icon={faComments} className="text-lg" />
            {unreadMentions > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-lg animate-scale-in">
                {unreadMentions > 9 ? '9+' : unreadMentions}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView(currentView === 'leaderboard' ? 'earn' : 'leaderboard')}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors ${currentView === 'leaderboard'
              ? 'text-amber-500 bg-amber-50'
              : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50/50'
              }`}
            aria-label="Leaderboard"
          >
            <FontAwesomeIcon icon={faTrophy} className="text-lg" />
          </button>

          <div className="flex items-center gap-2">
            {headerSuccess ? (
              <>
                <FontAwesomeIcon icon={faCheck} className="text-green-500 text-sm" />
                <span className="text-xs font-semibold text-green-600">{headerSuccess}</span>
              </>
            ) : (
              <></>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden w-full max-w-full min-w-0">
        {/* Unclaimed USDC Banner */}
        <AnimatePresence>
          {showUnclaimedBanner && unclaimedUsdc > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -60, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="mx-4 mt-2 mb-2"
            >
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 p-[1px] shadow-lg"
                style={{ boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)' }}
              >
                <div className="rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500 px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faCoins} className="text-white text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">Unclaimed Rewards</p>
                    <p className="text-white text-lg font-black tabular-nums">{unclaimedUsdc.toFixed(4)} rewards</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowUnclaimedBanner(false)
                      setCurrentView('profile')
                    }}
                    className="px-4 py-2 rounded-xl bg-white text-green-700 text-xs font-bold shadow-md hover:bg-white/90 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                  >
                    <FontAwesomeIcon icon={faWallet} className="text-[10px]" />
                    Claim Now
                  </button>
                  <button
                    onClick={() => setShowUnclaimedBanner(false)}
                    className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors shrink-0"
                  >
                    <FontAwesomeIcon icon={faTimes} className="text-[10px] text-white" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <>
          {currentView === 'earn' && (
            <div className="animate-fade-in w-full">
              <TaskFeed
                onTaskVerified={() => setHeaderSuccess('Verified!')}
                filter={earnFilter}
                onFilterChange={setEarnFilter}
                onVisibleCountChange={setVisibleQuestCount}
              />
            </div>
          )}

          {currentView === 'promote' && (
            <div className="animate-slide-up w-full max-w-full min-w-0 overflow-x-hidden">
              <CreateTask
                onQuestCreated={() => setHeaderSuccess('Quest created!')}
                platform={promotePlatform}
              />
            </div>
          )}

          {currentView === 'profile' && (
            <div className="animate-fade-in">
              <Profile />
            </div>
          )}

          {currentView === 'leaderboard' && (
            <div className="animate-fade-in">
              <Leaderboard />
            </div>
          )}
        </>

        <div aria-hidden="true" className="h-6 shrink-0" />
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 relative overflow-visible glass-light border-t border-gray-100 z-50">
        <div className="max-w-md mx-auto flex items-center justify-around py-1 px-3">
          <NavButton
            active={currentView === 'earn'}
            onClick={() => setCurrentView('earn')}
            icon={faHome}
            label="Earn"
            disabled={false}
          />

          <button
            onClick={() => appUnlocked && setCurrentView('promote')}
            disabled={!appUnlocked}
            className={`relative -top-5 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 ${!appUnlocked
              ? 'bg-gray-300 cursor-not-allowed opacity-50'
              : currentView === 'promote'
                ? 'bg-black text-white scale-110'
                : 'bg-black text-white hover:scale-105'
              }`}
            style={{ boxShadow: appUnlocked ? '0 8px 24px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            {!appUnlocked ? (
              <FontAwesomeIcon icon={faLock} className="text-white/70 text-sm" />
            ) : (
              <FontAwesomeIcon icon={faPlus} className="text-lg" />
            )}
          </button>

          <NavButton
            active={currentView === 'profile'}
            onClick={() => appUnlocked && setCurrentView('profile')}
            icon={faUser}
            label="Profile"
            disabled={!appUnlocked}
          />
        </div>
      </nav>

      <AnimatePresence>
        {showGate && (
          <GateScreen
            hasAddedApp={hasAddedApp}
            addingApp={addingApp}
            handleAddApp={handleAddApp}
            userFid={context?.user?.fid}
            actions={actions}
            onContinue={() => {
              setGateCompleted(true)
              localStorage.setItem('taskpay_gate_v2', 'true')
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Full-page Intro / Help Overlay ── */}
      <AnimatePresence>
        {showHelpModal && (
          <IntroOverlay
            onClose={() => setShowHelpModal(false)}
            helpSlide={helpSlide}
            setHelpSlide={setHelpSlide}
          />
        )}
      </AnimatePresence>

      {/* ── Group Chat Overlay ── */}
      <AnimatePresence>
        {showChat && (
          <GroupChat
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            userFid={context?.user?.fid}
            userProfile={{
              username: (context?.user as any)?.username,
              displayName: (context?.user as any)?.displayName,
              pfpUrl: (context?.user as any)?.pfpUrl,
            }}
            onOpenUrl={(url) => actions?.openUrl?.(url)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function NavButton({ active, onClick, icon, label, disabled = false }: { active: boolean, onClick: () => void, icon: any, label: string, disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      disabled={disabled}
      className={`flex flex-col items-center justify-center w-16 py-2 transition-all duration-200 ${disabled
        ? 'text-gray-300 cursor-not-allowed opacity-50'
        : active ? 'text-black' : 'text-gray-400 hover:text-gray-600'
        }`}
    >
      <div className="relative">
        <FontAwesomeIcon icon={icon} className="text-lg mb-1" />
        {disabled && (
          <div className="absolute -top-1 -right-2">
            <FontAwesomeIcon icon={faLock} className="text-[8px] text-gray-400" />
          </div>
        )}
      </div>
      <span className="text-[10px] font-semibold">{label}</span>
      {active && !disabled && (
        <div className="w-1 h-1 rounded-full bg-black mt-1 animate-scale-in" />
      )}
    </button>
  );
}
