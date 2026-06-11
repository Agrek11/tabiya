import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { BoardThemeProvider } from './theme/BoardThemeContext';
import { PieceSetProvider } from './theme/PieceSetContext';
import { AppShell } from './ui/shell/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { RepertoirePage } from './pages/RepertoirePage';
import { GambitsPage } from './pages/GambitsPage';
import { DrillPage } from './pages/DrillPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { LichessCallbackPage } from './pages/LichessCallbackPage';
import { OOBPositionViewerPage } from './pages/OOBPositionViewerPage';
import { unlockAudio } from './sound/sounds';

// Phase 2 placeholder stubs — Batch 3 will replace with real page modules
// at src/pages/{Insights,Games,Coach}Page.tsx. Wiring the routes here keeps
// the TopBar nav functional and gives Batch 3 a clear drop-in target.
const InsightsPage = () => <div style={{ padding: 32 }}>Insights placeholder — Batch 3 rebuild pending</div>;
const GamesPage = () => <div style={{ padding: 32 }}>Games placeholder — Batch 3 rebuild pending</div>;
const CoachPage = () => <div style={{ padding: 32 }}>Coach placeholder — Batch 3 rebuild pending</div>;

function App() {
  useEffect(() => {
    const unlock = (): void => unlockAudio();
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('keydown', unlock, { capture: true });
    };
  }, []);

  return (
    <ThemeProvider>
      <BoardThemeProvider>
        <PieceSetProvider>
          <BrowserRouter>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/repertoire" element={<RepertoirePage />} />
                <Route path="/repertoire/gambits" element={<GambitsPage />} />
                <Route path="/drill" element={<DrillPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/games" element={<GamesPage />} />
                <Route path="/coach" element={<CoachPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/lichess/callback" element={<LichessCallbackPage />} />
                <Route path="/lichess/oob/:gameId/:plyIndex" element={<OOBPositionViewerPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </BrowserRouter>
        </PieceSetProvider>
      </BoardThemeProvider>
    </ThemeProvider>
  );
}

export default App;
