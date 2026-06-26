import { BrowserApp } from '@/components/browser/BrowserApp';
import { brandFont } from '@/components/brand/BrandFont';

export const dynamic = 'force-dynamic';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={brandFont.className}>
      <BrowserApp>{children}</BrowserApp>
    </div>
  );
}
