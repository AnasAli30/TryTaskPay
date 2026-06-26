'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faHashtag, faHeart, faLayerGroup, faLink, faQuoteRight, faRocket, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import type { QuestFilter, PlatformFilter } from '@/components/hooks/useQuestFeed';

const STATUS_TABS: { id: QuestFilter; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
];

interface QuestFiltersProps {
  filter: QuestFilter;
  onFilterChange: (f: QuestFilter) => void;
  platform: PlatformFilter;
  onPlatformChange: (p: PlatformFilter) => void;
  count?: number;
  countLabel?: string;
}

export function QuestFilters({
  filter,
  onFilterChange,
  platform,
  onPlatformChange,
  count,
  countLabel,
}: QuestFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onFilterChange(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              filter === tab.id ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          {(['all', 'farcaster', 'x'] as PlatformFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPlatformChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                platform === p ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
              }`}
            >
              {p === 'all' ? 'All' : p === 'farcaster' ? 'Farcaster' : 'X'}
            </button>
          ))}
        </div>
        {count != null && (
          <span className="text-sm text-gray-400 font-medium">
            {countLabel ?? `${count.toLocaleString()} quests`}
          </span>
        )}
      </div>
    </div>
  );
}

export function questTypeIcon(type?: string) {
  switch (type) {
    case 'follow':
    case 'x_follow':
      return faUserPlus;
    case 'boost_lite':
    case 'x_boost_lite':
      return faHeart;
    case 'boost':
    case 'x_boost':
      return faBolt;
    case 'quote':
      return faQuoteRight;
    case 'channel':
      return faHashtag;
    case 'miniapp':
    case 'multi':
    case 'x_bundle':
      return faLayerGroup;
    case 'custom_onchain':
      return faLink;
    default:
      return faRocket;
  }
}

export function QuestTypeIcon({ type, className }: { type?: string; className?: string }) {
  return <FontAwesomeIcon icon={questTypeIcon(type)} className={className} />;
}
