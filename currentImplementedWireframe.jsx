/**
 * currentImplementedWireframe.jsx
 *
 * Snapshot of what is ACTUALLY shipped in src/ as of 2026-05-05 (Tue).
 * Mirrors `wireframe.jsx` style (single-file JSX, inline styles, mock data) so
 * the team can visually compare design intent (wireframe.jsx) against
 * production reality (this file).
 *
 * Source of truth = src/. This file is regenerated when src/ changes.
 *
 * Implemented:
 *   - AppShell + Sidebar (collapsible 240↔64) + TopBar (no title on /drill)
 *   - DrillMode v1.2 — single col 840 max, opening + line dual searchable
 *     dropdowns, mode dropdown, 10px progress bar, big board with click-to-move
 *     + drag, inline coach line, action chips (Restart / Skip / Hint),
 *     collapsible grid move history
 *   - Settings page (board theme picker, piece set picker, sound)
 *   - User name "Arushi" centralized in src/config/user.ts
 *
 * Stubbed (placeholder UI in src/, not in this snapshot):
 *   - Dashboard analytics (Coming soon empty state)
 *   - Repertoire grid (real data, ghost mastery bars)
 *   - Progress page (Coming soon empty state)
 *
 * Not yet in src/ (lives only in wireframe.jsx):
 *   - Profile / avatar dropdown in sidebar bottom
 *   - Streak counter widget
 *   - Games page
 *   - Dashboard mock data
 *   - Progress period filters + charts
 */

import { useState, createContext, useContext, useEffect, useRef } from "react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Inbox,
  LayoutDashboard,
  LineChart,
  Library,
  Lightbulb,
  Moon,
  RotateCcw,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Sun,
  Swords,
  X,
} from "lucide-react";

// ============================================================
// THEME (mirror src/theme/tokens.ts — light only for brevity)
// ============================================================
const theme = {
  bg: "#FAF8F2",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F1E8",
  border: "#E9E4D6",
  borderStrong: "#D6CFB9",
  ink: "#1C1917",
  inkDim: "#78716C",
  inkSoft: "#A8A29E",
  brand: "#047857",
  brandSoft: "#D1FAE5",
  amber: "#D97706",
  red: "#DC2626",
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
};
const sans =
  '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const mono = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

const T = createContext(theme);
const useT = () => useContext(T);

// User config (src/config/user.ts)
const USER_NAME = "Arushi";

// Mock catalog (mirrors current public/catalog.json shape; only enough to drive
// the snapshot UI)
const MOCK_OPENINGS = [
  { id: "italian-game", name: "Italian Game", eco: "C50-C54", color: "white" },
  { id: "ruy-lopez", name: "Ruy Lopez", eco: "C60-C99", color: "white" },
  { id: "sicilian", name: "Sicilian Defense", eco: "B20-B99", color: "black" },
  { id: "caro-kann", name: "Caro-Kann", eco: "B10-B19", color: "black" },
];
const MOCK_LINES = [
  { id: "italian-main", opening_id: "italian-game", name: "Main Line", depth: 12 },
  { id: "italian-evans", opening_id: "italian-game", name: "Evans Gambit", depth: 14 },
  { id: "italian-fried-liver", opening_id: "italian-game", name: "Fried Liver Attack", depth: 10 },
  { id: "ruy-main", opening_id: "ruy-lopez", name: "Closed Main Line", depth: 20 },
  { id: "sicilian-najdorf", opening_id: "sicilian", name: "Najdorf", depth: 18 },
  { id: "caro-classical", opening_id: "caro-kann", name: "Classical", depth: 16 },
];

// Click outside helper (mirror src/ui/use-click-outside.ts)
function useClickOutside(active, close) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [active, close]);
  return ref;
}

// ============================================================
// SIDEBAR (src/ui/shell/Sidebar.tsx)
// ============================================================
function Sidebar({ active, setActive, collapsed, onToggleCollapsed }) {
  const t = useT();
  // Drill intentionally omitted — entered only by clicking an opening in Repertoire.
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "repertoire", label: "Repertoire", icon: Library },
    { id: "progress", label: "Progress", icon: LineChart },
  ];
  const width = collapsed ? 64 : 240;

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: t.surface,
        borderRight: `1px solid ${t.border}`,
        padding: collapsed ? "20px 8px" : "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
        transition: "width 220ms ease, padding 220ms ease",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: collapsed ? 0 : "0 8px",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: t.brand,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 19,
              color: "#FFF",
              flexShrink: 0,
            }}
          >
            ♞
          </div>
          {!collapsed && (
            <div style={{ fontWeight: 700, fontSize: 17, color: t.ink, fontFamily: sans }}>
              tabiya
            </div>
          )}
        </div>
      </div>

      {/* Right-edge collapse toggle */}
      <button
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{
          position: "absolute",
          top: 26,
          right: -12,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: t.surface,
          border: `1px solid ${t.border}`,
          color: t.inkDim,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          zIndex: 10,
          boxShadow: t.shadow,
        }}
      >
        {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
      </button>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!collapsed && (
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.inkSoft,
              textTransform: "uppercase",
              letterSpacing: 0.6,
              padding: "0 10px",
              marginBottom: 6,
              fontFamily: sans,
            }}
          >
            Workspace
          </div>
        )}
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = active === it.id || (active === "drill" && it.id === "drill");
          return (
            <button
              key={it.id}
              onClick={() => setActive(it.id)}
              title={collapsed ? it.label : undefined}
              style={{
                background: isActive ? t.brandSoft : "transparent",
                color: isActive ? t.brand : t.ink,
                border: "none",
                borderRadius: 8,
                padding: collapsed ? 10 : "9px 10px",
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: sans,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
              {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => setActive("settings")}
        title={collapsed ? "Settings" : undefined}
        style={{
          background: "transparent",
          color: t.ink,
          border: "none",
          borderRadius: 8,
          padding: collapsed ? 10 : "9px 10px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          cursor: "pointer",
          fontFamily: sans,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <Settings size={17} />
        {!collapsed && <span style={{ flex: 1 }}>Settings</span>}
      </button>
    </aside>
  );
}

// ============================================================
// TOPBAR (src/ui/shell/TopBar.tsx)
// ============================================================
function TopBar({ title, breadcrumb, isDark, setIsDark }) {
  const t = useT();
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${t.border}`,
        background: t.surface,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, fontFamily: sans }}>
        {breadcrumb && (
          <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 1 }}>{breadcrumb}</div>
        )}
        {title && <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{title}</div>}
      </div>
      <button
        onClick={() => setIsDark(!isDark)}
        aria-label="Toggle theme"
        style={{
          width: 36,
          height: 36,
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: t.inkDim,
        }}
      >
        {isDark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}

// ============================================================
// DRILL MODE (src/pages/DrillPage.tsx) — v1.2
// ============================================================
function DrillMode() {
  const t = useT();
  const [openingId, setOpeningId] = useState("italian-game");
  const [lineId, setLineId] = useState("italian-main");
  const [openingMenuOpen, setOpeningMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [openingSearch, setOpeningSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [activeMode, setActiveMode] = useState("theory");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState(null);

  const openingMenuRef = useClickOutside(openingMenuOpen, () => {
    setOpeningMenuOpen(false);
    setOpeningSearch("");
  });
  const lineMenuRef = useClickOutside(lineMenuOpen, () => {
    setLineMenuOpen(false);
    setLineSearch("");
  });
  const modeMenuRef = useClickOutside(modeMenuOpen, () => setModeMenuOpen(false));

  const opening = MOCK_OPENINGS.find((o) => o.id === openingId);
  const linesForOpening = MOCK_LINES.filter((l) => l.opening_id === openingId);
  const line = linesForOpening.find((l) => l.id === lineId) ?? linesForOpening[0];

  const filteredOpenings = MOCK_OPENINGS.filter((o) => {
    const q = openingSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      o.name.toLowerCase().includes(q) ||
      o.eco.toLowerCase().includes(q) ||
      o.color.toLowerCase().includes(q)
    );
  });
  const filteredLines = linesForOpening.filter((l) => {
    const q = lineSearch.trim().toLowerCase();
    if (!q) return true;
    return l.name.toLowerCase().includes(q) || (opening?.eco ?? "").toLowerCase().includes(q);
  });

  const modes = [
    { id: "theory", label: "Theory", icon: BookOpen, available: true },
    { id: "coach", label: "AI Coach", icon: Sparkles, available: false },
    { id: "visualizer", label: "Visualizer", icon: Eye, available: false },
    { id: "engine", label: "Play it out", icon: Swords, available: false },
  ];
  const currentMode = modes.find((m) => m.id === activeMode);
  const ModeIcon = currentMode.icon;

  // Mock progress / history (real impl reads from useDrill state)
  const movesDone = 5;
  const movesTotal = line?.depth ?? 12;
  const progressPct = (movesDone / movesTotal) * 100;
  const moves = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "c3", "Nf6", "d4", "exd4", "cxd4", "Bb4+"];

  const ghostBtn = {
    background: "transparent",
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: "8px 16px",
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 500,
    color: t.ink,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div
      style={{
        maxWidth: 840,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {/* HEADER ROW */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              color: t.inkSoft,
              fontWeight: 500,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Repertoire
          </div>

          {/* Opening switcher (h1) */}
          <div ref={openingMenuRef} style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setOpeningMenuOpen((v) => !v)}
              aria-label="Switch opening"
              style={{
                background: openingMenuOpen ? t.surfaceAlt : "transparent",
                border: `1px solid ${openingMenuOpen ? t.border : "transparent"}`,
                padding: "4px 10px 4px 8px",
                marginLeft: -8,
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: sans,
                color: t.ink,
              }}
            >
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: t.ink }}>
                {opening?.name ?? "—"}
              </h1>
              <ChevronDown
                size={18}
                style={{
                  transition: "transform 150ms",
                  transform: openingMenuOpen ? "rotate(180deg)" : "rotate(0)",
                  color: t.inkDim,
                }}
              />
            </button>
            {openingMenuOpen && (
              <SearchableMenu
                placeholder={`Search ${MOCK_OPENINGS.length} openings…`}
                searchValue={openingSearch}
                onSearch={setOpeningSearch}
                items={filteredOpenings.map((o) => ({
                  key: o.id,
                  primary: o.name,
                  isCurrent: o.id === openingId,
                  onPick: () => {
                    setOpeningId(o.id);
                    const first = MOCK_LINES.find((l) => l.opening_id === o.id);
                    if (first) setLineId(first.id);
                    setOpeningMenuOpen(false);
                    setOpeningSearch("");
                  },
                }))}
                emptyHint={openingSearch.trim() ? `No openings match "${openingSearch}"` : "No openings yet."}
              />
            )}
          </div>

          {/* Line switcher (subtitle) */}
          <div ref={lineMenuRef} style={{ position: "relative", display: "inline-block", marginTop: 2 }}>
            <button
              onClick={() => setLineMenuOpen((v) => !v)}
              aria-label="Switch line"
              style={{
                background: lineMenuOpen ? t.surfaceAlt : "transparent",
                border: `1px solid ${lineMenuOpen ? t.border : "transparent"}`,
                padding: "3px 8px 3px 6px",
                marginLeft: -6,
                borderRadius: 999,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: sans,
                color: t.inkDim,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500 }}>{line?.name ?? "—"}</span>
              <ChevronDown
                size={13}
                style={{
                  transition: "transform 150ms",
                  transform: lineMenuOpen ? "rotate(180deg)" : "rotate(0)",
                  color: t.inkDim,
                }}
              />
            </button>
            {lineMenuOpen && (
              <SearchableMenu
                placeholder={`Search ${linesForOpening.length} lines…`}
                searchValue={lineSearch}
                onSearch={setLineSearch}
                items={filteredLines.map((l) => ({
                  key: l.id,
                  primary: l.name,
                  isCurrent: l.id === lineId,
                  onPick: () => {
                    setLineId(l.id);
                    setLineMenuOpen(false);
                    setLineSearch("");
                  },
                }))}
                emptyHint={lineSearch.trim() ? `No lines match "${lineSearch}"` : "No lines yet."}
              />
            )}
          </div>
        </div>

        {/* Mode dropdown */}
        <div ref={modeMenuRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setModeMenuOpen((v) => !v)}
            aria-label="Switch mode"
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: "8px 12px",
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 500,
              color: t.ink,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ModeIcon size={14} color={t.brand} strokeWidth={2.2} />
            {currentMode.label}
            <ChevronDown
              size={14}
              style={{
                transition: "transform 150ms",
                transform: modeMenuOpen ? "rotate(180deg)" : "rotate(0)",
                color: t.inkDim,
              }}
            />
          </button>
          {modeMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 240,
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                boxShadow: t.shadowMd,
                padding: 6,
                zIndex: 50,
              }}
            >
              {modes.map((m) => {
                const Icon = m.icon;
                const isActive = m.id === activeMode;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (m.available) {
                        setActiveMode(m.id);
                        setModeMenuOpen(false);
                      }
                    }}
                    disabled={!m.available}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      width: "100%",
                      background: isActive ? t.brandSoft : "transparent",
                      border: "none",
                      borderRadius: 8,
                      cursor: m.available ? "pointer" : "not-allowed",
                      textAlign: "left",
                      fontFamily: sans,
                      fontSize: 13.5,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? t.brand : m.available ? t.ink : t.inkSoft,
                      opacity: m.available ? 1 : 0.7,
                    }}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.4 : 2} />
                    <span style={{ flex: 1 }}>{m.label}</span>
                    {!m.available && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 600,
                          background: t.surfaceAlt,
                          color: t.inkSoft,
                          padding: "1px 6px",
                          borderRadius: 999,
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                        }}
                      >
                        Soon
                      </span>
                    )}
                    {isActive && <Check size={13} color={t.brand} strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* PROGRESS BAR — 10px tall */}
      <div>
        <div
          aria-label={`Drill progress ${Math.round(progressPct)}%`}
          style={{
            height: 10,
            background: t.surfaceAlt,
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: t.brand,
              borderRadius: 999,
              transition: "width 300ms ease-out",
            }}
          />
        </div>
      </div>

      {/* BOARD — full content width, no card. Click-to-move + drag-to-move.
          Selected piece glows brand-soft; legal destinations show as
          centered dots (empty squares) or rings (occupied / capture). */}
      <div style={{ width: "100%" }}>
        <BoardPlaceholder selectedSquare={selectedSquare} setSelectedSquare={setSelectedSquare} />
      </div>

      {/* COACH LINE */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "4px 12px" }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: t.brandSoft,
            color: t.brand,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: 15,
          }}
        >
          ♞
        </div>
        <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>
          {selectedSquare ? `Selected ${selectedSquare} — pick a destination` : "Make a move."}
        </div>
      </div>

      {/* ACTION CHIPS */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button style={ghostBtn}>
          <RotateCcw size={14} /> Restart
        </button>
        <button style={ghostBtn}>
          <SkipForward size={14} /> Skip
        </button>
        <button style={ghostBtn}>
          <Lightbulb size={14} /> Hint
        </button>
      </div>

      {/* COLLAPSIBLE MOVE HISTORY (grid) */}
      <div
        style={{
          borderTop: `1px solid ${t.border}`,
          paddingTop: 4,
          marginTop: 8,
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          aria-label="Toggle move history"
          aria-expanded={historyOpen}
          style={{
            background: "transparent",
            border: "none",
            width: "100%",
            padding: "10px 4px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 500,
            color: t.inkDim,
            textAlign: "left",
            borderRadius: 6,
          }}
        >
          <ChevronDown
            size={14}
            style={{
              transition: "transform 150ms",
              transform: historyOpen ? "rotate(0)" : "rotate(-90deg)",
            }}
          />
          Move history
          <span style={{ color: t.inkSoft, fontFamily: mono }}>({moves.length})</span>
        </button>
        {historyOpen && <MoveHistoryGrid moves={moves} playedCount={movesDone} />}
      </div>
    </div>
  );
}

// Mock board with click-to-move affordance. Real component is
// src/ui/ChessBoardPanel.tsx wrapping react-chessboard.
function BoardPlaceholder({ selectedSquare, setSelectedSquare }) {
  const t = useT();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  // Mock legal destinations for square e2: e3, e4
  const LEGAL = selectedSquare === "e2" ? new Set(["e3", "e4"]) : new Set();
  return (
    <div
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: 64 }).map((_, idx) => {
        const file = files[idx % 8];
        const rank = 8 - Math.floor(idx / 8);
        const sq = `${file}${rank}`;
        const dark = (idx + Math.floor(idx / 8)) % 2 === 1;
        const isSelected = selectedSquare === sq;
        const isLegal = LEGAL.has(sq);
        const isPiece = rank === 2 && file === "e"; // mock — only e2 has a piece
        return (
          <div
            key={sq}
            onClick={() => {
              if (isPiece) setSelectedSquare(sq);
              else if (isLegal) setSelectedSquare(null);
              else setSelectedSquare(null);
            }}
            style={{
              background: isSelected ? "rgba(155,199,0,0.55)" : dark ? "#B58863" : "#F0D9B5",
              cursor: "pointer",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "min(56px, 6vw)",
              userSelect: "none",
            }}
          >
            {isPiece && "♙"}
            {isLegal && (
              <div
                style={{
                  position: "absolute",
                  width: "28%",
                  height: "28%",
                  borderRadius: "50%",
                  background: "rgba(40,40,40,0.32)",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function MoveHistoryGrid({ moves, playedCount }) {
  const t = useT();
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: Math.floor(i / 2) + 1, w: i, b: i + 1 < moves.length ? i + 1 : null });
  }
  const cellStyle = (idx) => ({
    fontWeight: idx < playedCount ? 600 : 500,
    padding: "4px 8px",
    color: idx < playedCount ? t.ink : t.inkSoft,
    background: idx === playedCount ? t.brandSoft : "transparent",
    borderRadius: 4,
    fontFamily: mono,
    fontSize: 13,
    textAlign: "left",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  });
  return (
    <div
      style={{
        padding: "8px 4px 12px",
        display: "grid",
        gridTemplateColumns: "minmax(28px, auto) 1fr 1fr",
        rowGap: 4,
        columnGap: 8,
        maxWidth: "100%",
      }}
    >
      {rows.map((r) => (
        <div key={r.n} style={{ display: "contents" }}>
          <div style={{ color: t.inkSoft, fontWeight: 500, padding: "4px 0", fontFamily: mono, fontSize: 13 }}>
            {r.n}.
          </div>
          <div style={cellStyle(r.w)}>{moves[r.w]}</div>
          {r.b !== null ? <div style={cellStyle(r.b)}>{moves[r.b]}</div> : <div />}
        </div>
      ))}
    </div>
  );
}

// Reusable searchable dropdown menu (mirrors src/pages/DrillPage SearchableMenu)
function SearchableMenu({ placeholder, searchValue, onSearch, items, emptyHint }) {
  const t = useT();
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 6px)",
        left: 0,
        width: 380,
        maxHeight: 440,
        overflowY: "auto",
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 50,
      }}
    >
      <div style={{ padding: 8, borderBottom: `1px solid ${t.border}`, marginBottom: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          <Search size={13} color={t.inkDim} />
          <input
            autoFocus
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              flex: 1,
              fontFamily: sans,
              fontSize: 13,
              color: t.ink,
              minWidth: 0,
            }}
          />
          {searchValue && (
            <button
              onClick={() => onSearch("")}
              aria-label="Clear search"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                color: t.inkSoft,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "20px 12px", textAlign: "center", fontSize: 13, color: t.inkDim, fontFamily: sans }}>
          {emptyHint}
        </div>
      ) : (
        items.map((it) => (
          <button
            key={it.key}
            onClick={it.onPick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 10px",
              width: "100%",
              background: it.isCurrent ? t.surfaceAlt : "transparent",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              textAlign: "left",
              fontFamily: sans,
              color: t.ink,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: `2px solid ${it.isCurrent ? t.brand : t.border}`,
                background: it.isCurrent ? t.brand : "transparent",
                flexShrink: 0,
                boxShadow: it.isCurrent ? `inset 0 0 0 2px ${t.surface}` : "none",
              }}
            />
            <span
              style={{
                flex: 1,
                fontSize: 14.5,
                fontWeight: it.isCurrent ? 700 : 500,
                color: it.isCurrent ? t.brand : t.ink,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {it.primary}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

// ============================================================
// PLACEHOLDER PAGES (current src/ shows "Coming soon" / data-light states)
// ============================================================
function PlaceholderPage({ icon: Icon, title, body }) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "60px 20px",
        textAlign: "center",
      }}
    >
      <Icon size={36} color={t.inkSoft} strokeWidth={1.6} />
      <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, fontFamily: sans }}>{title}</div>
      <div style={{ fontSize: 13, color: t.inkDim, maxWidth: 420, fontFamily: sans }}>{body}</div>
    </div>
  );
}

function Dashboard() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title={`Welcome back, ${USER_NAME}`}
      body="Dashboard analytics ship after Phase 1 SRS lands. Currently a coming-soon empty state in src/."
    />
  );
}

function Repertoire() {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: sans }}>Repertoire</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {MOCK_OPENINGS.map((o) => (
          <div
            key={o.id}
            style={{
              padding: 16,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{o.name}</div>
            <div style={{ fontSize: 12, color: t.inkDim, marginTop: 2, fontFamily: mono }}>
              {o.eco} · {o.color === "white" ? "White" : "Black"}
            </div>
            <div
              style={{
                marginTop: 12,
                height: 4,
                background: t.surfaceAlt,
                borderRadius: 999,
              }}
            >
              <div style={{ width: 0, height: "100%", background: t.brand, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 6, fontFamily: sans }}>
              Drill to track
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Progress() {
  return (
    <PlaceholderPage
      icon={LineChart}
      title="Progress"
      body="Period filters + accuracy chart + ranking tables ship after Phase 1.5 session-event log lands."
    />
  );
}

function SettingsView() {
  const t = useT();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, fontFamily: sans }}>Settings</div>
      <div style={{ padding: 16, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginBottom: 8 }}>Board theme</div>
        <div style={{ fontSize: 12, color: t.inkDim }}>
          7 presets (Auto / Lichess / Blue / Green / Brown / Wood / Slate). Persisted as
          <code style={{ fontFamily: mono, marginLeft: 4 }}>tabiya.boardTheme</code>.
        </div>
      </div>
      <div style={{ padding: 16, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginBottom: 8 }}>Piece set</div>
        <div style={{ fontSize: 12, color: t.inkDim }}>
          3 presets (Classic / Letter / Unicode). Persisted as
          <code style={{ fontFamily: mono, marginLeft: 4 }}>tabiya.pieceSet</code>.
        </div>
      </div>
      <div style={{ padding: 16, background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginBottom: 8 }}>Sound</div>
        <div style={{ fontSize: 12, color: t.inkDim }}>
          On/off toggle + volume slider + test button. Audio pool of 3 (no concurrent stomp). Persisted as
          <code style={{ fontFamily: mono, marginLeft: 4 }}>tabiya.sound</code>.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APP SHELL (src/ui/shell/AppShell.tsx)
// ============================================================
export default function CurrentImplementedApp() {
  const [active, setActive] = useState("drill");
  const [isDark, setIsDark] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Drill page suppresses TopBar title/breadcrumb.
  const titles = {
    dashboard: { title: "Dashboard" },
    repertoire: { title: "Repertoire" },
    drill: { title: "", breadcrumb: "" },
    progress: { title: "Progress" },
    settings: { title: "Settings" },
  };
  const meta = titles[active] ?? { title: "" };

  const Page = () => {
    switch (active) {
      case "dashboard":
        return <Dashboard />;
      case "repertoire":
        return <Repertoire />;
      case "drill":
        return <DrillMode />;
      case "progress":
        return <Progress />;
      case "settings":
        return <SettingsView />;
      default:
        return <PlaceholderPage icon={Inbox} title="Not found" body={`No page for "${active}"`} />;
    }
  };

  return (
    <T.Provider value={theme}>
      <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.ink }}>
        <Sidebar
          active={active}
          setActive={setActive}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <TopBar
            title={meta.title}
            breadcrumb={meta.breadcrumb}
            isDark={isDark}
            setIsDark={setIsDark}
          />
          <main
            style={{
              flex: 1,
              padding: "32px 40px",
              maxWidth: 1280,
              width: "100%",
              margin: "0 auto",
            }}
          >
            <Page />
          </main>
        </div>
      </div>
    </T.Provider>
  );
}
