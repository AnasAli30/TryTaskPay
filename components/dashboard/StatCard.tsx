'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: IconDefinition;
  accent?: 'violet' | 'blue' | 'amber' | 'emerald';
  loading?: boolean;
}

const accents = {
  violet: 'from-violet-100 to-purple-100 text-violet-700',
  blue: 'from-blue-100 to-indigo-100 text-blue-700',
  amber: 'from-amber-100 to-orange-100 text-amber-700',
  emerald: 'from-emerald-100 to-green-100 text-emerald-700',
};

export function StatCard({ label, value, icon, accent = 'violet', loading }: StatCardProps) {
  return (
    <div className="relative rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center mb-4`}>
        <FontAwesomeIcon icon={icon} className="text-lg" />
      </div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
      ) : (
        <p className="text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
      )}
    </div>
  );
}
