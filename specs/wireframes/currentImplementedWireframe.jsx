/**
 * currentImplementedWireframe.jsx
 *
 * Snapshot of what is ACTUALLY shipped in src/ as of 2026-05-15 (Fri).
 * Mirrors `wireframe.jsx` style (single-file JSX, inline styles, mock data) so
 * the team can visually compare design intent (wireframe.jsx) against
 * production reality (this file). Source of truth = src/. Regenerated when
 * src/ ships meaningful UI deltas.
 *
 * Implemented since the 2026-05-05 snapshot:
 *   - phase-0d.3 — family layer: RepertoirePage groups openings by Family
 *     (collapsed cards, expand to reveal openings + per-line rows), category
 *     filter chips (Open / Semi-Open / Closed / Indian / Flank / Gambits /
 *     Uncategorized / All), search across families/openings/ECO.
 *   - phase-1 SRS — DashboardPage now wires real stats (lines mastered %,
 *     due-for-review count, drilled lines); Sidebar shows a due-count badge on
 *     the Repertoire nav item; RepertoirePage shows ghost mastery bars per
 *     opening + per-line ↺ reset buttons; SettingsPage gains Danger Zone
 *     "Reset all SRS progress" with two-step confirm.
 *   - phase-0d.4 — forks + tier system: lines carry `forks[]` (fork badges in
 *     move history, click reveals fork popover with alternatives + rationale);
 *     families carry `tier` and gate behind the active preset.
 *   - phase-1c —
 *       · /drill?queue=due auto-advances through the SrsDue snapshot;
 *         shows a "QUEUE n/N ✕" exit chip in the breadcrumb row.
 *       · StrategicNotesPanel under the board (collapsed open by default,
 *         persists `tabiya.strategyOpen`).
 *       · EndOfLineSummary card overlay on drill completion (non-queue),
 *         with Plies/Wrong/Hints/Time stats + Restart / Drill due / Next-in-family.
 *       · Repertoire presets (Beginner / Intermediate / Advanced / Off) on
 *         SettingsPage; family pickers filter through `familyPassesPreset`.
 *       · /repertoire/gambits dedicated cross-cut route.
 *       · DrillPage right-rail Move History (sticky 300px column on desktop).
 *
 * Stubbed in src/ (placeholders, here for completeness):
 *   - ProgressPage — still a "Coming soon" StateMessage.
 *   - Dashboard "Activity feed" card — copy only, no event log yet.
 *
 * NOT yet in src/ (lives only in wireframe.jsx — not rendered here):
 *   - Profile/avatar dropdown, streak counter widget, Games page.
 */

import { useState, createContext, useContext, useEffect, useRef } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
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
  RotateCw,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Sun,
  Swords,
  Target,
  Volume2,
  VolumeX,
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
  brandHover: "#065F46",
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
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

// ============================================================
// MOCK CATALOG (mirrors public/catalog.json shape — family + opening + line +
// fork annotations; just enough to drive the snapshot UI)
// ============================================================
const MOCK_FAMILIES = [
  {
    id: "italian-game",
    name: "Italian Game",
    eco_range: "C50-C54",
    category: "open",
    tier: 1,
    opening_ids: ["italian-main-var", "italian-evans-var", "italian-fried-liver-var"],
  },
  {
    id: "ruy-lopez",
    name: "Ruy Lopez",
    eco_range: "C60-C99",
    category: "open",
    tier: 1,
    opening_ids: ["ruy-main-var"],
  },
  {
    id: "kings-gambit",
    name: "King's Gambit",
    eco_range: "C30-C39",
    category: "gambit",
    tier: 2,
    opening_ids: ["kings-gambit-var"],
  },
  {
    id: "sicilian",
    name: "Sicilian Defense",
    eco_range: "B20-B99",
    category: "semi-open",
    tier: 1,
    opening_ids: ["sicilian-najdorf-var"],
  },
  {
    id: "caro-kann",
    name: "Caro-Kann",
    eco_range: "B10-B19",
    category: "semi-open",
    tier: 1,
    opening_ids: ["caro-classical-var"],
  },
  {
    id: "kings-indian",
    name: "King's Indian Defense",
    eco_range: "E60-E99",
    category: "indian",
    tier: 2,
    opening_ids: ["kings-indian-var"],
  },
];

const MOCK_OPENINGS = [
  {
    id: "italian-main-var",
    name: "Italian Game",
    eco: "C50",
    color: "white",
    family_id: "italian-game",
    is_gambit: false,
    line_ids: ["italian-main", "italian-giuoco-pianissimo"],
  },
  {
    id: "italian-evans-var",
    name: "Evans Gambit",
    eco: "C51",
    color: "white",
    family_id: "italian-game",
    is_gambit: true,
    line_ids: ["italian-evans"],
  },
  {
    id: "italian-fried-liver-var",
    name: "Fried Liver Attack",
    eco: "C57",
    color: "white",
    family_id: "italian-game",
    is_gambit: false,
    line_ids: ["italian-fried-liver"],
  },
  {
    id: "ruy-main-var",
    name: "Ruy Lopez",
    eco: "C60",
    color: "white",
    family_id: "ruy-lopez",
    is_gambit: false,
    line_ids: ["ruy-main", "ruy-berlin"],
  },
  {
    id: "kings-gambit-var",
    name: "King's Gambit Accepted",
    eco: "C33",
    color: "white",
    family_id: "kings-gambit",
    is_gambit: true,
    line_ids: ["kings-gambit-accepted"],
  },
  {
    id: "sicilian-najdorf-var",
    name: "Najdorf Variation",
    eco: "B90",
    color: "black",
    family_id: "sicilian",
    is_gambit: false,
    line_ids: ["sicilian-najdorf"],
  },
  {
    id: "caro-classical-var",
    name: "Classical Caro-Kann",
    eco: "B18",
    color: "black",
    family_id: "caro-kann",
    is_gambit: false,
    line_ids: ["caro-classical"],
  },
  {
    id: "kings-indian-var",
    name: "King's Indian Defense",
    eco: "E60",
    color: "black",
    family_id: "kings-indian",
    is_gambit: false,
    line_ids: ["kings-indian-classical"],
  },
];

const MOCK_LINES = [
  {
    id: "italian-main",
    opening_id: "italian-main-var",
    name: "Main Line",
    depth: 12,
    moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","c3","Nf6","d4","exd4","cxd4","Bb4+"],
    strategic_notes: [
      "Fight for the center with d4 once your bishop and knight are out.",
      "Castle short before launching kingside ideas.",
      "Watch for ...Nxe4 forks against the c3-bishop battery.",
    ],
    forks: [
      {
        ply_index: 9,
        label: "Alternative captures",
        alternatives: ["Nxd4", "cxd4"],
        rationale: "Recapturing with the knight loses central tension early; the c-pawn keeps the bishop active.",
      },
    ],
  },
  {
    id: "italian-giuoco-pianissimo",
    opening_id: "italian-main-var",
    name: "Giuoco Pianissimo",
    depth: 10,
    moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","d3","Nf6","O-O","d6"],
    strategic_notes: ["Slow positional plan — prepare c3 + Nbd2 + Re1."],
    forks: [],
  },
  {
    id: "italian-evans",
    opening_id: "italian-evans-var",
    name: "Evans Gambit",
    depth: 14,
    moves: ["e4","e5","Nf3","Nc6","Bc4","Bc5","b4","Bxb4","c3","Ba5","d4","exd4","O-O","d6"],
    strategic_notes: ["Sacrifice the b-pawn for a fast central break with d4."],
    forks: [],
  },
  {
    id: "italian-fried-liver",
    opening_id: "italian-fried-liver-var",
    name: "Fried Liver Attack",
    depth: 10,
    moves: ["e4","e5","Nf3","Nc6","Bc4","Nf6","Ng5","d5","exd5","Nxd5"],
    strategic_notes: ["Black must avoid 4...Nxd5? — 5.Nxf7! wins material."],
    forks: [],
  },
  {
    id: "ruy-main",
    opening_id: "ruy-main-var",
    name: "Closed Main Line",
    depth: 20,
    moves: ["e4","e5","Nf3","Nc6","Bb5","a6","Ba4","Nf6","O-O","Be7","Re1","b5","Bb3","d6","c3","O-O","h3","Nb8","d4","Nbd7"],
    strategic_notes: ["Classical center then Spanish maneuvering with Nbd2-f1-g3."],
    forks: [],
  },
  {
    id: "ruy-berlin",
    opening_id: "ruy-main-var",
    name: "Berlin Defense",
    depth: 16,
    moves: ["e4","e5","Nf3","Nc6","Bb5","Nf6","O-O","Nxe4","d4","Nd6","Bxc6","dxc6","dxe5","Nf5","Qxd8+","Kxd8"],
    strategic_notes: ["Endgame-style middlegame — king safety on d8 is OK."],
    forks: [],
  },
  {
    id: "kings-gambit-accepted",
    opening_id: "kings-gambit-var",
    name: "King's Gambit Accepted",
    depth: 8,
    moves: ["e4","e5","f4","exf4","Nf3","g5","h4","g4"],
    strategic_notes: ["Sacrifice the f-pawn for rapid development + open f-file."],
    forks: [],
  },
  {
    id: "sicilian-najdorf",
    opening_id: "sicilian-najdorf-var",
    name: "Najdorf Main Line",
    depth: 18,
    moves: ["e4","c5","Nf3","d6","d4","cxd4","Nxd4","Nf6","Nc3","a6","Be3","e5","Nb3","Be6","f3","h5","Qd2","Nbd7"],
    strategic_notes: ["Counterstrike with ...e5 once the d4 knight commits."],
    forks: [],
  },
  {
    id: "caro-classical",
    opening_id: "caro-classical-var",
    name: "Classical Variation",
    depth: 16,
    moves: ["e4","c6","d4","d5","Nc3","dxe4","Nxe4","Bf5","Ng3","Bg6","h4","h6","Nf3","Nd7","h5","Bh7"],
    strategic_notes: ["Solid pawn structure, light-squared bishop developed early."],
    forks: [],
  },
  {
    id: "kings-indian-classical",
    opening_id: "kings-indian-var",
    name: "Classical Variation",
    depth: 14,
    moves: ["d4","Nf6","c4","g6","Nc3","Bg7","e4","d6","Nf3","O-O","Be2","e5","O-O","Nc6"],
    strategic_notes: ["Hyper-modern — invite the center, then break with ...e5/...f5."],
    forks: [],
  },
];

// Mock SRS state (mirrors hook output): box per line + computed dues.
const MOCK_SRS_STATES = new Map([
  ["italian-main", { box: 3, due_at: Date.now() - 3600_000 }],
  ["italian-giuoco-pianissimo", { box: 5, due_at: Date.now() + 5 * 86400_000 }],
  ["italian-evans", { box: 2, due_at: Date.now() - 1800_000 }],
  ["ruy-main", { box: 4, due_at: Date.now() + 86400_000 }],
  ["sicilian-najdorf", { box: 1, due_at: Date.now() - 7200_000 }],
  ["caro-classical", { box: 4, due_at: Date.now() + 2 * 86400_000 }],
]);
const MOCK_DUE_LINE_IDS = ["italian-main", "italian-evans", "sicilian-najdorf", "italian-fried-liver"];
const MOCK_PRESETS = [
  { id: "beginner", name: "Beginner", description: "Italian, Caro-Kann, Scandinavian. ~6 families." },
  { id: "intermediate", name: "Intermediate", description: "Adds Ruy Lopez, Sicilian, Queen's Gambit, KID." },
  { id: "advanced", name: "Advanced", description: "Everything tier 1+2 — full repertoire." },
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
// SECTION DIVIDER (used only inside this snapshot for navigation)
// ============================================================
function SectionDivider({ label, sub }) {
  return (
    <div
      style={{
        margin: "48px 0 16px",
        borderTop: "2px dashed #C8C2B0",
        paddingTop: 14,
        fontFamily: sans,
      }}
    >
      <div style={{ fontSize: 11, color: "#A8A29E", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
        Section
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1C1917", marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: "#78716C", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// SIDEBAR (src/ui/shell/Sidebar.tsx) — with due-count badge
// ============================================================
function Sidebar({ active, setActive, collapsed, onToggleCollapsed, dueCount }) {
  const t = useT();
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/" },
    { id: "repertoire", label: "Repertoire", icon: Library, to: "/repertoire", badge: dueCount },
    { id: "progress", label: "Progress", icon: LineChart, to: "/progress" },
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
          const isActive = active === it.id;
          const showBadge = typeof it.badge === "number" && it.badge > 0;
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
                position: "relative",
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
              {!collapsed && <span style={{ flex: 1 }}>{it.label}</span>}
              {showBadge && (
                <span
                  style={{
                    background: t.brand,
                    color: "#FFF",
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: collapsed ? 0 : "1px 6px",
                    borderRadius: 999,
                    minWidth: collapsed ? 14 : 18,
                    height: collapsed ? 14 : 18,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: collapsed ? "absolute" : "static",
                    top: collapsed ? 4 : undefined,
                    right: collapsed ? 4 : undefined,
                  }}
                >
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => setActive("settings")}
        title={collapsed ? "Settings" : undefined}
        style={{
          background: active === "settings" ? t.brandSoft : "transparent",
          color: active === "settings" ? t.brand : t.ink,
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
        position: "sticky",
        top: 0,
        zIndex: 20,
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
// PRIMITIVES (mirror src/ui/primitives/*)
// ============================================================
function PageHeader({ title, subtitle, actions }) {
  const t = useT();
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, fontFamily: sans, fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: -0.4 }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, marginTop: 4 }}>{subtitle}</div>
        )}
      </div>
      {actions}
    </div>
  );
}

function Card({ children, padding = 16, style }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Button({ children, variant = "primary", disabled, onClick, style }) {
  const t = useT();
  const styles = {
    primary: { background: t.brand, color: "#FFF", border: "none" },
    secondary: {
      background: t.surface,
      color: t.ink,
      border: `1px solid ${t.border}`,
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: "8px 14px",
        borderRadius: 8,
        fontFamily: sans,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function StateMessage({ icon: Icon, title, body, action, iconColor }) {
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
      <Icon size={36} color={iconColor ?? t.inkSoft} strokeWidth={1.6} />
      <div style={{ fontSize: 18, fontWeight: 600, color: t.ink, fontFamily: sans }}>{title}</div>
      {body && <div style={{ fontSize: 13, color: t.inkDim, maxWidth: 460, fontFamily: sans }}>{body}</div>}
      {action}
    </div>
  );
}

// ============================================================
// DASHBOARD (src/pages/DashboardPage.tsx) — Phase 1 real stats
// ============================================================
function DashboardPage() {
  const t = useT();
  const totalLines = MOCK_LINES.length;
  const mastered = Array.from(MOCK_SRS_STATES.values()).filter((s) => s.box >= 4).length;
  const masteredPct = Math.round((mastered / totalLines) * 100);
  const dueCount = MOCK_DUE_LINE_IDS.length;
  const drilled = MOCK_SRS_STATES.size;
  const drillHref = dueCount > 0 ? "/drill?queue=due" : "/repertoire";
  const drillLabel = dueCount > 0 ? `Drill ${dueCount} due` : "Browse repertoire";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Your spaced-repetition snapshot."
        actions={<Button variant="primary">{drillLabel} →</Button>}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
        }}
      >
        <StatCard icon={<Target size={16} color={t.brand} />} label="Lines mastered" value={`${masteredPct}%`} sub={`${mastered} of ${totalLines}`} />
        <StatCard icon={<Calendar size={16} color={t.brand} />} label="Due for review" value={String(dueCount)} sub={dueCount === 0 ? "All caught up" : "Lines past their interval"} />
        <StatCard icon={<LineChart size={16} color={t.brand} />} label="Drilled lines" value={String(drilled)} sub={`out of ${totalLines}`} />
      </div>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Inbox size={15} color={t.inkDim} />
          <div style={{ fontWeight: 600, fontFamily: sans, fontSize: 14, color: t.ink }}>Activity feed</div>
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans }}>
          Detailed activity, accuracy trends, and the practice-rhythm heatmap activate after Phase 1.5 ships the session event log.
        </div>
      </Card>

      {/* EMPTY STATE VARIANT — also shown for documentation */}
      <SectionDivider label="Dashboard — empty state" sub="Rendered when states.size === 0 (first-run user)." />
      <PageHeader title="Dashboard" subtitle="Pick a line and complete one drill to start tracking." />
      <StateMessage
        icon={LineChart}
        title="No drills yet"
        body="Browse the Repertoire and pick an opening. The first drill seeds your SRS history; mastery and due-for-review numbers appear here as you progress."
        action={<Button variant="primary">Browse repertoire →</Button>}
      />
    </div>
  );
}

function StatCard({ icon, label, value, sub }) {
  const t = useT();
  return (
    <Card padding={16}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 12, color: t.inkDim, fontFamily: sans, fontWeight: 600 }}>{label}</div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: t.ink, fontFamily: sans, letterSpacing: -0.5, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: sans }}>{sub}</div>
      <div
        style={{
          height: 4,
          background: t.surfaceAlt,
          borderRadius: 999,
          marginTop: 10,
          overflow: "hidden",
        }}
      />
    </Card>
  );
}

// ============================================================
// REPERTOIRE (src/pages/RepertoirePage.tsx) — family-grouped browser
// ============================================================
const CATEGORY_LABELS = {
  all: "All",
  open: "Open",
  "semi-open": "Semi-Open",
  closed: "Closed",
  indian: "Indian",
  flank: "Flank",
  gambit: "Gambits",
  uncategorized: "Uncategorized",
};

function RepertoirePage() {
  const t = useT();
  const [color, setColor] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(new Set(["italian-game"])); // 1 expanded for demo

  const toggleFamily = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filtered = MOCK_FAMILIES
    .filter((f) => category === "all" || f.category === category)
    .map((f) => {
      const ops = f.opening_ids
        .map((id) => MOCK_OPENINGS.find((o) => o.id === id))
        .filter(Boolean)
        .filter((o) => color === "all" || o.color === color)
        .filter((o) => {
          const q = search.trim().toLowerCase();
          if (!q) return true;
          return (
            o.name.toLowerCase().includes(q) ||
            o.eco.toLowerCase().includes(q) ||
            f.name.toLowerCase().includes(q)
          );
        });
      return { family: f, ops };
    })
    .filter((row) => row.ops.length > 0);

  const totalOpenings = MOCK_OPENINGS.length;
  const gambitCount = MOCK_OPENINGS.filter((o) => o.is_gambit).length;
  const whiteCount = MOCK_OPENINGS.filter((o) => o.color === "white").length;
  const blackCount = MOCK_OPENINGS.filter((o) => o.color === "black").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        title="Repertoire"
        subtitle={`${MOCK_FAMILIES.length} families · ${totalOpenings} openings · click a family to expand.`}
      />

      {/* SEARCH + GAMBITS LINK */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: t.inkSoft,
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search families, openings, ECO…"
            style={{
              width: "100%",
              padding: "8px 10px 8px 30px",
              fontFamily: sans,
              fontSize: 13,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 6,
              color: t.ink,
              outline: "none",
            }}
          />
        </div>
        <a
          href="/repertoire/gambits"
          onClick={(e) => e.preventDefault()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 6,
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.ink,
            textDecoration: "none",
          }}
        >
          <Swords size={14} />
          Gambits
          <span
            style={{
              background: t.surfaceAlt,
              color: t.inkDim,
              fontSize: 11,
              fontWeight: 600,
              padding: "1px 7px",
              borderRadius: 999,
              fontFamily: sans,
            }}
          >
            {gambitCount}
          </span>
        </a>
      </div>

      {/* COLOR TABS */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${t.border}` }}>
        {[
          { id: "all", label: "All", count: totalOpenings },
          { id: "white", label: "As White", count: whiteCount },
          { id: "black", label: "As Black", count: blackCount },
        ].map((c) => {
          const isActive = color === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setColor(c.id)}
              style={{
                background: "transparent",
                border: "none",
                padding: "10px 14px",
                fontFamily: sans,
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? t.ink : t.inkDim,
                cursor: "pointer",
                borderBottom: `2px solid ${isActive ? t.brand : "transparent"}`,
                marginBottom: -1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.label}
              <span
                style={{
                  background: isActive ? t.brandSoft : t.surfaceAlt,
                  color: isActive ? t.brand : t.inkDim,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 999,
                  fontFamily: sans,
                }}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* CATEGORY CHIPS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.keys(CATEGORY_LABELS).map((cat) => {
          const isActive = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: "5px 11px",
                fontFamily: sans,
                fontSize: 12,
                fontWeight: 600,
                background: isActive ? t.brandSoft : "transparent",
                color: isActive ? t.brand : t.inkDim,
                border: `1px solid ${isActive ? t.brand : t.border}`,
                borderRadius: 999,
                cursor: "pointer",
              }}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>

      {/* FAMILY CARDS */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(({ family, ops }) => (
          <FamilyCard
            key={family.id}
            family={family}
            openings={ops}
            expanded={expanded.has(family.id)}
            onToggle={() => toggleFamily(family.id)}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyCard({ family, openings, expanded, onToggle }) {
  const t = useT();
  // Mock mastery by family (deterministic from id)
  const masteryPct = family.id === "italian-game" ? 52 : family.id === "ruy-lopez" ? 31 : 0;
  const linesByOpening = new Map();
  for (const ln of MOCK_LINES) {
    if (!ln.opening_id) continue;
    const list = linesByOpening.get(ln.opening_id) ?? [];
    list.push(ln);
    linesByOpening.set(ln.opening_id, list);
  }
  const totalLines = openings.reduce((sum, o) => sum + (linesByOpening.get(o.id)?.length ?? 0), 0);

  return (
    <Card padding={0}>
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: 16,
          background: "transparent",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {expanded ? <ChevronDown size={16} color={t.inkDim} /> : <ChevronRight size={16} color={t.inkDim} />}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: t.inkSoft, fontWeight: 600, marginBottom: 4 }}>
            {family.eco_range} · {family.category.toUpperCase()}
            {family.tier === 2 && (
              <span
                style={{
                  marginLeft: 8,
                  padding: "1px 6px",
                  background: t.amberSoft,
                  color: t.amber,
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: sans,
                  letterSpacing: 0.3,
                }}
              >
                TIER 2
              </span>
            )}
          </div>
          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: t.ink, fontFamily: sans }}>
            {family.name}
          </h3>
          <MasteryBar percent={masteryPct} caption={masteryPct > 0 ? `${masteryPct}% mastery` : "Drill to track"} />
        </div>
        <span style={{ fontSize: 12, color: t.inkDim, fontFamily: sans, textAlign: "right" }}>
          {openings.length} {openings.length === 1 ? "opening" : "openings"}
          <br />
          <span style={{ fontSize: 11, color: t.inkSoft }}>
            {totalLines} {totalLines === 1 ? "line" : "lines"}
          </span>
        </span>
      </button>

      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "6px 0" }}>
          {openings.map((o) => {
            const opLines = linesByOpening.get(o.id) ?? [];
            const opPct = MOCK_SRS_STATES.has(opLines[0]?.id) ? 40 : 0;

            if (opLines.length === 1) {
              const line = opLines[0];
              const canReset = MOCK_SRS_STATES.has(line.id);
              return (
                <div key={o.id} style={{ display: "flex", alignItems: "stretch", width: "100%" }}>
                  <button
                    style={{
                      flex: 1,
                      padding: "10px 8px 10px 44px",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: sans,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: mono, fontSize: 10.5, color: t.inkSoft, fontWeight: 600, marginBottom: 2 }}>
                        {o.eco} · {o.color === "white" ? "WHITE" : "BLACK"}
                        {o.is_gambit ? " · GAMBIT" : ""}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>{o.name}</div>
                      <MasteryBar percent={opPct} caption={opPct > 0 ? `${opPct}% mastery` : "Not started"} compact />
                    </div>
                    <ChevronRight size={14} color={t.brand} />
                  </button>
                  <ResetIconButton enabled={canReset} />
                </div>
              );
            }

            // Multi-line variation — Opening header + line rows
            return (
              <div key={o.id}>
                <button
                  style={{
                    width: "100%",
                    padding: "10px 16px 6px 44px",
                    background: "transparent",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: sans,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: t.inkSoft, fontWeight: 600, marginBottom: 2 }}>
                      {o.eco} · {o.color === "white" ? "WHITE" : "BLACK"}
                      {o.is_gambit ? " · GAMBIT" : ""}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.ink }}>{o.name}</div>
                    <MasteryBar percent={opPct} caption={opPct > 0 ? `${opPct}% mastery` : "Not started"} compact />
                  </div>
                  <span style={{ fontSize: 11.5, color: t.inkDim }}>{opLines.length} lines</span>
                </button>
                <div style={{ paddingBottom: 6 }}>
                  {opLines.map((line) => {
                    const canReset = MOCK_SRS_STATES.has(line.id);
                    return (
                      <div key={line.id} style={{ display: "flex", alignItems: "stretch", width: "100%" }}>
                        <button
                          style={{
                            flex: 1,
                            padding: "7px 8px 7px 64px",
                            background: "transparent",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: sans,
                            fontSize: 13,
                            color: t.ink,
                          }}
                        >
                          <span style={{ width: 4, height: 4, borderRadius: 999, background: t.inkSoft }} />
                          <span style={{ flex: 1 }}>{line.name}</span>
                          <span style={{ fontSize: 11, color: t.inkSoft }}>{line.depth} ply</span>
                          <ChevronRight size={12} color={t.brand} />
                        </button>
                        <ResetIconButton enabled={canReset} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ResetIconButton({ enabled }) {
  const t = useT();
  return (
    <button
      disabled={!enabled}
      title={enabled ? "Reset SRS for this line" : "No SRS state to reset"}
      style={{
        width: 36,
        background: "transparent",
        border: "none",
        cursor: enabled ? "pointer" : "not-allowed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: enabled ? t.inkDim : t.inkSoft,
        opacity: enabled ? 1 : 0.3,
        padding: 0,
      }}
    >
      <RotateCcw size={13} />
    </button>
  );
}

function MasteryBar({ percent, caption, compact = false }) {
  const t = useT();
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ marginTop: compact ? 4 : 8 }}>
      <div
        style={{
          height: compact ? 4 : 6,
          background: t.surfaceAlt,
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${safe}%`,
            height: "100%",
            background: safe >= 80 ? t.brand : safe > 0 ? t.brandSoft : "transparent",
          }}
        />
      </div>
      <span
        style={{
          fontSize: compact ? 10.5 : 11,
          color: t.inkSoft,
          fontFamily: sans,
          marginTop: 3,
          display: "block",
        }}
      >
        {caption}
      </span>
    </div>
  );
}

// ============================================================
// GAMBITS (src/pages/GambitsPage.tsx)
// ============================================================
function GambitsPage() {
  const t = useT();
  const gambits = MOCK_OPENINGS.filter((o) => o.is_gambit);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <a
        href="/repertoire"
        onClick={(e) => e.preventDefault()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12.5,
          fontFamily: sans,
          color: t.inkDim,
          textDecoration: "none",
          fontWeight: 600,
        }}
      >
        <ArrowLeft size={13} /> Back to Repertoire
      </a>
      <PageHeader
        title="Gambits"
        subtitle={`${gambits.length} gambit${gambits.length === 1 ? "" : "s"} across all families.`}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 14,
        }}
      >
        {gambits.map((o) => (
          <Card key={o.id} style={{ cursor: "pointer", padding: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: t.inkSoft, fontWeight: 600 }}>
                {o.eco} · {o.color === "white" ? "WHITE" : "BLACK"}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: t.ink, fontFamily: sans }}>{o.name}</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: t.inkDim, fontFamily: sans }}>
                  {o.line_ids.length} {o.line_ids.length === 1 ? "line" : "lines"}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: t.brand,
                    fontWeight: 700,
                    background: t.brandSoft,
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontFamily: sans,
                  }}
                >
                  GAMBIT
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  fontSize: 12,
                  color: t.brand,
                  fontWeight: 600,
                  fontFamily: sans,
                }}
              >
                Drill <ChevronRight size={13} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// DRILL PAGE (src/pages/DrillPage.tsx) — v1.3 (May 2026 refactor #2)
// 2-column grid: main + 300px sticky history rail
// ============================================================
function DrillPage({ queueMode = false, showSummary = false }) {
  const t = useT();
  const [familyId, setFamilyId] = useState("italian-game");
  const [lineId, setLineId] = useState("italian-main");
  const [openingMenuOpen, setOpeningMenuOpen] = useState(false);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [openingSearch, setOpeningSearch] = useState("");
  const [lineSearch, setLineSearch] = useState("");
  const [activeMode, setActiveMode] = useState("theory");
  const [historyOpen, setHistoryOpen] = useState(true); // default open in v1.3
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [openForkPly, setOpenForkPly] = useState(5); // demo: open fork popover at ply 5
  const [strategyOpen, setStrategyOpen] = useState(true);

  const openingMenuRef = useClickOutside(openingMenuOpen, () => {
    setOpeningMenuOpen(false);
    setOpeningSearch("");
  });
  const lineMenuRef = useClickOutside(lineMenuOpen, () => {
    setLineMenuOpen(false);
    setLineSearch("");
  });
  const modeMenuRef = useClickOutside(modeMenuOpen, () => setModeMenuOpen(false));

  const family = MOCK_FAMILIES.find((f) => f.id === familyId);
  const openingsInFamily = MOCK_OPENINGS.filter((o) => o.family_id === familyId);
  const linesInFamily = MOCK_LINES.filter((l) =>
    openingsInFamily.some((o) => o.id === l.opening_id)
  );
  const line = linesInFamily.find((l) => l.id === lineId) ?? linesInFamily[0];
  const opening = MOCK_OPENINGS.find((o) => o.id === line?.opening_id);
  const srsBox = MOCK_SRS_STATES.get(line?.id ?? "")?.box ?? 1;

  const modes = [
    { id: "theory", label: "Theory", icon: BookOpen, available: true },
    { id: "coach", label: "AI Coach", icon: Sparkles, available: false },
    { id: "visualizer", label: "Visualizer", icon: Eye, available: false },
    { id: "engine", label: "Play it out", icon: Swords, available: false },
  ];
  const currentMode = modes.find((m) => m.id === activeMode);
  const ModeIcon = currentMode.icon;

  const movesDone = 5;
  const moves = line?.moves ?? [];
  const totalPly = moves.length;
  const progressPct = totalPly === 0 ? 0 : (movesDone / totalPly) * 100;

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
        display: "grid",
        gridTemplateColumns: "1fr 300px",
        gap: 24,
        alignItems: "start",
        maxWidth: 1180,
        margin: "0 auto",
      }}
    >
      {/* MAIN COLUMN */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
        {/* HEADER ROW: opening + line pills side-by-side; mode right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 11,
                color: t.inkSoft,
                fontWeight: 600,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                fontFamily: sans,
              }}
            >
              Repertoire
              {queueMode && (
                <button
                  title="Exit queue mode"
                  style={{
                    marginLeft: 8,
                    padding: "2px 8px",
                    background: t.brandSoft,
                    color: t.brand,
                    border: "none",
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: sans,
                    cursor: "pointer",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Queue 2/4 ✕
                </button>
              )}
              <span
                style={{
                  marginLeft: 8,
                  padding: "2px 8px",
                  background: t.surfaceAlt,
                  color: t.inkDim,
                  border: `1px solid ${t.border}`,
                  borderRadius: 999,
                  fontSize: 10.5,
                  fontWeight: 700,
                  fontFamily: sans,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Box {srsBox}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* Opening (= Family) pill */}
              <div ref={openingMenuRef} style={{ position: "relative" }}>
                <PillTrigger
                  label={family?.name ?? "—"}
                  open={openingMenuOpen}
                  onClick={() => setOpeningMenuOpen((v) => !v)}
                  prominent
                />
                {openingMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${MOCK_FAMILIES.length} openings…`}
                    searchValue={openingSearch}
                    onSearch={setOpeningSearch}
                    items={MOCK_FAMILIES.map((f) => ({
                      kind: "item",
                      key: f.id,
                      label: f.name,
                      isCurrent: f.id === familyId,
                      onPick: () => {
                        setFamilyId(f.id);
                        const firstOp = MOCK_OPENINGS.find((o) => o.family_id === f.id);
                        const firstLine = MOCK_LINES.find((l) => l.opening_id === firstOp?.id);
                        if (firstLine) setLineId(firstLine.id);
                        setOpeningMenuOpen(false);
                        setOpeningSearch("");
                      },
                    }))}
                    emptyHint="No openings yet."
                  />
                )}
              </div>

              {/* Line pill */}
              <div ref={lineMenuRef} style={{ position: "relative" }}>
                <PillTrigger
                  label={line?.name ?? "—"}
                  open={lineMenuOpen}
                  onClick={() => setLineMenuOpen((v) => !v)}
                />
                {lineMenuOpen && (
                  <SlickMenu
                    placeholder={`Search ${linesInFamily.length} lines…`}
                    searchValue={lineSearch}
                    onSearch={setLineSearch}
                    items={linesInFamily.map((l) => ({
                      kind: "item",
                      key: l.id,
                      label: l.name,
                      isCurrent: l.id === lineId,
                      onPick: () => {
                        setLineId(l.id);
                        setLineMenuOpen(false);
                        setLineSearch("");
                      },
                    }))}
                    emptyHint="No lines yet."
                  />
                )}
              </div>
            </div>
          </div>

          {/* Mode dropdown */}
          <div ref={modeMenuRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setModeMenuOpen((v) => !v)}
              style={{
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: 999,
                padding: "8px 14px",
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
                        padding: "10px 12px",
                        width: "100%",
                        background: isActive ? t.brandSoft : "transparent",
                        border: "none",
                        borderRadius: 6,
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

        {/* PROGRESS BAR */}
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

        {/* HERO BOARD */}
        <div style={{ width: "100%" }}>
          <BoardPlaceholder selectedSquare={selectedSquare} setSelectedSquare={setSelectedSquare} />
        </div>

        {/* END-OF-LINE SUMMARY (toggled state) */}
        {showSummary && line && (
          <EndOfLineSummaryCard
            line={line}
            wrongAttempts={1}
            hintUses={0}
            durationSec={47}
            dueCount={MOCK_DUE_LINE_IDS.length}
            nextLineName="Giuoco Pianissimo"
          />
        )}

        {/* STRATEGIC NOTES PANEL */}
        <StrategicNotesPanel notes={line?.strategic_notes ?? []} open={strategyOpen} onToggle={() => setStrategyOpen((v) => !v)} />

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
      </div>

      {/* RIGHT RAIL — MOVE HISTORY (sticky) */}
      <aside
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 0,
          alignSelf: "start",
          position: "sticky",
          top: 80,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          style={{
            background: "transparent",
            border: "none",
            width: "100%",
            padding: "12px 14px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.ink,
            textAlign: "left",
            borderBottom: historyOpen ? `1px solid ${t.border}` : "none",
          }}
        >
          <ChevronDown
            size={14}
            style={{
              transition: "transform 150ms",
              transform: historyOpen ? "rotate(0)" : "rotate(-90deg)",
              color: t.inkDim,
            }}
          />
          Move history
          <span style={{ color: t.inkSoft, fontFamily: mono, fontWeight: 500 }}>({moves.length})</span>
        </button>
        {historyOpen && (
          <div style={{ padding: "8px 8px 12px", maxHeight: 540, overflowY: "auto" }}>
            <MoveHistoryGrid
              moves={moves}
              playedCount={movesDone}
              forks={line?.forks ?? []}
              openForkPly={openForkPly}
              setOpenForkPly={setOpenForkPly}
            />
          </div>
        )}
      </aside>
    </div>
  );
}

// ============================================================
// Board placeholder (mirrors src/ui/ChessBoardPanel.tsx affordances)
// ============================================================
function BoardPlaceholder({ selectedSquare, setSelectedSquare }) {
  const t = useT();
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
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
        const isPiece = rank === 2 && file === "e";
        return (
          <div
            key={sq}
            onClick={() => {
              if (isPiece) setSelectedSquare(sq);
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

// ============================================================
// MoveHistoryGrid — with fork badges + popover
// ============================================================
function MoveHistoryGrid({ moves, playedCount, forks, openForkPly, setOpenForkPly }) {
  const t = useT();
  const forksByPly = new Map();
  for (const f of forks ?? []) forksByPly.set(f.ply_index, f);

  if (moves.length === 0) {
    return (
      <div style={{ padding: "8px 4px 12px", fontSize: 12, color: t.inkSoft, fontFamily: sans }}>
        No moves yet.
      </div>
    );
  }

  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: Math.floor(i / 2) + 1, wIdx: i, bIdx: i + 1 < moves.length ? i + 1 : null });
  }

  const cellStyle = (idx) => {
    const isPlayed = idx < playedCount;
    const isCurrent = idx === playedCount && idx < moves.length;
    return {
      fontWeight: isPlayed ? 600 : 500,
      padding: "4px 8px",
      color: isPlayed ? t.ink : t.inkSoft,
      background: isCurrent ? t.brandSoft : "transparent",
      borderRadius: 4,
      fontFamily: mono,
      fontSize: 13,
      textAlign: "left",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      position: "relative",
    };
  };

  const renderCell = (idx) => {
    const fork = forksByPly.get(idx);
    return (
      <div style={cellStyle(idx)}>
        <span>{moves[idx]}</span>
        {fork && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenForkPly(openForkPly === idx ? null : idx);
            }}
            title={fork.label}
            style={{
              marginLeft: 4,
              padding: 0,
              width: 14,
              height: 14,
              borderRadius: 999,
              background: t.amber,
              color: "#fff",
              border: "none",
              fontSize: 9,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              verticalAlign: "middle",
            }}
          >
            ⋔
          </button>
        )}
        {fork && openForkPly === idx && <ForkPopover fork={fork} />}
      </div>
    );
  };

  return (
    <div
      style={{
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
          {renderCell(r.wIdx)}
          {r.bIdx !== null ? renderCell(r.bIdx) : <div />}
        </div>
      ))}
    </div>
  );
}

function ForkPopover({ fork }) {
  const t = useT();
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: 4,
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 10,
        boxShadow: t.shadowMd,
        padding: 12,
        width: 280,
        zIndex: 50,
        fontFamily: sans,
        fontSize: 12.5,
        color: t.ink,
        textAlign: "left",
        whiteSpace: "normal",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 12, color: t.brand, marginBottom: 6 }}>{fork.label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {fork.alternatives.map((alt) => (
          <span
            key={alt}
            style={{
              padding: "2px 8px",
              background: t.surfaceAlt,
              borderRadius: 999,
              fontSize: 12,
              fontFamily: mono,
              color: t.ink,
            }}
          >
            {alt}
          </span>
        ))}
      </div>
      {fork.rationale && (
        <div style={{ fontSize: 12, color: t.inkDim, lineHeight: 1.45 }}>{fork.rationale}</div>
      )}
    </div>
  );
}

// ============================================================
// StrategicNotesPanel (src/ui/StrategicNotesPanel.tsx)
// ============================================================
function StrategicNotesPanel({ notes, open, onToggle }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "10px 14px",
          background: "transparent",
          border: "none",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          textAlign: "left",
          fontFamily: sans,
          fontSize: 13,
          fontWeight: 600,
          color: t.ink,
        }}
      >
        {open ? <ChevronDown size={14} color={t.inkDim} /> : <ChevronRight size={14} color={t.inkDim} />}
        <Lightbulb size={14} color={t.brand} />
        <span style={{ flex: 1 }}>Strategy</span>
        <span style={{ fontSize: 11, color: t.inkSoft, fontWeight: 500 }}>
          {notes.length === 0 ? "—" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
        </span>
      </button>
      {open && (
        <div
          style={{
            borderTop: `1px solid ${t.border}`,
            padding: "12px 14px",
            fontFamily: sans,
            fontSize: 13,
            color: t.ink,
            lineHeight: 1.5,
          }}
        >
          {notes.length === 0 ? (
            <span style={{ color: t.inkSoft, fontStyle: "italic" }}>No notes for this line yet.</span>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {notes.map((note, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {note}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// EndOfLineSummary (src/ui/EndOfLineSummary.tsx)
// ============================================================
function EndOfLineSummaryCard({ line, wrongAttempts, hintUses, durationSec, dueCount, nextLineName }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.brand}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: t.shadowMd,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <CheckCircle2 size={18} color={t.brand} />
        <span style={{ fontFamily: sans, fontWeight: 700, fontSize: 16, color: t.brand }}>Line complete</span>
      </div>
      <div style={{ fontFamily: sans, fontWeight: 600, fontSize: 15, color: t.ink, marginBottom: 12 }}>
        {line.name}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <SummaryStat label="Plies" value={String(line.depth)} />
        <SummaryStat label="Wrong" value={String(wrongAttempts)} accent={wrongAttempts === 0 ? t.brand : wrongAttempts >= 3 ? t.red : undefined} />
        <SummaryStat label="Hints" value={String(hintUses)} />
        <SummaryStat label="Time" value={`${durationSec}s`} />
      </div>

      {line.strategic_notes.length > 0 && (
        <div
          style={{
            background: t.surfaceAlt,
            borderRadius: 8,
            padding: 12,
            marginBottom: 14,
            fontFamily: sans,
            fontSize: 13,
            color: t.ink,
            lineHeight: 1.5,
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {line.strategic_notes.map((note, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          style={{
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.ink,
            padding: "8px 14px",
            borderRadius: 999,
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <RotateCw size={13} /> Restart
        </button>
        {dueCount > 0 && (
          <button
            style={{
              background: t.brand,
              color: "#fff",
              border: "none",
              padding: "8px 14px",
              borderRadius: 999,
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Calendar size={13} /> Drill {dueCount} due
          </button>
        )}
        {nextLineName && (
          <button
            style={{
              background: t.brandSoft,
              color: t.brand,
              border: "none",
              padding: "8px 14px",
              borderRadius: 999,
              fontFamily: sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Next: {nextLineName} <ChevronRight size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, accent }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surfaceAlt,
        borderRadius: 8,
        padding: "8px 10px",
        textAlign: "center",
        fontFamily: sans,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 700, color: accent ?? t.ink }}>{value}</div>
      <div style={{ fontSize: 10.5, color: t.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ============================================================
// Slick dropdown trigger + menu (mirrors src/pages/DrillPage)
// ============================================================
function PillTrigger({ label, open, onClick, prominent = false }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      style={{
        background: open ? t.surfaceAlt : t.surface,
        border: `1px solid ${open ? t.borderStrong : t.border}`,
        borderRadius: 999,
        padding: prominent ? "8px 16px 8px 18px" : "7px 14px 7px 16px",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontFamily: sans,
        color: t.ink,
        transition: "background 120ms ease, border-color 120ms ease",
        boxShadow: open ? t.shadow : "none",
      }}
    >
      <span
        style={{
          fontSize: prominent ? 17 : 14,
          fontWeight: 700,
          letterSpacing: prominent ? -0.3 : -0.1,
          color: t.ink,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <ChevronDown
        size={prominent ? 16 : 14}
        strokeWidth={2.4}
        style={{
          transition: "transform 150ms",
          transform: open ? "rotate(180deg)" : "rotate(0)",
          color: t.inkDim,
          marginLeft: 2,
        }}
      />
    </button>
  );
}

function SlickMenu({ placeholder, searchValue, onSearch, items, emptyHint }) {
  const t = useT();
  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        left: 0,
        width: 320,
        maxHeight: 480,
        overflowY: "auto",
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 14,
        boxShadow: t.shadowMd,
        padding: 6,
        zIndex: 60,
      }}
    >
      <div style={{ padding: 6, marginBottom: 4 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: t.surfaceAlt,
            borderRadius: 10,
            padding: "7px 11px",
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
        items.map((it) =>
          it.kind === "header" ? (
            <div
              key={it.key}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: t.inkSoft,
                textTransform: "uppercase",
                letterSpacing: 0.7,
                padding: "10px 12px 4px",
                fontFamily: sans,
              }}
            >
              {it.label}
            </div>
          ) : (
            <button
              key={it.key}
              onClick={it.onPick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px 10px 18px",
                width: "100%",
                background: "transparent",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: sans,
                color: it.isCurrent ? t.brand : t.ink,
                fontWeight: it.isCurrent ? 700 : 500,
                fontSize: 14.5,
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
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {it.label}
              </span>
            </button>
          )
        )
      )}
    </div>
  );
}

// ============================================================
// PROGRESS PAGE (src/pages/ProgressPage.tsx) — still placeholder
// ============================================================
function ProgressPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader title="Progress" subtitle="Period-filtered analytics arrive once session tracking lands." />
      <StateMessage
        icon={LineChart}
        title="Coming soon"
        body="Accuracy over time, drills per week, lines mastered per period — all derived from your local drill history."
      />
    </div>
  );
}

// ============================================================
// SETTINGS PAGE (src/pages/SettingsPage.tsx) — full picker set + danger zone
// ============================================================
function SettingsPage() {
  const t = useT();
  const [scheme, setScheme] = useState("light");
  const [boardTheme, setBoardTheme] = useState("auto");
  const [pieceSet, setPieceSet] = useState("classic");
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(70);
  const [preset, setPreset] = useState("intermediate");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetMessage, setResetMessage] = useState(null);

  const boardThemes = [
    { id: "auto", label: "Auto", light: "#F0D9B5", dark: "#B58863" },
    { id: "lichess", label: "Lichess", light: "#F0D9B5", dark: "#B58863" },
    { id: "blue", label: "Blue", light: "#DEE3E6", dark: "#8CA2AD" },
    { id: "green", label: "Green", light: "#EEEED2", dark: "#769656" },
    { id: "brown", label: "Brown", light: "#F0D9B5", dark: "#B58863" },
    { id: "wood", label: "Wood", light: "#E8C99B", dark: "#9D6B53" },
    { id: "slate", label: "Slate", light: "#E0E0E5", dark: "#5C6770" },
  ];
  const pieceSets = [
    { id: "classic", label: "Classic", description: "Library default — Wikimedia-style SVG." },
    { id: "letter", label: "Letter", description: "Algebraic letters (K, Q, R, B, N, P)." },
    { id: "unicode", label: "Unicode", description: "Chess figurine glyphs." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 720 }}>
      <PageHeader title="Settings" subtitle="Preferences and account." />

      {/* APPEARANCE */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans }}>Appearance</div>
            <div style={{ fontSize: 13, color: t.inkDim, marginTop: 4, fontFamily: sans }}>
              Switch between light and dark themes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant={scheme === "light" ? "primary" : "secondary"} onClick={() => setScheme("light")}>
              <Sun size={14} /> Light
            </Button>
            <Button variant={scheme === "dark" ? "primary" : "secondary"} onClick={() => setScheme("dark")}>
              <Moon size={14} /> Dark
            </Button>
          </div>
        </div>
      </Card>

      {/* BOARD THEME */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans, marginBottom: 4 }}>
          Board theme
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, marginBottom: 12 }}>
          Square colors. "Auto" follows your light/dark theme.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 8,
          }}
        >
          {boardThemes.map((opt) => {
            const isSel = opt.id === boardTheme;
            return (
              <button
                key={opt.id}
                onClick={() => setBoardTheme(opt.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: `1px solid ${isSel ? t.brand : t.border}`,
                  background: isSel ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  fontFamily: sans,
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 28,
                    height: 18,
                    borderRadius: 3,
                    background: `linear-gradient(to right, ${opt.light} 50%, ${opt.dark} 50%)`,
                    border: `1px solid ${t.border}`,
                    flexShrink: 0,
                  }}
                />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* PIECE SET */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans, marginBottom: 4 }}>Piece set</div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, marginBottom: 12 }}>
          Visual style of the chess pieces. Classic uses the library default; alt sets ship as scaffolds for testing.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {pieceSets.map((opt) => {
            const isSel = opt.id === pieceSet;
            return (
              <button
                key={opt.id}
                onClick={() => setPieceSet(opt.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 14px",
                  borderRadius: 6,
                  border: `1px solid ${isSel ? t.brand : t.border}`,
                  background: isSel ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  fontFamily: sans,
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  minWidth: 160,
                }}
              >
                <span>{opt.label}</span>
                <span style={{ fontSize: 11, color: t.inkDim, fontWeight: 400 }}>{opt.description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* SOUND */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans }}>Sound effects</div>
            <div style={{ fontSize: 13, color: t.inkDim, marginTop: 4, fontFamily: sans }}>
              Plays a tap on every move during drill.
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant={!muted ? "primary" : "secondary"} onClick={() => setMuted(false)}>
              <Volume2 size={14} /> On
            </Button>
            <Button variant={muted ? "primary" : "secondary"} onClick={() => setMuted(true)}>
              <VolumeX size={14} /> Off
            </Button>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            opacity: muted ? 0.4 : 1,
            pointerEvents: muted ? "none" : "auto",
          }}
        >
          <label style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, minWidth: 60 }}>Volume</label>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            disabled={muted}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ flex: 1, accentColor: t.brand }}
          />
          <span style={{ fontSize: 12, color: t.inkSoft, fontFamily: mono, minWidth: 36, textAlign: "right" }}>
            {volume}%
          </span>
          <button
            disabled={muted}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${t.border}`,
              background: t.surfaceAlt,
              color: t.ink,
              fontSize: 12,
              fontFamily: sans,
              cursor: muted ? "not-allowed" : "pointer",
            }}
          >
            Test
          </button>
        </div>
      </Card>

      {/* REPERTOIRE PRESET (phase-1c) */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans, marginBottom: 4 }}>
          Repertoire preset
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, marginBottom: 12 }}>
          Filter the Repertoire and Drill picker to a curated subset. Off shows everything.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            onClick={() => setPreset(null)}
            style={{
              padding: "10px 12px",
              borderRadius: 6,
              border: `1px solid ${preset === null ? t.brand : t.border}`,
              background: preset === null ? t.brandSoft : t.surfaceAlt,
              color: t.ink,
              fontFamily: sans,
              fontSize: 13,
              fontWeight: preset === null ? 600 : 500,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div>Off — show all</div>
            <div style={{ fontSize: 11, color: t.inkDim, marginTop: 2 }}>Browse the full catalog. No filter.</div>
          </button>
          {MOCK_PRESETS.map((p) => {
            const isSel = preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  border: `1px solid ${isSel ? t.brand : t.border}`,
                  background: isSel ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  fontFamily: sans,
                  fontSize: 13,
                  fontWeight: isSel ? 600 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>{p.name}</div>
                <div style={{ fontSize: 11, color: t.inkDim, marginTop: 2 }}>{p.description}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* DANGER ZONE (phase-1) */}
      <Card style={{ border: `1px solid ${t.red}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <AlertTriangle size={15} color={t.red} />
          <div style={{ fontWeight: 600, fontSize: 14, color: t.red, fontFamily: sans }}>Danger Zone</div>
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, marginBottom: 14 }}>
          Wipes spaced-repetition progress for every line. Cannot be undone.
        </div>
        {!confirmReset ? (
          <Button variant="secondary" onClick={() => setConfirmReset(true)}>
            Reset all SRS progress ({MOCK_SRS_STATES.size} records)
          </Button>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: t.ink, fontFamily: sans }}>
              Delete {MOCK_SRS_STATES.size} records?
            </span>
            <Button
              variant="primary"
              onClick={() => {
                setResetMessage("All SRS progress cleared.");
                setConfirmReset(false);
              }}
            >
              Yes, reset
            </Button>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        )}
        {resetMessage && (
          <div style={{ fontSize: 12, color: t.inkDim, fontFamily: sans, marginTop: 10 }}>{resetMessage}</div>
        )}
      </Card>

      {/* ABOUT */}
      <Card>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink, fontFamily: sans, marginBottom: 8 }}>About</div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: sans, lineHeight: 1.5 }}>
          tabiya — chess opening drill trainer. Phase 1c.
          <br />
          Catalog data from{" "}
          <a href="https://github.com/lichess-org/chess-openings" style={{ color: t.brand }}>
            lichess-org/chess-openings
          </a>{" "}
          and the Lichess Masters Opening Explorer.
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// APP SHELL — full tour: render every route stacked vertically
// so reviewers can scroll the entire current UI in one document.
// ============================================================
export default function CurrentImplementedApp() {
  const [active, setActive] = useState("dashboard");
  const [isDark, setIsDark] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const titles = {
    dashboard: { title: "Dashboard", breadcrumb: "" },
    repertoire: { title: "Repertoire", breadcrumb: "" },
    gambits: { title: "Gambits", breadcrumb: "Repertoire" },
    drill: { title: "", breadcrumb: "" },
    progress: { title: "Progress", breadcrumb: "" },
    settings: { title: "Settings", breadcrumb: "" },
  };
  const meta = titles[active] ?? { title: "" };

  const dueCount = MOCK_DUE_LINE_IDS.length;

  // The reviewer can pick any page via the sidebar, but for full visual review
  // we render every page stacked below. Sidebar controls only the highlighted
  // route — content always streams the full tour.
  return (
    <T.Provider value={theme}>
      <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.ink }}>
        <Sidebar
          active={active}
          setActive={setActive}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          dueCount={dueCount}
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
            <div style={{ fontFamily: sans, fontSize: 12, color: "#78716C", marginBottom: 8 }}>
              SNAPSHOT 2026-05-15 · full tour below. Sidebar highlights the
              "current" route purely as a chrome demo — every page renders in
              sequence so a reviewer can scroll the whole UI.
            </div>

            <SectionDivider label="/ — Dashboard" sub="Real SRS stats (mastered %, due count, drilled lines). Empty state included below." />
            <DashboardPage />

            <SectionDivider label="/repertoire — Repertoire (family-grouped)" sub="phase-0d.3 family cards · phase-1c preset filter · per-line ↺ reset · tier 2 badge · gambits cross-cut link." />
            <RepertoirePage />

            <SectionDivider label="/repertoire/gambits — Gambits cross-cut" sub="Lists every opening flagged is_gambit, regardless of family." />
            <GambitsPage />

            <SectionDivider label="/drill — Drill (normal mode)" sub="2-col grid · pill dropdowns · strategic notes (open) · fork badge at ply 5 with popover open · Box pill in breadcrumb · per-line ↺ via Repertoire." />
            <DrillPage queueMode={false} showSummary={false} />

            <SectionDivider label="/drill?queue=due — Drill (queue mode)" sub="QUEUE 2/4 ✕ chip · auto-advances 800ms after completion · exits to /repertoire on click." />
            <DrillPage queueMode={true} showSummary={false} />

            <SectionDivider label="/drill — End-of-line summary state" sub="Shown only in non-queue mode when drill completes: Plies / Wrong / Hints / Time + Restart / Drill due / Next in family." />
            <DrillPage queueMode={false} showSummary={true} />

            <SectionDivider label="/progress — Progress" sub="Still a placeholder. Period filters + accuracy chart gated on session-event log (Phase 1.5)." />
            <ProgressPage />

            <SectionDivider label="/settings — Settings" sub="Appearance · Board theme (7 presets) · Piece set (3 presets) · Sound · Repertoire preset · Danger zone · About." />
            <SettingsPage />
          </main>
        </div>
      </div>
    </T.Provider>
  );
}
