import App from '@/components/pages/app'
import { APP_URL } from '@/lib/constants'
import type { Metadata } from 'next'

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined }
}


export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const imageUrl = searchParams.imageUrl as string || `${APP_URL}/images/feed.png`
  const frame = {
    version: 'next',
    imageUrl,
    button: {
      title: 'Get paid💰',
      action: {
        type: 'launch_frame',
        name: 'TaskPay',
        url: APP_URL,
        splashImageUrl: `${APP_URL}/images/splash.png`,
        splashBackgroundColor: '#FFFFFF',
      },
    },
  }
  return {
    title: 'TaskPay',
    description: 'Complete Farcaster quests and earn G$ & USDC rewards with TaskPay.',
    openGraph: {
      title: 'TaskPay',
      description: 'Complete Farcaster quests and earn G$ & USDC rewards with TaskPay.',
      images: [{ url: imageUrl }],
    },
    other: {
      'fc:frame': JSON.stringify(frame),
      'base:app_id': '69a5da42a0fdf68983d307a1',
      'talentapp:project_verification':
        '6b923d12ee9d23c4fc78f8cc3865b01992a3ec309b0bccd8dd957b3b8c6f1df984f35aeaba1686e8f0b2e93df917a35f4d211fb4183a4f6c2e4acff1038eb262',
    },
  }
}

export default function Home() {
  return <App />
}
