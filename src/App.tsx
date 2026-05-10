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
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/settings" element={<SettingsPage />} />
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
