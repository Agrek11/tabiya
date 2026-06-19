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
import { SettingsPage } from './pages/SettingsPage';
import { LichessCallbackPage } from './pages/LichessCallbackPage';
import { OOBPositionViewerPage } from './pages/OOBPositionViewerPage';
import { InsightsPage } from './pages/InsightsPage';
import { GamesPage } from './pages/GamesPage';
import { CoachPage } from './pages/CoachPage';
import { unlockAudio } from './sound/sounds';

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
                {/* Orphaned placeholder route — analytics live on /insights. */}
                <Route path="/progress" element={<Navigate to="/insights" replace />} />
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
