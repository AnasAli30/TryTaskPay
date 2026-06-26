'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'

/** Marketing page only — app shell keeps Inter (layout + globals). */
const websiteFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
})
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useReducedMotion,
  useMotionValueEvent,
} from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCoins, faUserPlus, faRetweet, faQuoteRight, faHashtag,
  faLayerGroup, faBolt, faShieldHalved, faArrowRight, faRocket,
  faWallet, faBullseye, faCheck, faLock, faGift, faTrophy,
  faChevronDown, faStar, faArrowUpRightFromSquare, faCircleCheck,
  faClock, faUsers, faChartLine, faHeart, faComment, faBars, faXmark,
  faLink,
} from '@fortawesome/free-solid-svg-icons'
import axios from 'axios'
import { XLogo, FarcasterLogo } from '../icons'
import { TaskPayMark } from '@/components/brand/TaskPayMark'
import { focusRing } from '@/components/brand/constants'

/* ─── Fade-up wrapper ─── */
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: '-60px' })
  const reduceMotion = useReducedMotion()
  const off = reduceMotion === true
  return (
    <motion.div
      ref={ref}
      initial={off ? { opacity: 0 } : { opacity: 0, y: 32 }}
      animate={isInView ? (off ? { opacity: 1 } : { opacity: 1, y: 0 }) : {}}
      transition={{ duration: off ? 0.2 : 0.6, delay: off ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Floating particle (decorative) ─── */
function FloatingOrb({ className, size, delay }: { className: string; size: number; delay: number }) {
  const reduceMotion = useReducedMotion()
  const off = reduceMotion === true
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl opacity-20 pointer-events-none ${className}`}
      style={{ width: size, height: size }}
      animate={
        off
          ? {}
          : {
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.08, 1],
          }
      }
      transition={{ duration: 8, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

/* ─── Animated counter ─── */
function AnimatedCounter({ target, suffix = '', prefix = '', label, icon, iconColor }: {
  target: number; suffix?: string; prefix?: string; label: string; icon: any; iconColor: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true })
  const [count, setCount] = useState(0)
  const reduceMotion = useReducedMotion()
  const off = reduceMotion === true

  useEffect(() => {
    if (!isInView) return
    if (off) {
      setCount(target)
      return
    }
    const duration = 1500
    const steps = 40
    const increment = target / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [isInView, target, off])

  return (
    <div ref={ref} className="text-center">
      <motion.div
        initial={off ? { opacity: 0 } : { opacity: 0, scale: 0.5 }}
        animate={isInView ? (off ? { opacity: 1 } : { opacity: 1, scale: 1 }) : {}}
        transition={{ duration: off ? 0.15 : 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <FontAwesomeIcon icon={icon} className={`text-lg ${iconColor}`} />
        </div>
        <div className="text-3xl md:text-4xl font-black text-black tracking-tight tabular-nums">
          {prefix}{count.toLocaleString()}{suffix}
        </div>
      </motion.div>
      <p className="text-sm text-gray-500 mt-2 font-medium">{label}</p>
    </div>
  )
}


/* ─── Quest type cards ─── */
const farcasterQuests = [
  { icon: faUserPlus, color: 'blue', title: 'Follow', desc: 'Grow your audience with real, verified followers on Farcaster.' },
  { icon: faRetweet, color: 'green', title: 'Amplify', desc: 'Get genuine likes, recasts and engagement on your casts.' },
  { icon: faQuoteRight, color: 'purple', title: 'Engage', desc: 'Drive thoughtful quote casts and meaningful conversations.' },
  { icon: faHashtag, color: 'amber', title: 'Channel', desc: 'Build your Farcaster channel community organically.' },
  { icon: faLayerGroup, color: 'indigo', title: 'Bundle', desc: 'Combine follow + engagement in a single powerful quest.' },
  { icon: faBolt, color: 'rose', title: 'Mini App', desc: 'Send verified users directly to your Farcaster mini app.' },
]

const xQuests = [
  { icon: faUserPlus, color: 'slate', title: 'X · Follow', desc: 'Grow your X (Twitter) following with real, verified accounts.' },
  { icon: faRetweet, color: 'slate', title: 'X · Boost', desc: 'Get likes, retweets, quotes and comments on your posts.' },
  { icon: faLayerGroup, color: 'slate', title: 'X · Bundle', desc: 'Follow + engagement combined in one powerful X quest.' },
]

const onChainQuests = [
  {
    icon: faLink,
    color: 'violet',
    title: 'Custom On-Chain',
    desc: 'Reward users for verified smart-contract actions in your dapp — swap, mint, stake, deposit, or any event you define.',
  },
]

const customQuestFlow = [
  {
    step: '01',
    title: 'Open task',
    desc: 'User opens the quest and your dapp from the TaskPay feed.',
    icon: faArrowUpRightFromSquare,
    color: 'from-violet-500 to-purple-600',
  },
  {
    step: '02',
    title: 'Act in your dapp',
    desc: 'Users complete the on-chain action in your app with the same wallet. No tx hash paste. No manual proof.',
    icon: faBolt,
    color: 'from-blue-500 to-indigo-600',
  },
  {
    step: '03',
    title: 'Auto-scan & verify',
    desc: 'TaskPay scans the wallet for a matching contract, function, and event after the Open timestamp. Success is instant — no admin script.',
    icon: faCircleCheck,
    color: 'from-emerald-500 to-teal-600',
  },
  {
    step: '04',
    title: 'Claim G$ & USDC',
    desc: 'Verified earners claim from profile via CustomTaskPay escrow — signed claim, one tap, straight to wallet.',
    icon: faWallet,
    color: 'from-amber-500 to-orange-600',
  },
]

const colorMap: Record<string, { bg: string; border: string; iconBg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100', text: 'text-blue-600' },
  green: { bg: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100', text: 'text-emerald-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-100', iconBg: 'bg-purple-100', text: 'text-purple-600' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-100', iconBg: 'bg-amber-100', text: 'text-amber-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-100', iconBg: 'bg-indigo-100', text: 'text-indigo-600' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-100', iconBg: 'bg-rose-100', text: 'text-rose-600' },
  slate: { bg: 'bg-gray-50', border: 'border-gray-200', iconBg: 'bg-gray-900', text: 'text-white' },
  violet: { bg: 'bg-violet-50', border: 'border-violet-100', iconBg: 'bg-violet-600', text: 'text-white' },
}


/* ═══════════════════════════════════════════════════════════
   WEBSITE COMPONENT — Full landing page
   ═══════════════════════════════════════════════════════════ */
const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#custom-quests', label: 'On-Chain' },
  { href: '#quest-types', label: 'Quest Types' },
  { href: '#pricing', label: 'Pricing' },
] as const

export default function Website() {
  const heroRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress, scrollY } = useScroll()
  const reduceMotion = useReducedMotion()
  const motionOff = reduceMotion === true
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], motionOff ? [1, 1] : [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.15], motionOff ? [1, 1] : [1, 0.96])
  const [navOpen, setNavOpen] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [questPlatform, setQuestPlatform] = useState<'farcaster' | 'x' | 'onchain'>('farcaster')

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setNavScrolled(latest > 16)
  })

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [navOpen])

  useEffect(() => {
    if (!navOpen) return
    const t = window.setTimeout(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>('a[href]')?.focus()
    }, 100)
    return () => window.clearTimeout(t)
  }, [navOpen])

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

  // Cycle through "how it works" steps (skip auto-rotation when reduced motion is preferred)
  useEffect(() => {
    if (motionOff) return
    const interval = setInterval(() => setActiveStep((s) => (s + 1) % 5), 4000)
    return () => clearInterval(interval)
  }, [motionOff])

  const steps = [
    {
      num: '01',
      title: 'Create or launch',
      desc: 'Pick a social quest type and budget, or submit a custom on-chain action for your dapp — approve, fund, and launch on escrow.',
      icon: faRocket,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      num: '02',
      title: 'Users discover',
      desc: 'Quests appear in the feed with live G$ and USDC pools. Farcaster users get instant push notifications when new quests go live.',
      icon: faBolt,
      color: 'from-purple-500 to-pink-600',
    },
    {
      num: '03',
      title: 'Complete the action',
      desc: 'Social: follow, boost, or engage on Farcaster/X. Custom: open the quest, complete the on-chain action in your app.',
      icon: faBullseye,
      color: 'from-violet-500 to-purple-600',
    },
    {
      num: '04',
      title: 'Verify instantly',
      desc: 'Social quests verify via API + one on-chain tap. Custom quests auto-scan the wallet after Open — no tx hash, no admin wait.',
      icon: faCircleCheck,
      color: 'from-emerald-500 to-teal-600',
    },
    {
      num: '05',
      title: 'Claim G$ & USDC',
      desc: 'Rewards unlock on profile. Claim from TaskPay or CustomTaskPay escrow with a signed message — straight to wallet.',
      icon: faWallet,
      color: 'from-amber-500 to-orange-600',
    },
  ]

  const activeQuests =
    questPlatform === 'farcaster' ? farcasterQuests : questPlatform === 'x' ? xQuests : onChainQuests

  const openApp = () => window.open('https://farcaster.xyz/miniapps/yfZqr7DiqHjC/taskpay', '_blank')
  const launchDapp = () => { window.location.href = '/app' }

  return (
    <div
      className={`${websiteFont.className} min-h-screen bg-white text-black overflow-x-hidden selection:bg-black selection:text-white antialiased`}
    >

      {/* ─── Sticky Nav ─── */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 inset-x-0 z-50"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4">
          <div
            className={`flex items-center justify-between gap-3 bg-white/70 backdrop-blur-2xl border border-gray-200/60 rounded-2xl px-4 sm:px-5 py-3 shadow-lg transition-shadow duration-300 ${navScrolled ? 'shadow-xl shadow-black/[0.06] border-gray-200' : 'shadow-black/[0.03]'
              }`}
          >
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <TaskPayMark size="md2" priority />
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
              {NAV_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className={`hover:text-black transition-colors ${focusRing}`}
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <motion.button
                whileHover={motionOff ? undefined : { scale: 1.03 }}
                whileTap={motionOff ? undefined : { scale: 0.97 }}
                onClick={launchDapp}
                className={`px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-black text-white text-xs sm:text-sm font-bold hover:bg-gray-900 transition-colors shadow-md shadow-black/10 ${focusRing}`}
              >
                Launch App
              </motion.button>
              <motion.button
                whileHover={motionOff ? undefined : { scale: 1.03 }}
                whileTap={motionOff ? undefined : { scale: 0.97 }}
                onClick={openApp}
                className={`hidden sm:inline-flex px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-bold text-gray-800 hover:bg-gray-50 transition-colors ${focusRing}`}
              >
                Open in Farcaster
              </motion.button>
              <motion.button
                type="button"
                aria-expanded={navOpen}
                aria-controls="mobile-nav-panel"
                aria-label={navOpen ? 'Close menu' : 'Open menu'}
                whileHover={motionOff ? undefined : { scale: 1.03 }}
                whileTap={motionOff ? undefined : { scale: 0.97 }}
                onClick={() => setNavOpen((o) => !o)}
                className={`md:hidden p-2 sm:p-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors ${focusRing}`}
              >
                <FontAwesomeIcon icon={navOpen ? faXmark : faBars} className="text-base sm:text-lg w-4 h-4 sm:w-5 sm:h-5" />
              </motion.button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {navOpen && (
            <>
              <motion.button
                key="nav-backdrop"
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-[60] bg-black/40 md:hidden cursor-default"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => setNavOpen(false)}
              />
              <motion.div
                key="nav-panel"
                id="mobile-nav-panel"
                ref={mobileMenuRef}
                role="dialog"
                aria-modal="true"
                aria-label="Site navigation"
                className="fixed top-0 right-0 bottom-0 z-[70] w-full max-w-sm bg-white shadow-2xl md:hidden flex flex-col border-l border-gray-200"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                  <span className="text-lg font-black tracking-tight">Menu</span>
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setNavOpen(false)}
                    className={`p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors ${focusRing}`}
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-xl" />
                  </button>
                </div>
                <nav className="flex flex-col p-4 gap-1">
                  {NAV_LINKS.map(({ href, label }) => (
                    <a
                      key={href}
                      href={href}
                      className={`px-4 py-3.5 rounded-xl text-base font-semibold text-gray-700 hover:bg-gray-50 hover:text-black transition-colors ${focusRing}`}
                      onClick={() => setNavOpen(false)}
                    >
                      {label}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setNavOpen(false)
                      openApp()
                    }}
                    className={`mt-4 mx-4 py-3.5 rounded-xl bg-black text-white text-base font-bold text-center hover:bg-gray-900 transition-colors ${focusRing}`}
                  >
                    Open App
                  </button>
                </nav>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.nav>


      {/* ═══════════ HERO ═══════════ */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden pt-28 pb-20 px-6">
        {/* Background orbs */}
        <FloatingOrb className="bg-blue-400 top-20 -left-32" size={400} delay={0} />
        <FloatingOrb className="bg-purple-400 top-40 -right-20" size={350} delay={2} />
        <FloatingOrb className="bg-amber-300 bottom-20 left-1/3" size={300} delay={4} />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '64px 64px',
          }}
        />

        <motion.div style={{ opacity: heroOpacity, scale: heroScale }} className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 border border-gray-200/80 shadow-sm backdrop-blur-sm mb-8"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">Powered by G$ on Celo</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Complete quests.
            <br />
            <span className="relative">
              Get paid in
              <span className="relative inline-block ml-3">
                <span className="relative z-10">G$</span>
                <motion.span
                  className="absolute -inset-x-2 -inset-y-1 bg-amber-200/50 rounded-lg -z-0"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.5, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
                  style={{ originX: 0 }}
                />
              </span>
              <span className="text-gray-300">.</span>
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="max-w-3xl mx-auto mb-8"
          >
            <p className="text-[1.35rem] sm:text-2xl md:text-[1.75rem] font-bold text-gray-900 tracking-tight leading-[1.35] mb-6">
              Fund quests. Verify actions.{' '}
              <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Pay in G$ & USDC.
              </span>
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-sm font-bold text-gray-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100">
                  <FarcasterLogo size={13} />
                </span>
                Farcaster
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200/90 shadow-[0_1px_2px_rgba(0,0,0,0.04)] text-sm font-bold text-gray-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-900">
                  <XLogo size={12} className="text-white" />
                </span>
                X
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200/80 shadow-[0_1px_2px_rgba(139,92,246,0.08)] text-sm font-bold text-violet-900">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600">
                  <FontAwesomeIcon icon={faLink} className="text-[10px] text-white" />
                </span>
                On-chain dapps
              </span>
            </div>

            <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200/70 bg-white/50 backdrop-blur-sm px-5 py-4 sm:px-6 sm:py-5 shadow-sm">
              <p className="text-sm sm:text-[0.9375rem] text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">For creators:</span> launch social growth quests or reward any smart-contract action in your app.
              </p>
              <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
              <p className="text-sm sm:text-[0.9375rem] text-gray-600 leading-relaxed">
                <span className="font-semibold text-gray-900">For earners:</span> complete tasks, get verified automatically, claim G$ or USDC to your wallet.
              </p>
            </div>
          </motion.div>


          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <motion.button
              whileHover={motionOff ? undefined : { scale: 1.04, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
              whileTap={motionOff ? undefined : { scale: 0.97 }}
              onClick={launchDapp}
              className={`group px-8 py-4 rounded-2xl bg-black text-white text-base font-bold shadow-xl shadow-black/10 flex items-center gap-3 transition-all w-full sm:w-auto justify-center ${focusRing}`}
            >
              Launch App
              <FontAwesomeIcon icon={faArrowRight} className="text-sm opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </motion.button>
            <motion.button
              whileHover={motionOff ? undefined : { scale: 1.04, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
              whileTap={motionOff ? undefined : { scale: 0.97 }}
              onClick={openApp}
              className={`group px-8 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 text-base font-bold shadow-sm flex items-center gap-3 transition-all w-full sm:w-auto justify-center ${focusRing}`}
            >
              Open in Farcaster
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-sm opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </motion.button>
            <motion.a
              href="#how-it-works"
              whileHover={motionOff ? undefined : { scale: 1.03 }}
              whileTap={motionOff ? undefined : { scale: 0.97 }}
              className={`px-8 py-4 rounded-2xl border-2 border-gray-200 text-base font-bold text-gray-600 hover:border-gray-400 hover:text-black transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${focusRing}`}
            >
              Learn More
              <FontAwesomeIcon icon={faChevronDown} className="text-xs" />
            </motion.a>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-wrap items-center justify-center gap-6 mt-12 text-xs text-gray-400 font-medium"
          >
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faShieldHalved} className="text-green-500" />
              On-chain verified
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faLock} className="text-blue-500" />
              Non-custodial
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faCoins} className="text-amber-500" />
              0% platform fee
            </span>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden sm:block"
          aria-hidden
        >
          <motion.div
            animate={motionOff ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-6 h-10 rounded-full border-2 border-gray-300 flex items-start justify-center p-1.5"
          >
            <motion.div className="w-1.5 h-3 rounded-full bg-gray-400" />
          </motion.div>
        </motion.div>
      </section>


      {/* ═══════════ LIVE STATS BAR ═══════════ */}
      <section className="py-16 px-6 border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-5xl mx-auto">
          {statsLoaded && (platformStats.totalQuests > 0 || platformStats.totalUsers > 0) ? (
            <>
              <FadeUp className="text-center mb-10">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Live platform stats
                </span>
              </FadeUp>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 md:gap-12 max-w-lg sm:max-w-none mx-auto">
                <AnimatedCounter
                  target={platformStats.totalQuests}
                  label="Quests Completed"
                  icon={faCircleCheck}
                  iconColor="text-emerald-600"
                />
                <AnimatedCounter
                  target={platformStats.totalUsers}
                  label="Unique Earners"
                  icon={faUsers}
                  iconColor="text-blue-600"
                />
                <AnimatedCounter
                  target={Math.round(platformStats.totalRewards)}
                  label="Rewards Distributed"
                  prefix="$"
                  icon={faCoins}
                  iconColor="text-amber-600"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: '$1', label: 'Minimum Quest Budget' },
                { value: '0%', label: 'Platform Fees' },
                { value: '10', label: 'Quest Types' },
                { value: '∞', label: 'Earning Potential' },
              ].map((s, i) => (
                <FadeUp key={i} delay={i * 0.1} className="text-center">
                  <div className="text-4xl md:text-5xl font-black text-black tracking-tight">{s.value}</div>
                  <p className="text-sm text-gray-500 mt-2 font-medium">{s.label}</p>
                </FadeUp>
              ))}
            </div>
          )}
        </div>
      </section>


      {/* ═══════════ CROSS-PLATFORM BANNER ═══════════ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <div className="relative rounded-3xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-black to-gray-900" />
              <div className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(139,92,246,0.4), transparent 60%), radial-gradient(circle at 70% 50%, rgba(59,130,246,0.4), transparent 60%)',
                }}
              />
              <div className="relative z-10 px-8 py-12 md:px-14 md:py-16 text-center">
                <div className="flex items-center justify-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <FarcasterLogo size={24} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-white/40">
                    <span className="w-3 h-px bg-white/30" />
                    <span className="text-xs font-bold">+</span>
                    <span className="w-3 h-px bg-white/30" />
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10">
                    <XLogo size={22} className="text-white" />
                  </div>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tight">Cross-platform growth</h2>
                <p className="text-gray-400 max-w-lg mx-auto text-sm md:text-base leading-relaxed mb-6">
                  Run social quests on Farcaster and X, or launch custom on-chain quests that reward users for verified actions in your dapp — all from one dashboard.
                </p>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {['Follow quests', 'Boost engagement', 'Quote posts', 'Bundle campaigns', 'Mini app promotion', 'Custom on-chain actions'].map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-semibold text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>


      {/* ═══════════ TWO AUDIENCES ═══════════ */}
      <section id="features" className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">Built for everyone</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Two sides. One platform.</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Whether you&apos;re building an audience or earning rewards, TaskPay has you covered.</p>
          </FadeUp>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Creators */}
            <FadeUp delay={0.1}>
              <div className="relative group rounded-3xl border border-gray-200 bg-white p-8 md:p-10 overflow-hidden hover:border-gray-300 transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.03]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-100/40 to-orange-100/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-6">
                    <FontAwesomeIcon icon={faRocket} className="text-amber-600 text-xl" />
                  </div>
                  <h3 className="text-2xl font-black mb-3">For Creators</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-8">Launch social quests on Farcaster & X, or fund custom on-chain quests that pay users for verified actions in your dapp.</p>
                  <div className="space-y-4">
                    {[
                      'Set budget from just 1 G$ or $1 USDC',
                      'Social quests: follow, boost, quote, channel, mini app',
                      'Custom on-chain: define contract, function & event to track',
                      'Fund & launch on TaskPay or CustomTaskPay escrow',
                      'Target quality users with eligibility filters',
                      'Reclaim unused budget anytime after expiry',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                          <FontAwesomeIcon icon={faCheck} className="text-[10px] text-amber-600" />
                        </div>
                        <span className="text-sm text-gray-600 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>

            {/* Users */}
            <FadeUp delay={0.2}>
              <div className="relative group rounded-3xl border border-gray-200 bg-white p-8 md:p-10 overflow-hidden hover:border-gray-300 transition-all duration-300 hover:shadow-xl hover:shadow-black/[0.03]">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/40 to-indigo-100/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
                <div className="relative z-10">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-6">
                    <FontAwesomeIcon icon={faWallet} className="text-blue-600 text-xl" />
                  </div>
                  <h3 className="text-2xl font-black mb-3">For Users</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-8">Complete social quests or custom on-chain tasks, then earn real G$ or USDC straight to your wallet. No middlemen.</p>
                  <div className="space-y-4">
                    {[
                      'Browse active quests with live reward amounts',
                      'Social: follow, boost, engage — verify with one on-chain tap',
                      'Custom: open the quest, act in the dapp, auto-verify',
                      'No tx hash paste — wallet scan matches contract + event',
                      'Claim G$ or USDC instantly from profile',
                      'Compete on the leaderboard',
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                          <FontAwesomeIcon icon={faCheck} className="text-[10px] text-blue-600" />
                        </div>
                        <span className="text-sm text-gray-600 font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>


      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how-it-works" className="py-24 md:py-32 px-6 bg-gray-50/70 border-y border-gray-100">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">Simple flow</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">How TaskPay works</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">From social engagement to custom dapp actions — create, verify, and pay out in G$ or USDC.</p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {steps.map((step, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <motion.div
                  onMouseEnter={() => setActiveStep(i)}
                  className={`relative rounded-3xl border p-7 transition-all duration-500 cursor-default ${activeStep === i
                    ? `border-black bg-white shadow-2xl shadow-black/[0.06] ${motionOff ? '' : 'scale-[1.02]'}`
                    : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  {/* Step number */}
                  <span className="text-xs font-black text-gray-300 uppercase tracking-widest mb-4 block">{step.num}</span>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 shadow-lg`}>
                    <FontAwesomeIcon icon={step.icon} className="text-white text-lg" />
                  </div>

                  <h3 className="text-lg font-black mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>

                  {/* Active indicator */}
                  <AnimatePresence>
                    {activeStep === i && (
                      <motion.div
                        initial={motionOff ? { scaleX: 1 } : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={motionOff ? { scaleX: 1 } : { scaleX: 0 }}
                        transition={{ duration: motionOff ? 0 : 0.4 }}
                        className="absolute bottom-0 left-6 right-6 h-1 bg-black rounded-full"
                        style={{ originX: 0 }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════ CUSTOM ON-CHAIN QUESTS ═══════════ */}
      <section id="custom-quests" className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">For dapp builders</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Custom on-chain quests</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
              Reward users for any verified smart-contract action in your app. Submit your action, get approved,
              fund the pool, and launch — TaskPay handles verification automatically.
            </p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
            {customQuestFlow.map((step, i) => (
              <FadeUp key={step.step} delay={i * 0.08}>
                <div className="relative rounded-3xl border border-gray-200 bg-white p-6 h-full hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/[0.06] transition-all duration-300">
                  <span className="text-[10px] font-black text-violet-400 uppercase tracking-widest mb-3 block">{step.step}</span>
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-4 shadow-md`}>
                    <FontAwesomeIcon icon={step.icon} className="text-white text-base" />
                  </div>
                  <h3 className="text-base font-black mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>

          <FadeUp delay={0.15}>
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-xl shadow-black/[0.03]">
              <div className="px-6 py-5 sm:px-8 border-b border-gray-100 bg-gray-50/80">
                <h3 className="text-lg font-black">Social vs custom on-chain</h3>
                <p className="text-sm text-gray-500 mt-1">Two verification paths — same G$ & USDC rewards, different proof models.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left">
                      <th className="px-6 py-4 font-bold text-gray-400 text-xs uppercase tracking-wider">Step</th>
                      <th className="px-6 py-4 font-bold text-gray-700">Social quest</th>
                      <th className="px-6 py-4 font-bold text-violet-700">Custom on-chain</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      ['Open', 'Follow / boost / open mini app', 'Open task in TaskPay + open your dapp URL'],
                      ['Verify', 'Neynar/X API checks + on-chain verifyTask()', 'Auto-scan wallet after Open timestamp'],
                      ['Gas for verify', 'Earner pays one verify tx', 'None — server-side scan only'],
                      ['Admin script', 'Required for final approval', 'Not needed — instant success'],
                      ['Claim', 'TaskPay escrow', 'CustomTaskPay escrow'],
                    ].map(([step, social, custom]) => (
                      <tr key={step} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-bold text-gray-900 whitespace-nowrap">{step}</td>
                        <td className="px-6 py-4 text-gray-600">{social}</td>
                        <td className="px-6 py-4 text-gray-700 font-medium">{custom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={0.2} className="text-center mt-12">
            <motion.button
              whileHover={motionOff ? undefined : { scale: 1.03 }}
              whileTap={motionOff ? undefined : { scale: 0.97 }}
              onClick={launchDapp}
              className={`inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-violet-600 text-white text-base font-bold hover:bg-violet-700 transition-colors shadow-lg shadow-violet-500/20 ${focusRing}`}
            >
              Launch a custom quest
              <FontAwesomeIcon icon={faArrowRight} className="text-sm opacity-80" />
            </motion.button>
          </FadeUp>
        </div>
      </section>


      {/* ═══════════ QUEST TYPES ═══════════ */}
      <section id="quest-types" className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">10 powerful quest types</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Quests for every goal</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Social growth on Farcaster & X, plus custom on-chain actions for your dapp.</p>
          </FadeUp>

          {/* Platform toggle — equal-width segmented control (desktop + mobile) */}
          <FadeUp delay={0.1} className="flex justify-center mb-12 px-1">
            <div
              role="tablist"
              aria-label="Quest platform"
              className="flex w-full max-w-[min(100%,32rem)] md:max-w-2xl mx-auto rounded-[1.25rem] border border-gray-200/50 bg-gray-100/60 p-1.5 gap-1 shadow-inner backdrop-blur-md relative"
            >
              {(['farcaster', 'x', 'onchain'] as const).map((tab) => {
                const isSelected = questPlatform === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => setQuestPlatform(tab)}
                    className={`relative flex flex-1 min-w-0 items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 rounded-[1rem] text-xs sm:text-sm font-bold transition-colors z-10 focus:outline-none ${isSelected ? 'text-black' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    {isSelected && (
                      <motion.div
                        layoutId="websitePlatformTab"
                        className="absolute inset-0 bg-white rounded-[1rem] shadow-[0_4px_12px_rgba(0,0,0,0.08)] border border-black/5 z-[-1]"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    {tab === 'farcaster' ? (
                      <>
                        <FarcasterLogo size={16} className="shrink-0" />
                        <span className="truncate hidden sm:inline">Farcaster</span>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums bg-gray-200/90 text-gray-600 px-1.5 py-0.5 rounded-md">6</span>
                      </>
                    ) : tab === 'x' ? (
                      <>
                        <XLogo size={14} className="shrink-0" />
                        <span className="truncate">
                          <span className="sm:hidden">X</span>
                          <span className="hidden sm:inline">X (Twitter)</span>
                        </span>
                        <span className={`shrink-0 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-black/5' : 'bg-gray-200/90'} text-gray-600`}>3</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faLink} className="text-violet-600 shrink-0 text-sm" />
                        <span className="truncate">On-chain</span>
                        <span className="shrink-0 text-[10px] font-bold tabular-nums bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-md">1</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </FadeUp>

          <AnimatePresence mode="wait">
            <motion.div
              key={questPlatform}
              initial={motionOff ? { opacity: 0 } : { opacity: 0, scale: 0.95, filter: 'blur(8px)', y: 10 }}
              animate={motionOff ? { opacity: 1 } : { opacity: 1, scale: 1, filter: 'blur(0px)', y: 0 }}
              exit={motionOff ? { opacity: 0 } : { opacity: 0, scale: 0.95, filter: 'blur(8px)', y: -10 }}
              transition={{ duration: motionOff ? 0.15 : 0.4, ease: [0.22, 1, 0.36, 1] }}
              className={`grid sm:grid-cols-2 ${questPlatform === 'onchain' ? 'lg:grid-cols-1 max-w-md mx-auto' : 'lg:grid-cols-3'} gap-5`}
            >
              {activeQuests.map((q, i) => {
                const c = colorMap[q.color]
                const isX = q.color === 'slate'
                const isOnChain = q.color === 'violet'
                return (
                  <motion.div
                    key={i}
                    initial={motionOff ? { opacity: 0 } : { opacity: 0, y: 20 }}
                    animate={motionOff ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ delay: motionOff ? 0 : i * 0.06 }}
                    whileHover={motionOff ? undefined : { y: -4, transition: { duration: 0.25 } }}
                    className={`group relative rounded-3xl border ${c.border} ${c.bg} p-7 transition-all duration-300 hover:shadow-lg hover:shadow-black/[0.03]`}
                  >
                    <div className={`w-12 h-12 rounded-2xl ${c.iconBg} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                      {isX ? (
                        <XLogo size={18} className="text-white" />
                      ) : isOnChain ? (
                        <FontAwesomeIcon icon={q.icon} className="text-white text-lg" />
                      ) : (
                        <FontAwesomeIcon icon={q.icon} className={`${c.text} text-lg`} />
                      )}
                    </div>
                    <h3 className="text-lg font-black text-black mb-2">{q.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{q.desc}</p>
                    {isX && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/5 border border-black/5">
                        <XLogo size={10} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">X Platform</span>
                      </div>
                    )}
                    {isOnChain && (
                      <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-100 border border-violet-200">
                        <FontAwesomeIcon icon={faLink} className="text-[10px] text-violet-600" />
                        <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Auto-verify</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>


      {/* ═══════════ FEATURES GRID ═══════════ */}
      <section className="py-24 md:py-32 px-6 bg-black text-white">
        <div className="max-w-6xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-4 block">Why TaskPay</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Built different</h2>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">Unmatched features for creators and users across Farcaster & X.</p>
          </FadeUp>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: faCoins, title: '0% Platform Fee', desc: '100% of your budget goes into the reward pool. No hidden cuts, no surprises.', accent: 'from-amber-500/20 to-amber-600/5' },
              { icon: faLink, title: 'Custom On-Chain Quests', desc: 'Define contract, function, and event — TaskPay auto-scans wallets after Open. Instant verify, no admin script.', accent: 'from-violet-500/20 to-violet-600/5' },
              { icon: faBullseye, title: 'Anti-Bot Targeting', desc: 'Filter by Neynar score, account age, X followers, and Pro status. Only real users qualify.', accent: 'from-blue-500/20 to-blue-600/5' },
              { icon: faShieldHalved, title: 'Dual Escrow Contracts', desc: 'TaskPay for social quests, CustomTaskPay for on-chain actions. Funds locked until verified claim.', accent: 'from-emerald-500/20 to-emerald-600/5' },
              { icon: faClock, title: 'Instant Notifications', desc: 'Every new quest triggers push notifications to all users via the Farcaster protocol.', accent: 'from-purple-500/20 to-purple-600/5' },
              { icon: faArrowRight, title: 'Budget Reclaimable', desc: 'Unused budget? Reclaim it anytime after expiry. Your G$ and USDC are always safe.', accent: 'from-rose-500/20 to-rose-600/5' },
            ].map((f, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div className={`group relative rounded-3xl border border-white/10 bg-gradient-to-br ${f.accent} p-7 hover:border-white/20 transition-all duration-300`}>
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-5 group-hover:bg-white/15 transition-colors duration-300">
                    <FontAwesomeIcon icon={f.icon} className="text-white text-lg" />
                  </div>
                  <h3 className="text-lg font-black mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>


      {/* ═══════════ PRICING / REWARD MODEL ═══════════ */}
      <section id="pricing" className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">Transparent model</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Fair rewards. Zero fees.</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">The entire budget goes to the participants. We don&apos;t take a cut.</p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden shadow-xl shadow-black/[0.03]">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-900 to-black p-8 md:p-10 text-white">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
                    <FontAwesomeIcon icon={faGift} className="text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Dynamic Reward Pool</h3>
                    <p className="text-sm text-gray-400">Shared equally among all verified participants</p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="p-8 md:p-10 space-y-6">
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="text-3xl font-black text-black mb-1">$1</div>
                    <p className="text-xs text-gray-500 font-medium">Minimum budget</p>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="text-3xl font-black text-black mb-1">0%</div>
                    <p className="text-xs text-gray-500 font-medium">Platform commission</p>
                  </div>
                  <div className="text-center p-6 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="text-3xl font-black text-black mb-1">100%</div>
                    <p className="text-xs text-gray-500 font-medium">Goes to participants</p>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <FontAwesomeIcon icon={faStar} className="text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-amber-900 mb-1">Early bird advantage</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Rewards are split equally — the fewer participants, the bigger each share. Complete quests early for maximum earnings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>


      {/* ═══════════ SECURITY ═══════════ */}
      <section className="py-24 md:py-32 px-6 bg-gray-50/70 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <FadeUp className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-4 block">Trust & Security</span>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Fully trustless. Fully on-chain.</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">No central middlemen. Every action is verified and recorded on the blockchain.</p>
          </FadeUp>

          <FadeUp delay={0.1}>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="rounded-3xl bg-white border border-gray-200 p-7 text-center hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-300">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center mx-auto mb-5">
                  <FontAwesomeIcon icon={faLock} className="text-emerald-600 text-2xl" />
                </div>
                <h3 className="text-lg font-black mb-2">Smart Contracts</h3>
                <p className="text-sm text-gray-500 leading-relaxed">GoodTaskPay, TaskPay, and CustomTaskPay escrows lock G$ and USDC on Celo and Arbitrum. Funds release only on verified, signed claims.</p>
              </div>
              <div className="rounded-3xl bg-white border border-gray-200 p-7 text-center hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-300">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mx-auto mb-5">
                  <FontAwesomeIcon icon={faCircleCheck} className="text-blue-600 text-2xl" />
                </div>
                <h3 className="text-lg font-black mb-2">Dual Verification</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Social quests: Neynar/X API + on-chain verify. Custom quests: wallet auto-scan for contract, function & event after Open.</p>
              </div>
              <div className="rounded-3xl bg-white border border-gray-200 p-7 text-center hover:shadow-lg hover:shadow-black/[0.03] transition-all duration-300">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center mx-auto mb-5">
                  <FontAwesomeIcon icon={faBullseye} className="text-purple-600 text-2xl" />
                </div>
                <h3 className="text-lg font-black mb-2">Wallet Auto-Scan</h3>
                <p className="text-sm text-gray-500 leading-relaxed">Custom quests verify by scanning the wallet for matching contract, function, and event — no manual tx hash required.</p>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>


      {/* ═══════════ FINAL CTA ═══════════ */}
      <section className="py-28 md:py-36 px-6 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
        <FloatingOrb className="bg-purple-300 -left-20 top-10" size={300} delay={1} />
        <FloatingOrb className="bg-blue-300 -right-20 bottom-10" size={280} delay={3} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <FadeUp>

            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
              Ready to earn or launch?
            </h2>
            <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              Browse social quests, complete custom on-chain tasks, or fund your own dapp action rewards — in G$ on Celo or USDC on Arbitrum.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <motion.button
                whileHover={motionOff ? undefined : { scale: 1.04, boxShadow: '0 24px 48px rgba(0,0,0,0.18)' }}
                whileTap={motionOff ? undefined : { scale: 0.97 }}
                onClick={launchDapp}
                className={`group inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-black text-white text-lg font-bold shadow-2xl shadow-black/15 transition-all ${focusRing}`}
              >
                Launch App
                <FontAwesomeIcon icon={faArrowRight} className="text-base opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </motion.button>
              <motion.button
                whileHover={motionOff ? undefined : { scale: 1.04 }}
                whileTap={motionOff ? undefined : { scale: 0.97 }}
                onClick={openApp}
                className={`group inline-flex items-center gap-3 px-10 py-5 rounded-2xl border-2 border-gray-200 text-lg font-bold text-gray-700 hover:border-gray-400 transition-all ${focusRing}`}
              >
                Open in Farcaster
                <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-base opacity-60 group-hover:opacity-100 transition-all" />
              </motion.button>
            </div>
            <p className="text-xs text-gray-400 mt-6 font-medium">Social quests · Custom on-chain · Non-custodial G$ & USDC</p>
          </FadeUp>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="border-t border-gray-200/80 bg-gray-50/50 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-8 md:flex-row md:items-center md:justify-between">

          <div className="flex w-full max-w-md flex-col gap-2.5 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center md:w-auto md:justify-end">
            <a
              href="https://x.com/TryTaskPay"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 sm:flex-initial ${focusRing}`}
            >
              <XLogo size={18} className="text-gray-900" />
              <span>@TryTaskPay</span>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px] text-gray-400 opacity-70" />
            </a>
            <a
              href="https://farcaster.xyz/taskpay"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 sm:flex-initial ${focusRing}`}
            >
              <FarcasterLogo size={20} />
              <span>Farcaster</span>
              <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="text-[10px] text-gray-400 opacity-70" />
            </a>
          </div>

        </div>
      </footer>
    </div>
  )
}
