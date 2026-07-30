import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { BoardThemeProvider } from './theme/BoardThemeContext';
import { PieceSetProvider } from './theme/PieceSetContext';
import { AppShell } from './ui/shell/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { RepertoirePage } from './pages/RepertoirePage';
import { GambitsPage } from './pages/GambitsPage';
import { DrillPage } from './pages/DrillPage';
import { PlayPage } from './pages/PlayPage';
import { SettingsPage } from './pages/SettingsPage';
import { LichessCallbackPage } from './pages/LichessCallbackPage';
import { OOBPositionViewerPage } from './pages/OOBPositionViewerPage';
import { GamesPage } from './pages/GamesPage';
import { CoachPage } from './pages/CoachPage';
import { ReviewPage } from './pages/ReviewPage';
import { OpponentScoutPage } from './pages/OpponentScoutPage';
import { StructureTrainingPage } from './pages/StructureTrainingPage';
import { FeatureSearchPage } from './pages/FeatureSearchPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { unlockAudio } from './sound/sounds';
const InsightsPage = lazy(() => import('./pages/InsightsPage').then(({ InsightsPage: Page }) => ({ default: Page })));
const ProgressPage = lazy(() => import('./pages/ProgressPage').then(({ ProgressPage: Page }) => ({ default: Page })));


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
              <Suspense fallback={null}>
                <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/repertoire" element={<RepertoirePage />} />
                <Route path="/repertoire/gambits" element={<GambitsPage />} />
                <Route path="/drill" element={<DrillPage />} />
                <Route path="/play" element={<PlayPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/insights" element={<InsightsPage />} />
                <Route path="/games" element={<GamesPage />} />
                <Route path="/scout" element={<OpponentScoutPage />} />
                <Route path="/training/structures" element={<StructureTrainingPage />} />
                <Route path="/search/features" element={<FeatureSearchPage />} />
                <Route path="/review/:gameId" element={<ReviewPage />} />
                <Route path="/coach" element={<CoachPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/lichess/callback" element={<LichessCallbackPage />} />
                <Route path="/lichess/oob/:gameId/:plyIndex" element={<OOBPositionViewerPage />} />
                <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </AppShell>
          </BrowserRouter>
        </PieceSetProvider>
      </BoardThemeProvider>
    </ThemeProvider>
  );
}

export default App;
