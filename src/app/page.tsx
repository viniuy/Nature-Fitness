import { Suspense } from 'react';
import { Logger } from '@/components/Logger';

export default function TodayPage() {
  return (
    <div className="narrow-wrap">
      <Suspense fallback={<p className="empty">Loading…</p>}>
        <Logger />
      </Suspense>
    </div>
  );
}
