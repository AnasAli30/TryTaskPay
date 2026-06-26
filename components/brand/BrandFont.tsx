import { Plus_Jakarta_Sans } from 'next/font/google';

export const brandFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: true,
});

export function BrandFont({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${brandFont.className} ${className}`}>{children}</div>;
}
