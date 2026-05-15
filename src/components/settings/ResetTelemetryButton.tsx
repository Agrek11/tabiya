/**
 * ResetTelemetryButton — local-only telemetry wipe.
 *
 * Confirms with an inline two-button affordance (matching the existing SRS
 * reset UX), then calls `getEventsRepository().clearAll()`. The bus publish
 * inside `clearAll` triggers dashboards to recompute to empty state without
 * a page reload.
 *
 * Article 11 — fully local; no network call. Separated from SRS reset so
 * the two affordances cannot be confused.
 */

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Card } from '../../ui/primitives/Card';
import { Button } from '../../ui/primitives/Button';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { getEventsRepository } from '../../storage';

export function ResetTelemetryButton() {
  const t = useTokens();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onReset = async (): Promise<void> => {
    await getEventsRepository().clearAll();
    setConfirm(false);
    setMessage('Telemetry cleared. SRS progress preserved.');
  };

  return (
    <Card>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          color: t.inkDim,
        }}
      >
        <Trash2 size={15} />
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: fonts.sans }}>
          Reset telemetry
        </div>
      </div>
      <div style={{ fontSize: 13, color: t.inkDim, fontFamily: fonts.sans, marginBottom: 14 }}>
        Clears the session events log used by streaks, accuracy, and the
        heatmap. Your SRS progress is not affected.
      </div>
      {!confirm ? (
        <Button variant="secondary" onClick={() => setConfirm(true)}>
          Reset telemetry
        </Button>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: t.ink, fontFamily: fonts.sans }}>
            Reset telemetry will delete all session events. SRS progress is not
            affected. Continue?
          </span>
          <Button variant="primary" onClick={() => void onReset()}>
            Yes, reset
          </Button>
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      )}
      {message !== null && (
        <div
          style={{
            fontSize: 12,
            color: t.inkDim,
            fontFamily: fonts.sans,
            marginTop: 10,
          }}
        >
          {message}
        </div>
      )}
    </Card>
  );
}
