import { Suspense } from 'react';
import { QuestsPage } from '@/components/dashboard/pages/QuestsPage';

export default function QuestsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-sm text-gray-400">Loading quests…</div>
      }
    >
      <QuestsPage />
    </Suspense>
  );
}
