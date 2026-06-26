'use client'

import { motion } from 'framer-motion'

/** Same vibe as IntroOverlay — soft floating orbs (pointer-events none). */
const ORBS = [
  { w: 100, h: 100, l: 8, t: 18, d: 9, del: 0, c: 0 },
  { w: 140, h: 140, l: 72, t: 8, d: 11, del: 0.4, c: 1 },
  { w: 80, h: 80, l: 88, t: 72, d: 8, del: 1.1, c: 2 },
  { w: 120, h: 120, l: 20, t: 78, d: 10, del: 0.8, c: 3 },
  { w: 60, h: 60, l: 48, t: 42, d: 7, del: 1.5, c: 0 },
  { w: 90, h: 90, l: 5, t: 55, d: 8.5, del: 0.2, c: 1 },
]

const COLORS = [
  'rgba(124,58,237,0.06)',
  'rgba(59,130,246,0.06)',
  'rgba(16,185,129,0.05)',
  'rgba(245,158,11,0.04)',
]

export function LoadingFloatingBg() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ORBS.map((o, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[2px]"
          style={{
            width: o.w,
            height: o.h,
            background: COLORS[o.c % COLORS.length],
            left: `${o.l}%`,
            top: `${o.t}%`,
          }}
          animate={{
            y: [0, -18, 0],
            x: [0, 10, 0],
            scale: [1, 1.06, 1],
          }}
          transition={{
            duration: o.d,
            repeat: Infinity,
            delay: o.del,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
