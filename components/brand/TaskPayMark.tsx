'use client';

import Image from 'next/image';

export function TaskPayMark({
  size = 'md',
  className = '',
  priority = false,
}: {
  size?: 'sm' | 'md' | 'md2' | 'lg';
  className?: string;
  priority?: boolean;
}) {
  const cfg = {
    sm: { wrap: 'w-7 h-7 rounded-lg', sizes: '28px' },
    md: { wrap: 'w-9 h-9 rounded-xl', sizes: '36px' },
    md2: { wrap: 'w-12 h-12 rounded-xl', sizes: '48px' },
    lg: { wrap: 'w-20 h-20 rounded-3xl shadow-2xl shadow-black/20', sizes: '80px' },
  }[size];

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-white ring-1 ring-gray-200/80 ${cfg.wrap} ${className}`}
    >
      <Image
        src="/images/icon.png"
        alt="TaskPay"
        fill
        sizes={cfg.sizes}
        className="object-contain p-[12%]"
        priority={priority}
      />
    </div>
  );
}
