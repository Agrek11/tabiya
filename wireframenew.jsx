import { useState, createContext, useContext, useEffect, useRef } from "react";
import {
  Library,
  Settings as SettingsIcon,
  Target,
  Sun,
  Moon,
  Menu,
  X as XIcon,
  ChevronDown,
  Check,
  Lightbulb,
  RotateCcw,
  Plus,
  Inbox,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  Info,
  CornerDownLeft,
} from "lucide-react";

/* ===========================================================
   matedrill v2 — focus mode, reduced tokens, mobile responsive
   =========================================================== */

/* ---------- design tokens ---------- */
const lightTheme = {
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
  red: "#DC2626",
  redSoft: "#FEE2E2",
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
};

const darkTheme = {
  bg: "#0F0F11",
  surface: "#18181B",
  surfaceAlt: "#27272A",
  border: "#2A2A2E",
  borderStrong: "#3F3F46",
  ink: "#FAFAFA",
  inkDim: "#A1A1AA",
  inkSoft: "#71717A",
  brand: "#10B981",
  brandSoft: "#064E3B",
  brandHover: "#34D399",
  red: "#EF4444",
  redSoft: "#450A0A",
  shadow: "0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.4)",
};

// Spacing scale: only 8 / 12 / 16 / 24
const SP = { 1: 8, 2: 12, 3: 16, 4: 24 };
// Radius: only 12 (cards/panels) and 6 (chips/buttons)
const R = { card: 12, chip: 6 };
// Typography: 30 / 22 / 16 / 13 / 11
const T = { title: 30, section: 22, body: 16, meta: 13, micro: 11 };

const sans = `'Plus Jakarta Sans', system-ui, sans-serif`;
const mono = `'JetBrains Mono', ui-monospace, monospace`;

const ThemeContext = createContext(lightTheme);
const useT = () => useContext(ThemeContext);

/* ---------- chess data ---------- */
const PIECE = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

// Sicilian Najdorf after 5...a6
const NAJDORF = {
  a8: "r", b8: "n", c8: "b", d8: "q", e8: "k", f8: "b", h8: "r",
  f6: "n",
  a6: "p", b7: "p", d6: "p", e7: "p", f7: "p", g7: "p", h7: "p",
  c3: "N", d4: "N",
  a2: "P", b2: "P", c2: "P", e4: "P", f2: "P", g2: "P", h2: "P",
  a1: "R", c1: "B", d1: "Q", e1: "K", f1: "B", h1: "R",
};

// Wrong-move demo: pretend user dropped white knight on e2 incorrectly
const NAJDORF_WRONG = {
  ...NAJDORF,
  c3: undefined,
  e2: "N", // wrong square
};

const SICILIAN_LINES = [
  { name: "Najdorf — English Attack", eco: "B90", mastery: 75 },
  { name: "Najdorf — 6.Bg5 Main Line", eco: "B96", mastery: 50 },
  { name: "Najdorf — 6.Be2 Classical", eco: "B92", mastery: 100 },
  { name: "Sveshnikov Variation", eco: "B33", mastery: 48 },
  { name: "Dragon — Yugoslav Attack", eco: "B78", mastery: 78 },
  { name: "Dragon — Classical", eco: "B72", mastery: 100 },
  { name: "Taimanov Variation", eco: "B44", mastery: 71 },
  { name: "Kan Variation", eco: "B41", mastery: 73 },
  { name: "Scheveningen", eco: "B80", mastery: 100 },
  { name: "Classical Sicilian", eco: "B58", mastery: 80 },
  { name: "Smith-Morra Gambit", eco: "B21", mastery: 100 },
  { name: "Alapin Variation", eco: "B22", mastery: 60 },
  { name: "Closed Sicilian", eco: "B23", mastery: 36 },
  { name: "Grand Prix Attack", eco: "B23", mastery: 0 },
];

const OPENINGS = [
  { name: "Sicilian Defense", side: "black", lines: 14, eco: "B20–B99" },
  { name: "French Defense", side: "black", lines: 8, eco: "C00–C19" },
  { name: "Caro-Kann", side: "black", lines: 6, eco: "B10–B19" },
  { name: "Italian Game", side: "white", lines: 11, eco: "C50–C54" },
  { name: "King's Indian Defense", side: "black", lines: 9, eco: "E60–E99" },
  { name: "London System", side: "white", lines: 7, eco: "D02" },
  { name: "Catalan Opening", side: "white", lines: 6, eco: "E00–E09" },
  { name: "Ruy López — Berlin", side: "white", lines: 5, eco: "C65" },
];

/* ---------- hooks ---------- */
function useClickOutside(handler) {
  const ref = useRef(null);
  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) handler();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [handler]);
  return ref;
}

/* ---------- chess board ---------- */
function ChessBoard({ position = NAJDORF, lastMove = ["a7", "a6"], wrongSquare, dark, completePulse }) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const lightSq = dark ? "#D6CCAB" : "#EBECD0";
  const darkSq = dark ? "#5C7345" : "#779556";

  return (
    <div
      className={completePulse ? "board-pulse" : ""}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        aspectRatio: "1 / 1",
        width: "100%",
        borderRadius: R.card,
        overflow: "hidden",
        boxShadow: dark
          ? "0 2px 6px rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.4)"
          : "0 2px 6px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08)",
      }}
    >
      {ranks.map((r) =>
        files.map((f) => {
          const sq = `${f}${r}`;
          const isLight = (files.indexOf(f) + r) % 2 === 1;
          const piece = position[sq];
          const isLast = lastMove?.includes(sq);
          const isWrong = wrongSquare === sq;
          return (
            <div
              key={sq}
              style={{
                position: "relative",
                background: isLight ? lightSq : darkSq,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "min(8vw, 56px)",
                color: piece && piece === piece.toUpperCase() ? "#FFFFFF" : "#262626",
                textShadow:
                  piece && piece === piece.toUpperCase()
                    ? "0 1px 1px rgba(0,0,0,0.4)"
                    : "none",
              }}
            >
              {isLast && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255, 235, 59, 0.4)",
                  }}
                />
              )}
              {isWrong && (
                <div
                  style={{
                    position: "absolute",
                    inset: 4,
                    border: `4px solid ${dark ? "#EF4444" : "#DC2626"}`,
                    borderRadius: 6,
                    boxShadow: "0 0 0 2px rgba(220, 38, 38, 0.25)",
                    pointerEvents: "none",
                  }}
                />
              )}
              {f === "a" && (
                <span
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 2,
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 600,
                    color: isLight ? darkSq : lightSq,
                  }}
                >
                  {r}
                </span>
              )}
              {r === 1 && (
                <span
                  style={{
                    position: "absolute",
                    right: 4,
                    bottom: 2,
                    fontFamily: mono,
                    fontSize: 10,
                    fontWeight: 600,
                    color: isLight ? darkSq : lightSq,
                  }}
                >
                  {f}
                </span>
              )}
              <span style={{ position: "relative", lineHeight: 1 }}>
                {piece ? PIECE[piece] : ""}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ---------- sidebar ---------- */
function Sidebar({ active, setActive, mobileOpen, setMobileOpen }) {
  const t = useT();
  const items = [
    { id: "drill", label: "Drill", icon: Target },
    { id: "openings", label: "Openings", icon: Library },
  ];

  return (
    <>
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="mobile-backdrop"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 99,
            animation: "fadeIn 200ms",
          }}
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? "open" : ""}`}
        style={{
          width: 240,
          flexShrink: 0,
          background: t.surface,
          borderRight: `1px solid ${t.border}`,
          padding: SP[2],
          display: "flex",
          flexDirection: "column",
          gap: SP[3],
        }}
      >
        {/* logo + mobile close */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${SP[1]}px`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: SP[1] + 2 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: t.brand,
                borderRadius: R.chip,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 19,
                color: "#FFF",
              }}
            >
              ♞
            </div>
            <div style={{ fontWeight: 700, fontSize: T.body, letterSpacing: -0.3, color: t.ink }}>
              matedrill
            </div>
          </div>
          <button
            className="mobile-close"
            onClick={() => setMobileOpen(false)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: t.inkDim,
              padding: 4,
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((it) => {
            const Icon = it.icon;
            const isActive = active === it.id;
            return (
              <button
                key={it.id}
                onClick={() => {
                  setActive(it.id);
                  setMobileOpen(false);
                }}
                className="nav-item"
                style={{
                  background: isActive ? t.brandSoft : "transparent",
                  color: isActive ? t.brand : t.ink,
                  border: "none",
                  borderRadius: R.chip,
                  padding: `${SP[1] + 2}px ${SP[2]}px`,
                  display: "flex",
                  alignItems: "center",
                  gap: SP[2],
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: sans,
                  fontSize: T.body - 2,
                  fontWeight: isActive ? 600 : 500,
                  width: "100%",
                }}
              >
                <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                {it.label}
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        {/* settings cog footer */}
        <button
          onClick={() => {
            setActive("settings");
            setMobileOpen(false);
          }}
          className="nav-item"
          style={{
            background: active === "settings" ? t.brandSoft : "transparent",
            color: active === "settings" ? t.brand : t.inkDim,
            border: "none",
            borderRadius: R.chip,
            padding: `${SP[1] + 2}px ${SP[2]}px`,
            display: "flex",
            alignItems: "center",
            gap: SP[2],
            cursor: "pointer",
            textAlign: "left",
            fontFamily: sans,
            fontSize: T.body - 2,
            fontWeight: 500,
            width: "100%",
          }}
        >
          <SettingsIcon size={17} strokeWidth={2} />
          Settings
        </button>
      </aside>
    </>
  );
}

/* ---------- topbar ---------- */
function TopBar({ breadcrumb, isDark, setIsDark, onMenuClick }) {
  const t = useT();
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${t.border}`,
        background: t.surface,
        display: "flex",
        alignItems: "center",
        padding: `0 ${SP[3]}px`,
        gap: SP[2],
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <button
        onClick={onMenuClick}
        className="hamburger"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: t.inkDim,
          padding: SP[1],
          display: "none",
        }}
      >
        <Menu size={20} />
      </button>

      <div
        style={{
          fontSize: T.micro,
          color: t.inkDim,
          fontWeight: 500,
          flex: 1,
          letterSpacing: 0.2,
        }}
      >
        {breadcrumb}
      </div>

      <button
        onClick={() => setIsDark(!isDark)}
        className="icon-btn"
        aria-label="Toggle theme"
        style={{
          width: 36,
          height: 36,
          background: "transparent",
          border: `1px solid ${t.border}`,
          borderRadius: R.chip,
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

/* ---------- shared bits ---------- */
function Chip({ children, onClick, active, disabled, danger }) {
  const t = useT();
  const bg = active
    ? t.brandSoft
    : danger
    ? t.redSoft
    : "transparent";
  const fg = active ? t.brand : danger ? t.red : t.ink;
  const bd = active ? t.brand + "33" : t.border;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="chip-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: SP[1] - 2,
        padding: `${SP[1] - 2}px ${SP[2]}px`,
        background: bg,
        color: fg,
        border: `1px solid ${bd}`,
        borderRadius: R.chip,
        fontSize: T.meta,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: sans,
      }}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ children, onClick, fullWidth }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      style={{
        background: t.brand,
        color: "#FFF",
        border: "none",
        borderRadius: R.chip,
        padding: `${SP[1] + 2}px ${SP[3]}px`,
        fontFamily: sans,
        fontSize: T.meta,
        fontWeight: 600,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: SP[1] - 2,
        width: fullWidth ? "100%" : "auto",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- empty / loading / error states ---------- */
function StateMessage({ icon: Icon, title, body, action, iconColor }) {
  const t = useT();
  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: R.card,
        padding: SP[4] * 2,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: SP[2],
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: R.chip,
          background: t.surfaceAlt,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: iconColor || t.inkDim,
          marginBottom: SP[1],
        }}
      >
        <Icon size={22} />
      </div>
      <div style={{ fontSize: T.section, fontWeight: 700, color: t.ink, letterSpacing: -0.3 }}>{title}</div>
      <div style={{ fontSize: T.meta, color: t.inkDim, maxWidth: 360 }}>{body}</div>
      {action}
    </div>
  );
}

function Skeleton({ height, width = "100%", radius = R.chip }) {
  const t = useT();
  return (
    <div
      className="skeleton"
      style={{
        height,
        width,
        borderRadius: radius,
        background: t.surfaceAlt,
      }}
    />
  );
}

/* ============================================================
   DRILL PAGE
   ============================================================ */
function DrillPage({ demoState, setDemoState }) {
  const t = useT();
  const isDark = t.bg === darkTheme.bg;
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const lineMenuRef = useClickOutside(() => setLineMenuOpen(false));
  const currentLine = SICILIAN_LINES[currentLineIdx];

  const moves = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"];

  // ---- non-normal states ----
  if (demoState === "loading") return <DrillLoading />;
  if (demoState === "error") return <DrillError onRetry={() => setDemoState("playing")} />;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: SP[3],
        maxWidth: 760,
        margin: "0 auto",
        position: "relative",
      }}
    >
      {/* Title row: line switcher + ECO subtitle */}
      <div>
        <div ref={lineMenuRef} style={{ position: "relative", display: "inline-block" }}>
          <button
            onClick={() => setLineMenuOpen((v) => !v)}
            className="line-switcher"
            style={{
              background: lineMenuOpen ? t.surfaceAlt : "transparent",
              border: `1px solid ${lineMenuOpen ? t.border : "transparent"}`,
              padding: `${SP[1] / 2}px ${SP[2]}px ${SP[1] / 2}px ${SP[1] / 2}px`,
              marginLeft: -SP[1] / 2,
              borderRadius: R.chip,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: SP[1],
              fontFamily: sans,
              color: t.ink,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: T.section,
                fontWeight: 700,
                letterSpacing: -0.4,
              }}
            >
              {currentLine.name}
            </h1>
            <ChevronDown
              size={18}
              strokeWidth={2.4}
              style={{
                transition: "transform 150ms",
                transform: lineMenuOpen ? "rotate(180deg)" : "rotate(0)",
                color: t.inkDim,
              }}
            />
          </button>

          {lineMenuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                width: 360,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: 420,
                overflowY: "auto",
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: R.card,
                boxShadow: t.shadow,
                padding: SP[1] - 2,
                zIndex: 50,
              }}
            >
              <div
                style={{
                  padding: `${SP[1]}px ${SP[2]}px`,
                  fontSize: T.micro,
                  fontWeight: 600,
                  color: t.inkSoft,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  borderBottom: `1px solid ${t.border}`,
                  marginBottom: 4,
                }}
              >
                {SICILIAN_LINES.length} lines · Sicilian Defense
              </div>
              {SICILIAN_LINES.map((line, i) => {
                const isCurrent = i === currentLineIdx;
                const mastered = line.mastery >= 70;
                return (
                  <button
                    key={line.name}
                    onClick={() => {
                      setCurrentLineIdx(i);
                      setLineMenuOpen(false);
                    }}
                    className="nav-item"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: SP[2],
                      padding: `${SP[1] + 2}px ${SP[2]}px`,
                      width: "100%",
                      background: isCurrent ? t.surfaceAlt : "transparent",
                      border: "none",
                      borderRadius: R.chip,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: sans,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: SP[1] }}>
                      <span style={{ fontSize: T.meta, fontWeight: 600, color: t.ink }}>{line.name}</span>
                      {isCurrent && <Check size={13} color={t.brand} strokeWidth={3} />}
                    </div>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: T.micro,
                        color: t.inkSoft,
                      }}
                    >
                      {line.eco}
                    </span>
                    <span
                      style={{
                        background: mastered ? t.brandSoft : t.surfaceAlt,
                        color: mastered ? t.brand : t.inkDim,
                        fontSize: T.micro,
                        fontWeight: 700,
                        padding: `2px ${SP[1]}px`,
                        borderRadius: R.chip,
                        fontFamily: mono,
                        minWidth: 36,
                        textAlign: "center",
                      }}
                    >
                      {line.mastery}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: T.micro,
            color: t.inkDim,
            marginTop: 4,
            fontFamily: mono,
            letterSpacing: 0.2,
          }}
        >
          {currentLine.eco} · As White
        </div>
      </div>

      {/* HERO BOARD */}
      <div className="board-wrap" style={{ width: "100%", position: "relative" }}>
        <ChessBoard
          dark={isDark}
          position={demoState === "wrong" ? NAJDORF_WRONG : NAJDORF}
          wrongSquare={demoState === "wrong" ? "e2" : undefined}
          completePulse={demoState === "complete"}
        />
        {demoState === "complete" && <Confetti />}
      </div>

      {/* Move counter (small, inline below board) */}
      <div
        style={{
          fontSize: T.micro,
          color: t.inkSoft,
          textAlign: "center",
          fontFamily: mono,
          marginTop: -SP[1],
        }}
      >
        Move 6 of 12
      </div>

      {/* Status strip */}
      <StatusStrip state={demoState} />

      {/* Keyboard caption */}
      <div
        style={{
          fontSize: T.micro,
          color: t.inkSoft,
          textAlign: "center",
          fontFamily: mono,
          letterSpacing: 0.3,
        }}
      >
        ← back · → forward · H hint · R restart
      </div>

      {/* Move history disclosure */}
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: R.card,
        }}
      >
        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="nav-item"
          style={{
            background: "transparent",
            border: "none",
            width: "100%",
            padding: `${SP[2]}px ${SP[3]}px`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: SP[1],
            fontFamily: sans,
            fontSize: T.meta,
            fontWeight: 500,
            color: t.ink,
            textAlign: "left",
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
          <span style={{ color: t.inkSoft, fontFamily: mono }}>({moves.length})</span>
        </button>
        {historyOpen && (
          <div
            style={{
              padding: `${SP[2]}px ${SP[3]}px ${SP[3]}px`,
              borderTop: `1px solid ${t.border}`,
              fontFamily: mono,
              fontSize: T.meta,
              color: t.ink,
              lineHeight: 2,
            }}
          >
            {moves.map((m, i) => (
              <span key={i}>
                {i % 2 === 0 && (
                  <span style={{ color: t.inkSoft, marginLeft: i > 0 ? SP[1] : 0 }}>
                    {Math.floor(i / 2) + 1}.
                  </span>
                )}
                <span style={{ marginLeft: 4, fontWeight: 500 }}>{m}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusStrip({ state }) {
  const t = useT();
  const isWrong = state === "wrong";
  const isComplete = state === "complete";

  let label, color;
  if (isWrong) {
    label = "Wrong — press ← to retry";
    color = t.red;
  } else if (isComplete) {
    label = "Line complete — restarting in 2s…";
    color = t.brand;
  } else {
    label = "Your move · White";
    color = t.ink;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: SP[2],
        padding: `${SP[2]}px ${SP[3]}px`,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          fontSize: T.body,
          fontWeight: 600,
          color,
          flex: "1 1 auto",
          textAlign: "center",
          minWidth: 220,
        }}
      >
        {label}
      </div>
      <Chip disabled={isComplete}>
        <Lightbulb size={14} /> Hint
      </Chip>
      <Chip disabled={isComplete}>
        <RotateCcw size={14} /> Restart
      </Chip>
    </div>
  );
}

function DrillLoading() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: SP[3] }}>
      <Skeleton height={28} width={260} />
      <Skeleton height={14} width={120} />
      <Skeleton height={560} radius={R.card} />
      <Skeleton height={20} width={120} />
      <Skeleton height={48} radius={R.card} />
    </div>
  );
}

function DrillError({ onRetry }) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", paddingTop: SP[4] }}>
      <StateMessage
        icon={AlertTriangle}
        iconColor={"#DC2626"}
        title="Couldn't load this line"
        body="Something went wrong fetching the position. Check your connection and try again."
        action={
          <PrimaryBtn onClick={onRetry}>
            <RefreshCw size={14} /> Retry
          </PrimaryBtn>
        }
      />
    </div>
  );
}

function Confetti() {
  const t = useT();
  const colors = [t.brand, t.brandHover, "#86EFAC"];
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        borderRadius: R.card,
      }}
    >
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            position: "absolute",
            top: -20,
            left: `${(i * 9301 + 49297) % 100}%`,
            width: 6 + (i % 3) * 2,
            height: 10 + (i % 4) * 2,
            background: colors[i % colors.length],
            animation: `fall 1.6s ${(i * 0.05).toFixed(2)}s ease-in forwards`,
            transform: `rotate(${(i * 47) % 360}deg)`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

/* ============================================================
   OPENINGS PAGE
   ============================================================ */
function OpeningsPage({ demoState, onOpen }) {
  const t = useT();
  const [filter, setFilter] = useState("all");

  if (demoState === "loading") return <OpeningsLoading />;
  if (demoState === "error")
    return (
      <StateMessage
        icon={AlertTriangle}
        iconColor={t.red}
        title="Couldn't load your repertoire"
        body="The opening catalog failed to load. Try again."
        action={
          <PrimaryBtn>
            <RefreshCw size={14} /> Retry
          </PrimaryBtn>
        }
      />
    );
  if (demoState === "empty")
    return (
      <StateMessage
        icon={Inbox}
        title="No openings yet"
        body="Add your first opening to start building your repertoire. You'll be able to drill every line within it."
        action={
          <PrimaryBtn>
            <Plus size={14} strokeWidth={2.5} /> Add your first opening
          </PrimaryBtn>
        }
      />
    );

  const filtered = filter === "all" ? OPENINGS : OPENINGS.filter((o) => o.side === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP[3] }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: SP[2],
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: T.title,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.6,
          }}
        >
          Openings
        </h1>
        <PrimaryBtn>
          <Plus size={14} strokeWidth={2.5} /> Add opening
        </PrimaryBtn>
      </div>

      {/* tabs */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderBottom: `1px solid ${t.border}`,
          overflowX: "auto",
        }}
      >
        {[
          { id: "all", label: "All" },
          { id: "white", label: "As White" },
          { id: "black", label: "As Black" },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                background: "transparent",
                border: "none",
                padding: `${SP[1] + 2}px ${SP[2]}px`,
                fontFamily: sans,
                fontSize: T.meta,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? t.ink : t.inkDim,
                cursor: "pointer",
                borderBottom: `2px solid ${isActive ? t.brand : "transparent"}`,
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="openings-grid">
        {filtered.map((o) => (
          <OpeningCard key={o.name} opening={o} onClick={() => onOpen(o)} />
        ))}
      </div>
    </div>
  );
}

function OpeningCard({ opening, onClick }) {
  const t = useT();
  return (
    <div
      onClick={onClick}
      className="opening-card"
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: R.card,
        padding: SP[3],
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: SP[2],
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: SP[1],
        }}
      >
        <span
          style={{
            fontFamily: mono,
            fontSize: T.micro,
            color: t.inkDim,
            fontWeight: 600,
            background: t.surfaceAlt,
            padding: `2px ${SP[1] - 2}px`,
            borderRadius: R.chip,
          }}
        >
          {opening.eco}
        </span>
        <span
          style={{
            fontSize: T.micro,
            color: t.inkDim,
            fontWeight: 500,
          }}
        >
          As {opening.side === "white" ? "White ♔" : "Black ♚"}
        </span>
      </div>
      <h3
        style={{
          fontSize: T.body,
          fontWeight: 700,
          margin: 0,
          color: t.ink,
          letterSpacing: -0.2,
        }}
      >
        {opening.name}
      </h3>
      <div
        style={{
          fontSize: T.meta,
          color: t.inkDim,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>{opening.lines} lines</span>
        <span style={{ color: t.brand, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}>
          Drill →
        </span>
      </div>
    </div>
  );
}

function OpeningsLoading() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP[3] }}>
      <Skeleton height={36} width={180} />
      <Skeleton height={32} width={300} />
      <div className="openings-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              borderRadius: R.card,
              padding: SP[3],
              background: "transparent",
              border: `1px solid transparent`,
              display: "flex",
              flexDirection: "column",
              gap: SP[2],
            }}
          >
            <Skeleton height={16} width={80} />
            <Skeleton height={20} width="80%" />
            <Skeleton height={14} width="60%" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   SETTINGS PAGE
   ============================================================ */
function SettingsPage({ isDark, setIsDark }) {
  const t = useT();

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: SP[3] }}>
      <h1
        style={{
          margin: 0,
          fontSize: T.title,
          fontWeight: 700,
          color: t.ink,
          letterSpacing: -0.6,
        }}
      >
        Settings
      </h1>

      <SettingsSection label="Appearance">
        <SettingsRow label="Theme" hint="Light or dark across the app">
          <div
            style={{
              display: "inline-flex",
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: R.chip,
              padding: 3,
            }}
          >
            <button
              onClick={() => setIsDark(false)}
              style={{
                background: !isDark ? t.surfaceAlt : "transparent",
                border: "none",
                borderRadius: R.chip - 2,
                padding: `${SP[1] - 2}px ${SP[2]}px`,
                cursor: "pointer",
                color: !isDark ? t.ink : t.inkDim,
                fontFamily: sans,
                fontSize: T.meta,
                fontWeight: !isDark ? 600 : 500,
                display: "inline-flex",
                alignItems: "center",
                gap: SP[1] - 2,
              }}
            >
              <Sun size={14} /> Light
            </button>
            <button
              onClick={() => setIsDark(true)}
              style={{
                background: isDark ? t.surfaceAlt : "transparent",
                border: "none",
                borderRadius: R.chip - 2,
                padding: `${SP[1] - 2}px ${SP[2]}px`,
                cursor: "pointer",
                color: isDark ? t.ink : t.inkDim,
                fontFamily: sans,
                fontSize: T.meta,
                fontWeight: isDark ? 600 : 500,
                display: "inline-flex",
                alignItems: "center",
                gap: SP[1] - 2,
              }}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection label="About">
        <SettingsRow label="App" hint="matedrill — focused chess opening drills" />
        <SettingsRow label="Version">
          <span style={{ fontFamily: mono, fontSize: T.meta, color: t.inkDim }}>2.0.0</span>
        </SettingsRow>
        <SettingsRow label="Build" last>
          <span style={{ fontFamily: mono, fontSize: T.meta, color: t.inkDim }}>2026.05.03</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({ label, children }) {
  const t = useT();
  return (
    <div>
      <div
        style={{
          fontSize: T.micro,
          fontWeight: 600,
          color: t.inkDim,
          letterSpacing: 0.6,
          textTransform: "uppercase",
          marginBottom: SP[1],
          paddingLeft: SP[1],
        }}
      >
        {label}
      </div>
      <div
        style={{
          background: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: R.card,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, hint, children, last }) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${SP[2]}px ${SP[3]}px`,
        borderBottom: last ? "none" : `1px solid ${t.border}`,
        gap: SP[3],
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: T.body - 2, fontWeight: 600, color: t.ink }}>{label}</div>
        {hint && <div style={{ fontSize: T.micro, color: t.inkDim, marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

/* ---------- wireframe state demo bar (would be removed in prod) ---------- */
function StateBar({ states, value, onChange }) {
  const t = useT();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: SP[1],
        padding: `${SP[1]}px ${SP[2]}px`,
        background: t.surfaceAlt,
        border: `1px dashed ${t.borderStrong}`,
        borderRadius: R.chip,
        marginBottom: SP[3],
        flexWrap: "wrap",
        fontFamily: sans,
      }}
    >
      <span
        style={{
          fontSize: T.micro,
          fontWeight: 600,
          color: t.inkDim,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          marginRight: SP[1],
        }}
      >
        Wireframe state
      </span>
      {states.map((s) => {
        const isActive = value === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            style={{
              background: isActive ? t.surface : "transparent",
              border: `1px solid ${isActive ? t.borderStrong : "transparent"}`,
              padding: `${SP[1] - 4}px ${SP[1]}px`,
              borderRadius: R.chip - 2,
              fontSize: T.micro,
              fontWeight: 500,
              color: isActive ? t.ink : t.inkDim,
              cursor: "pointer",
              fontFamily: sans,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

/* ============================================================
   ROOT
   ============================================================ */
export default function ChessDrillApp() {
  const [active, setActive] = useState("drill");
  const [isDark, setIsDark] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [drillState, setDrillState] = useState("playing");
  const [openingsState, setOpeningsState] = useState("normal");

  const t = isDark ? darkTheme : lightTheme;

  // Simulate auto-restart for the complete state demo
  useEffect(() => {
    if (drillState === "complete") {
      const timer = setTimeout(() => setDrillState("playing"), 2000);
      return () => clearTimeout(timer);
    }
  }, [drillState]);

  let breadcrumb;
  if (active === "drill") breadcrumb = "Repertoire / Sicilian Defense";
  else if (active === "openings") breadcrumb = "Repertoire";
  else breadcrumb = "Settings";

  return (
    <ThemeContext.Provider value={t}>
      <div
        style={{
          background: t.bg,
          color: t.ink,
          fontFamily: sans,
          minHeight: "100vh",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
          body { margin: 0; }
          button { transition: opacity 120ms, transform 80ms, background 120ms, border-color 120ms; }
          button:hover { opacity: 0.92; }
          button:active { transform: translateY(1px); }
          .nav-item:hover { background: ${t.surfaceAlt} !important; }
          .opening-card:hover { border-color: ${t.borderStrong} !important; box-shadow: ${t.shadow}; transform: translateY(-1px); }
          .icon-btn:hover { border-color: ${t.borderStrong}; }
          .line-switcher:hover { background: ${t.surfaceAlt} !important; border-color: ${t.border} !important; }
          .chip-btn:hover { background: ${t.surfaceAlt} !important; }
          input::placeholder { color: ${t.inkSoft}; }

          .openings-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: ${SP[2]}px;
          }

          .skeleton {
            position: relative;
            overflow: hidden;
          }
          .skeleton::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(90deg, transparent, ${t.border}80, transparent);
            animation: shimmer 1.6s infinite;
          }

          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes shimmer { from { transform: translateX(-100%) } to { transform: translateX(100%) } }
          @keyframes fall {
            to { transform: translateY(120vh) rotate(720deg); opacity: 0; }
          }
          @keyframes pulse-brand {
            0%, 100% { box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08); }
            50% { box-shadow: 0 0 0 6px ${t.brandSoft}, 0 12px 32px rgba(0,0,0,0.08); }
          }
          .board-pulse { animation: pulse-brand 1.4s ease-in-out infinite; }

          .mobile-close { display: none; }
          .hamburger { display: none !important; }

          @media (max-width: 767px) {
            .sidebar {
              position: fixed !important;
              left: 0;
              top: 0;
              bottom: 0;
              z-index: 100;
              transform: translateX(-100%);
              transition: transform 220ms ease-out;
              box-shadow: ${t.shadow};
            }
            .sidebar.open { transform: translateX(0); }
            .mobile-close { display: flex !important; }
            .hamburger { display: flex !important; }
            .openings-grid { grid-template-columns: 1fr !important; }
          }

          @media (min-width: 768px) and (max-width: 1023px) {
            .openings-grid { grid-template-columns: repeat(2, 1fr) !important; }
          }
        `}</style>

        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar
            active={active}
            setActive={setActive}
            mobileOpen={mobileNavOpen}
            setMobileOpen={setMobileNavOpen}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <TopBar
              breadcrumb={breadcrumb}
              isDark={isDark}
              setIsDark={setIsDark}
              onMenuClick={() => setMobileNavOpen(true)}
            />
            <main
              style={{
                flex: 1,
                padding: SP[4],
                overflow: "auto",
              }}
            >
              {active === "drill" && (
                <>
                  <StateBar
                    value={drillState}
                    onChange={setDrillState}
                    states={[
                      { id: "playing", label: "Playing" },
                      { id: "wrong", label: "Wrong move" },
                      { id: "complete", label: "Complete" },
                      { id: "loading", label: "Loading" },
                      { id: "error", label: "Error" },
                    ]}
                  />
                  <DrillPage demoState={drillState} setDemoState={setDrillState} />
                </>
              )}
              {active === "openings" && (
                <>
                  <StateBar
                    value={openingsState}
                    onChange={setOpeningsState}
                    states={[
                      { id: "normal", label: "Normal" },
                      { id: "empty", label: "Empty" },
                      { id: "loading", label: "Loading" },
                      { id: "error", label: "Error" },
                    ]}
                  />
                  <OpeningsPage
                    demoState={openingsState}
                    onOpen={() => setActive("drill")}
                  />
                </>
              )}
              {active === "settings" && <SettingsPage isDark={isDark} setIsDark={setIsDark} />}
            </main>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
