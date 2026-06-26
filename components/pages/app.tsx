'use client'

import { Demo } from '@/components/Home'
import { useFrame } from '@/components/farcaster-provider'
import { SafeAreaContainer } from '@/components/safe-area-container'
import { motion } from 'framer-motion'
import Website from '@/components/pages/Website'
import { LoadingFloatingBg } from '@/components/loading-floating-bg'

export default function Home() {
  const { context, isLoading, isSDKLoaded } = useFrame()
  const { actions } = useFrame()

  if (isLoading) {
    return (
      <SafeAreaContainer insets={context?.client.safeAreaInsets}>
        <div className="relative w-full min-h-screen bg-white overflow-hidden">
          <LoadingFloatingBg />
          {/* Top accent — matches intro overlay */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-400 z-10" />
          <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-8">
            <div className="w-full max-w-[280px]">
              <div className="relative h-1 rounded-full bg-gray-100 overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: [0, 1, 0] }}
                  transition={{
                    duration: 2.4,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </SafeAreaContainer>
    )
  }

  if (!isSDKLoaded) {
    return <Website />
  }

  return (
    <SafeAreaContainer insets={context?.client.safeAreaInsets}>
      <Demo />
    </SafeAreaContainer>
  )
}
