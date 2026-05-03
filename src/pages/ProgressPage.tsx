/**
 * ProgressPage — Phase 0d.1 placeholder.
 *
 * Period filters + accuracy charts need session event log.
 */

import { LineChart } from 'lucide-react';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';

export function ProgressPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Progress"
        subtitle="Period-filtered analytics arrive once session tracking lands."
      />
      <StateMessage
        icon={LineChart}
        title="Coming soon"
        body="Accuracy over time, drills per week, lines mastered per period — all derived from your local drill history."
      />
    </div>
  );
}
