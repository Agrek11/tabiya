/**
 * DashboardPage — Phase 0d.1 placeholder.
 *
 * The full v1 layout (4 stat cards, suggested-for-you, heatmap, recent
 * activity feed) needs SRS state + session event log to populate.
 * Until those data sources land, render a single styled "Coming soon"
 * empty state matching the destination layout shape.
 */

import { LineChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';
import { Button } from '../ui/primitives/Button';

export function DashboardPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Stats and review queue activate after your first drill sessions."
      />
      <StateMessage
        icon={LineChart}
        title="Coming soon"
        body="Lines mastered, accuracy trends, practice rhythm, and your suggested next drill all appear here once the SRS scheduler ships."
        action={
          <Link to="/drill" style={{ textDecoration: 'none' }}>
            <Button variant="primary">Start drilling →</Button>
          </Link>
        }
      />
    </div>
  );
}
