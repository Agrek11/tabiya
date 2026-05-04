import { useState, createContext, useContext, useEffect, useRef } from "react";
import {
  Home,
  Library,
  Plug,
  ChevronRight,
  Play,
  RotateCcw,
  Lightbulb,
  Check,
  X,
  Flame,
  Clock,
  Trophy,
  Zap,
  ArrowRight,
  Plus,
  Search,
  SkipForward,
  Sparkles,
  AlertTriangle,
  Crown,
  Bell,
  ChevronDown,
  ChevronUp,
  Sun,
  Moon,
  ArrowLeft,
  User,
  TrendingUp,
  Settings,
  LogOut,
  Target,
} from "lucide-react";

/* ===========================================================
   MATEDRILL — themed, with profile menu and contextual drill
   =========================================================== */

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
  amber: "#D97706",
  amberSoft: "#FEF3C7",
  red: "#DC2626",
  redSoft: "#FEE2E2",
  blue: "#2563EB",
  blueSoft: "#DBEAFE",
  pink: "#DB2777",
  pinkSoft: "#FCE7F3",
  violet: "#7C3AED",
  violetSoft: "#EDE9FE",
  shadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.08)",
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
  amber: "#F59E0B",
  amberSoft: "#451A03",
  red: "#EF4444",
  redSoft: "#450A0A",
  blue: "#3B82F6",
  blueSoft: "#172554",
  pink: "#EC4899",
  pinkSoft: "#500724",
  violet: "#A78BFA",
  violetSoft: "#2E1065",
  shadow: "0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.5)",
};

const ThemeContext = createContext(lightTheme);
const useT = () => useContext(ThemeContext);

const sans = `'Plus Jakarta Sans', system-ui, sans-serif`;
const mono = `'JetBrains Mono', ui-monospace, monospace`;

const PIECE = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

const NAJDORF = {
  a8: "r", b8: "n", c8: "b", d8: "q", e8: "k", f8: "b", h8: "r",
  f6: "n",
  a6: "p", b7: "p", d6: "p", e7: "p", f7: "p", g7: "p", h7: "p",
  c3: "N", d4: "N",
  a2: "P", b2: "P", c2: "P", e4: "P", f2: "P", g2: "P", h2: "P",
  a1: "R", c1: "B", d1: "Q", e1: "K", f1: "B", h1: "R",
};

/* Lines within an opening — used by the line-switcher in DrillMode.
   In production this would come from your backend per opening. */
const SICILIAN_LINES = [
  { name: "Najdorf — English Attack",     eco: "B90", moves: 12, mastery: 75,  last: "2 hours ago" },
  { name: "Najdorf — 6.Bg5 Main Line",    eco: "B96", moves: 14, mastery: 50,  last: "Yesterday" },
  { name: "Najdorf — 6.Be2 Classical",    eco: "B92", moves: 11, mastery: 100, last: "1 week ago" },
  { name: "Sveshnikov Variation",         eco: "B33", moves: 13, mastery: 48,  last: "2 days ago" },
  { name: "Dragon — Yugoslav Attack",     eco: "B78", moves: 14, mastery: 78,  last: "3 days ago" },
  { name: "Dragon — Classical",           eco: "B72", moves: 10, mastery: 100, last: "5 days ago" },
  { name: "Taimanov Variation",           eco: "B44", moves: 12, mastery: 71,  last: "1 week ago" },
  { name: "Kan Variation",                eco: "B41", moves: 11, mastery: 73,  last: "1 week ago" },
  { name: "Scheveningen",                 eco: "B80", moves: 13, mastery: 100, last: "2 weeks ago" },
  { name: "Classical Sicilian",           eco: "B58", moves: 10, mastery: 80,  last: "1 week ago" },
  { name: "Smith-Morra Gambit",           eco: "B21", moves: 9,  mastery: 100, last: "1 month ago" },
  { name: "Alapin Variation",             eco: "B22", moves: 10, mastery: 60,  last: "2 weeks ago" },
  { name: "Closed Sicilian",              eco: "B23", moves: 11, mastery: 36,  last: "3 weeks ago" },
  { name: "Grand Prix Attack",            eco: "B23", moves: 10, mastery: 0,   last: "Never" },
];

/* ---------- click-outside hook ---------- */
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

/* ---------- ChessBoard ---------- */
function ChessBoard({ position = NAJDORF, lastMove = ["a7", "a6"], dark }) {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const lightSq = dark ? "#D6CCAB" : "#EBECD0";
  const darkSq = dark ? "#5C7345" : "#779556";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        aspectRatio: "1 / 1",
        width: "100%",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: dark
          ? "0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.4)"
          : "0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
      }}
    >
      {ranks.map((r) =>
        files.map((f) => {
          const sq = `${f}${r}`;
          const isLight = (files.indexOf(f) + r) % 2 === 1;
          const piece = position[sq];
          const isLast = lastMove.includes(sq);
          return (
            <div
              key={sq}
              style={{
                position: "relative",
                background: isLight ? lightSq : darkSq,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "min(5.5vw, 42px)",
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
              {f === "a" && (
                <span
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 2,
                    fontFamily: mono,
                    fontSize: 9,
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
                    fontSize: 9,
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

/* ---------- Sidebar ---------- */
function Sidebar({ active, setActive, goToProgress }) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false));

  const items = [
    { id: "dashboard", label: "Dashboard", icon: Home },
    { id: "repertoire", label: "Repertoire", icon: Library },
    { id: "games", label: "Games", icon: Plug },
  ];

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: t.surface,
        borderRight: `1px solid ${t.border}`,
        padding: "20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px" }}>
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
          }}
        >
          ♞
        </div>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: -0.3, color: t.ink }}>
          matedrill
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: t.inkSoft,
            textTransform: "uppercase",
            letterSpacing: 0.6,
            padding: "0 10px",
            marginBottom: 6,
          }}
        >
          Workspace
        </div>
        {items.map((it) => {
          const Icon = it.icon;
          // Repertoire stays highlighted while drilling
          const isActive =
            active === it.id || (active === "drill" && it.id === "repertoire");
          return (
            <button
              key={it.id}
              onClick={() => setActive(it.id)}
              className="nav-item"
              style={{
                background: isActive ? t.brandSoft : "transparent",
                color: isActive ? t.brand : t.ink,
                border: "none",
                borderRadius: 8,
                padding: "9px 10px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: sans,
                fontSize: 14,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
              <span style={{ flex: 1 }}>{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      <div
        style={{
          padding: "12px 12px",
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: t.inkDim,
            fontWeight: 500,
            marginBottom: 6,
          }}
        >
          <Flame size={12} color={t.amber} fill={t.amber} />
          Current streak
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: t.ink, letterSpacing: -0.5 }}>47</span>
          <span style={{ fontSize: 12, color: t.inkDim }}>days</span>
        </div>
      </div>

      {/* avatar with dropdown menu */}
      <div ref={menuRef} style={{ position: "relative" }}>
        {menuOpen && (
          <div
            style={{
              position: "absolute",
              bottom: "calc(100% + 8px)",
              left: 0,
              right: 0,
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              boxShadow: t.shadowMd,
              padding: 6,
              zIndex: 50,
            }}
          >
            <MenuItem icon={User} label="Profile" onClick={() => setMenuOpen(false)} />
            <MenuItem
              icon={TrendingUp}
              label="Progress"
              onClick={() => {
                goToProgress();
                setMenuOpen(false);
              }}
              accent={active === "progress"}
            />
            <MenuItem icon={Settings} label="Settings" onClick={() => setMenuOpen(false)} />
            <div style={{ height: 1, background: t.border, margin: "4px 0" }} />
            <MenuItem icon={LogOut} label="Sign out" onClick={() => setMenuOpen(false)} danger />
          </div>
        )}

        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="nav-item"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: 8,
            borderRadius: 8,
            cursor: "pointer",
            background: menuOpen ? t.surfaceAlt : "transparent",
            border: "none",
            width: "100%",
            fontFamily: sans,
            color: t.ink,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: t.brand,
              color: "#FFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            A
          </div>
          <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: t.ink }}>Anand</div>
            <div style={{ fontSize: 11, color: t.inkDim }}>Elo 1684</div>
          </div>
          {menuOpen ? <ChevronUp size={14} color={t.inkDim} /> : <ChevronDown size={14} color={t.inkDim} />}
        </button>
      </div>
    </aside>
  );
}

function MenuItem({ icon: Icon, label, onClick, accent, danger }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      className="nav-item"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 6,
        background: accent ? t.brandSoft : "transparent",
        border: "none",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        fontFamily: sans,
        fontSize: 13.5,
        fontWeight: 500,
        color: danger ? t.red : accent ? t.brand : t.ink,
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

/* ---------- TopBar ---------- */
function TopBar({ title, breadcrumb, onBack, isDark, setIsDark }) {
  const t = useT();
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${t.border}`,
        background: t.surface,
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        gap: 14,
      }}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="ghost-btn"
          style={{
            background: "transparent",
            border: "none",
            padding: "6px 8px",
            borderRadius: 6,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: t.inkDim,
            fontFamily: sans,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={15} /> Back
        </button>
      )}
      <div style={{ flex: 1 }}>
        {breadcrumb && <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 1 }}>{breadcrumb}</div>}
        <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{title}</div>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          padding: "7px 12px",
          width: 280,
        }}
      >
        <Search size={14} color={t.inkDim} />
        <input
          placeholder="Search openings, lines, games…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            flex: 1,
            fontFamily: sans,
            fontSize: 13,
            color: t.ink,
          }}
        />
        <span
          style={{
            fontFamily: mono,
            fontSize: 10,
            color: t.inkSoft,
            background: t.surface,
            border: `1px solid ${t.border}`,
            padding: "1px 5px",
            borderRadius: 4,
          }}
        >
          ⌘K
        </span>
      </div>
      {/* theme toggle */}
      <button
        onClick={() => setIsDark(!isDark)}
        className="icon-btn"
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
      <button className="icon-btn" style={{
        width: 36,
        height: 36,
        background: t.surfaceAlt,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}>
        <Bell size={16} color={t.inkDim} />
      </button>
    </div>
  );
}

/* ---------- shared ---------- */
function PageHeader({ title, subtitle }) {
  const t = useT();
  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: -0.5 }}>
        {title}
      </h1>
      {subtitle && <p style={{ margin: "6px 0 0", color: t.inkDim, fontSize: 14.5 }}>{subtitle}</p>}
    </div>
  );
}

function getCardStyle(t) {
  return {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: 14,
  };
}

function getPrimaryBtn(t) {
  return {
    background: t.brand,
    color: "#FFF",
    border: "none",
    borderRadius: 8,
    padding: "8px 14px",
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function getSecondaryBtn(t) {
  return {
    background: t.surface,
    color: t.ink,
    border: `1px solid ${t.borderStrong}`,
    borderRadius: 8,
    padding: "8px 14px",
    fontFamily: sans,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function Stat({ icon: Icon, iconColor, iconBg, value, suffix, label, trend, trendUp, trendDown }) {
  const t = useT();
  const trendColor = trendUp ? t.brand : trendDown ? t.red : t.inkDim;
  return (
    <div style={{ ...getCardStyle(t), padding: 16 }}>
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={iconColor} strokeWidth={2.2} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 14 }}>
        <span style={{ fontSize: 26, fontWeight: 700, color: t.ink, letterSpacing: -0.5 }}>{value}</span>
        {suffix && <span style={{ fontSize: 13, color: t.inkDim }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 13, color: t.inkDim, marginTop: 2 }}>{label}</div>
      {trend && (
        <div style={{ fontSize: 11.5, color: trendColor, marginTop: 8, fontWeight: 500 }}>
          {trendUp ? "↑ " : trendDown ? "↓ " : ""}
          {trend}
        </div>
      )}
    </div>
  );
}

function Meta({ icon: Icon, text }) {
  const t = useT();
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: t.inkDim }}>
      <Icon size={13} />
      {text}
    </span>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ onStartDrill }) {
  const t = useT();
  const card = getCardStyle(t);
  const primaryBtn = getPrimaryBtn(t);
  const secondaryBtn = getSecondaryBtn(t);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title="Welcome back, Anand"
        subtitle="3 lines are due for review and 1 new opening is ready to onboard."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Stat icon={Library} iconColor={t.brand} iconBg={t.brandSoft} value="68" suffix="/ 142" label="Lines mastered" trend="+4 this week" trendUp />
        <Stat icon={Target} iconColor={t.blue} iconBg={t.blueSoft} value="84%" label="Average accuracy" trend="+11% this month" trendUp />
        <Stat icon={Clock} iconColor={t.violet} iconBg={t.violetSoft} value="3h 22m" label="Time this week" trend="On pace for 5h" />
        <Stat icon={AlertTriangle} iconColor={t.amber} iconBg={t.amberSoft} value="14" suffix="lines" label="Due for review" trend="3 critical" trendDown />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
        <div style={{ ...card, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Sparkles size={14} color={t.brand} />
            <span style={{ fontSize: 12, fontWeight: 600, color: t.brand }}>Suggested for you</span>
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: t.ink, letterSpacing: -0.3 }}>
            Sicilian Najdorf — 6.Bg5 Main Line
          </h3>
          <p style={{ margin: "8px 0 18px", color: t.inkDim, fontSize: 14, lineHeight: 1.5 }}>
            You missed move 11 in your last attempt. Three reps recommended before tomorrow's
            review window closes.
          </p>

          <div
            style={{
              background: t.surfaceAlt,
              border: `1px solid ${t.border}`,
              borderRadius: 10,
              padding: 14,
              fontFamily: mono,
              fontSize: 12.5,
              color: t.ink,
              lineHeight: 1.7,
            }}
          >
            1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 a6{" "}
            <span
              style={{
                background: t.brandSoft,
                color: t.brandHover,
                padding: "2px 5px",
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              6.Bg5
            </span>{" "}
            e6 7.f4 Be7 8.Qf3 Qc7 …
          </div>

          <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 13, color: t.inkDim }}>
            <Meta icon={Clock} text="~6 min" />
            <Meta icon={Target} text="12 moves" />
            <Meta icon={Flame} text="Last: 64% accuracy" />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button onClick={() => onStartDrill({ name: "Sicilian Najdorf — 6.Bg5 Main Line" })} style={primaryBtn}>
              Start drill <ArrowRight size={14} />
            </button>
            <button style={secondaryBtn}>Preview line</button>
          </div>
        </div>

        <div style={{ ...card, padding: 22 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>Practice rhythm</h4>
            <span style={{ fontSize: 12, color: t.inkDim }}>last 12 weeks</span>
          </div>
          <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 16 }}>
            <span style={{ color: t.ink, fontWeight: 600 }}>62</span> active days ·{" "}
            <span style={{ color: t.ink, fontWeight: 600 }}>312</span> drills
          </div>

          <Heatmap />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
              marginTop: 14,
              fontSize: 11,
              color: t.inkDim,
            }}
          >
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  background: i === 0 ? t.surfaceAlt : `rgba(16, 185, 129, ${0.18 + i * 0.2})`,
                  border: i === 0 ? `1px solid ${t.border}` : "none",
                  borderRadius: 2,
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            padding: "16px 22px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: `1px solid ${t.border}`,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>Recent activity</h4>
          <a style={{ fontSize: 13, color: t.brand, fontWeight: 500, cursor: "pointer" }}>View all →</a>
        </div>
        <ActivityRow when="2 hr ago" event="Drilled" subject="French Defense — Winawer" detail="Acc. 91% · 8 moves" status="mastered" />
        <ActivityRow when="Yesterday" event="Added" subject="Caro-Kann — Advance Variation" detail="From repertoire builder" status="new" />
        <ActivityRow when="Yesterday" event="Failed at move 14" subject="King's Indian — Mar del Plata" detail="Acc. 58% · review queued" status="review" />
        <ActivityRow when="2 days ago" event="Drilled" subject="Italian Game — Giuoco Pianissimo" detail="Acc. 100% · 6 moves" status="mastered" last />
      </div>
    </div>
  );
}

function Heatmap() {
  const t = useT();
  const data = Array.from({ length: 12 * 7 }).map((_, i) => {
    const seed = (i * 9301 + 49297) % 233280;
    const r = seed / 233280;
    if (r < 0.25) return 0;
    if (r < 0.45) return 1;
    if (r < 0.7) return 2;
    if (r < 0.9) return 3;
    return 4;
  });
  const isDark = t.bg === darkTheme.bg;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gridTemplateRows: "repeat(7, 1fr)",
        gridAutoFlow: "column",
        gap: 3,
      }}
    >
      {data.map((v, i) => (
        <div
          key={i}
          style={{
            aspectRatio: "1 / 1",
            background:
              v === 0
                ? t.surfaceAlt
                : isDark
                ? `rgba(16, 185, 129, ${0.2 + v * 0.18})`
                : `rgba(4, 120, 87, ${0.18 + v * 0.2})`,
            border: v === 0 ? `1px solid ${t.border}` : "none",
            borderRadius: 3,
          }}
        />
      ))}
    </div>
  );
}

function ActivityRow({ when, event, subject, detail, status, last }) {
  const t = useT();
  const map = {
    mastered: { label: "Mastered", bg: t.brandSoft, color: t.brand },
    new: { label: "New", bg: t.violetSoft, color: t.violet },
    review: { label: "Needs review", bg: t.redSoft, color: t.red },
  };
  const s = map[status];
  return (
    <div
      className="row"
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 22px",
        borderBottom: last ? "none" : `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: 12, color: t.inkSoft, fontWeight: 500 }}>{when}</div>
      <div>
        <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 2 }}>{event}</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink }}>{subject}</div>
        <div style={{ fontFamily: mono, fontSize: 11.5, color: t.inkDim, marginTop: 3 }}>{detail}</div>
      </div>
      <span
        style={{
          background: s.bg,
          color: s.color,
          fontSize: 11.5,
          fontWeight: 600,
          padding: "4px 10px",
          borderRadius: 999,
        }}
      >
        {s.label}
      </span>
    </div>
  );
}

/* ---------- Repertoire ---------- */
function Repertoire({ onOpenDrill }) {
  const t = useT();
  const card = getCardStyle(t);
  const primaryBtn = getPrimaryBtn(t);
  const [filter, setFilter] = useState("all");

  const openings = [
    { name: "Sicilian Defense", side: "black", lines: 14, mastered: 9, eco: "B20–B99", last: "2 hours ago" },
    { name: "French Defense", side: "black", lines: 8, mastered: 6, eco: "C00–C19", last: "Yesterday" },
    { name: "Caro-Kann", side: "black", lines: 6, mastered: 4, eco: "B10–B19", last: "3 days ago" },
    { name: "Italian Game", side: "white", lines: 11, mastered: 11, eco: "C50–C54", last: "Today", complete: true },
    { name: "King's Indian Defense", side: "black", lines: 9, mastered: 3, eco: "E60–E99", last: "Yesterday" },
    { name: "London System", side: "white", lines: 7, mastered: 5, eco: "D02", last: "5 days ago" },
    { name: "Catalan Opening", side: "white", lines: 6, mastered: 2, eco: "E00–E09", last: "1 week ago" },
    { name: "Ruy López — Berlin", side: "white", lines: 5, mastered: 4, eco: "C65", last: "4 days ago" },
  ];

  const filtered = filter === "all" ? openings : openings.filter((o) => o.side === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <PageHeader
          title="Repertoire"
          subtitle="8 openings · 66 lines · click any opening to drill it."
        />
        <button style={primaryBtn}>
          <Plus size={14} strokeWidth={2.5} /> Add opening
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, borderBottom: `1px solid ${t.border}` }}>
        {[
          { id: "all", label: "All", count: 8 },
          { id: "white", label: "As White", count: 4 },
          { id: "black", label: "As Black", count: 4 },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
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
              {tab.label}
              <span
                style={{
                  background: isActive ? t.brandSoft : t.surfaceAlt,
                  color: isActive ? t.brand : t.inkDim,
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: 999,
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {filtered.map((o) => <OpeningCard key={o.name} opening={o} onClick={() => onOpenDrill(o)} />)}
        <button
          style={{
            ...card,
            background: "transparent",
            borderStyle: "dashed",
            padding: 22,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            color: t.inkDim,
            fontFamily: sans,
            fontSize: 13.5,
            fontWeight: 500,
            minHeight: 180,
          }}
        >
          <Plus size={20} />
          Add another opening
        </button>
      </div>
    </div>
  );
}

function OpeningCard({ opening, onClick }) {
  const t = useT();
  const card = getCardStyle(t);
  const pct = Math.round((opening.mastered / opening.lines) * 100);
  const color = pct >= 70 ? t.brand : pct >= 40 ? t.amber : t.red;
  const bgColor = pct >= 70 ? t.brandSoft : pct >= 40 ? t.amberSoft : t.redSoft;

  return (
    <div onClick={onClick} className="opening-card" style={{ ...card, padding: 18, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 11, color: t.inkSoft, fontWeight: 600, marginBottom: 4 }}>
            {opening.eco} · {opening.side === "white" ? "WHITE" : "BLACK"}
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: t.ink, letterSpacing: -0.2 }}>
            {opening.name}
          </h3>
        </div>
        {opening.complete && (
          <Crown size={16} color={t.amber} strokeWidth={2.2} fill={t.amberSoft} />
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: t.inkDim }}>
            {opening.mastered} of {opening.lines} lines
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color,
              background: bgColor,
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {pct}%
          </span>
        </div>
        <div style={{ height: 6, background: t.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 14,
          fontSize: 12,
          color: t.inkDim,
        }}
      >
        <span>Last: {opening.last}</span>
        <span style={{ color: t.brand, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 2 }}>
          Drill <ChevronRight size={13} />
        </span>
      </div>
    </div>
  );
}

/* ---------- Drill Mode (no nav, contextual screen) ---------- */
function DrillMode({ opening }) {
  const t = useT();
  const card = getCardStyle(t);
  const primaryBtn = getPrimaryBtn(t);
  const secondaryBtn = getSecondaryBtn(t);
  const isDark = t.bg === darkTheme.bg;

  // Lines for this opening (mock — would come from backend per opening)
  const lines = SICILIAN_LINES;
  const [currentLineIdx, setCurrentLineIdx] = useState(0);
  const [lineMenuOpen, setLineMenuOpen] = useState(false);
  const lineMenuRef = useClickOutside(() => setLineMenuOpen(false));
  const currentLine = lines[currentLineIdx];

  const moves = [
    { n: 1, w: "e4", b: "c5" },
    { n: 2, w: "Nf3", b: "d6" },
    { n: 3, w: "d4", b: "cxd4" },
    { n: 4, w: "Nxd4", b: "Nf6" },
    { n: 5, w: "Nc3", b: "a6", current: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 4 }}>
            Repertoire / {opening?.name || "Sicilian Defense"}
          </div>

          {/* Line switcher dropdown */}
          <div ref={lineMenuRef} style={{ position: "relative", display: "inline-block" }}>
            <button
              onClick={() => setLineMenuOpen((v) => !v)}
              className="line-switcher"
              style={{
                background: lineMenuOpen ? t.surfaceAlt : "transparent",
                border: `1px solid ${lineMenuOpen ? t.border : "transparent"}`,
                padding: "4px 10px 4px 4px",
                marginLeft: -4,
                borderRadius: 8,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: sans,
                color: t.ink,
                textAlign: "left",
              }}
            >
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>
                {currentLine.name}
              </h1>
              <ChevronDown
                size={18}
                strokeWidth={2.4}
                style={{
                  transition: "transform 150ms",
                  transform: lineMenuOpen ? "rotate(180deg)" : "rotate(0)",
                  color: t.inkDim,
                  flexShrink: 0,
                }}
              />
            </button>

            {lineMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: 400,
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
                <div
                  style={{
                    padding: "8px 10px 8px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: t.inkSoft,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    borderBottom: `1px solid ${t.border}`,
                    marginBottom: 4,
                  }}
                >
                  {lines.length} lines · {opening?.name || "Sicilian Defense"}
                </div>
                {lines.map((line, i) => {
                  const isCurrent = i === currentLineIdx;
                  const masteryColor = line.mastery >= 70 ? t.brand : line.mastery >= 40 ? t.amber : t.red;
                  const masteryBg = line.mastery >= 70 ? t.brandSoft : line.mastery >= 40 ? t.amberSoft : t.redSoft;
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
                        gap: 12,
                        padding: "10px 10px",
                        width: "100%",
                        background: isCurrent ? t.surfaceAlt : "transparent",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: sans,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>
                            {line.name}
                          </span>
                          {isCurrent && <Check size={13} color={t.brand} strokeWidth={3} />}
                        </div>
                        <div style={{ fontSize: 11.5, color: t.inkDim, marginTop: 2, fontFamily: mono }}>
                          {line.eco} · {line.moves} moves · last: {line.last}
                        </div>
                      </div>
                      <span
                        style={{
                          background: masteryBg,
                          color: masteryColor,
                          fontSize: 11.5,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontFamily: mono,
                          minWidth: 44,
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

          <div style={{ fontSize: 13, color: t.inkDim, marginTop: 4 }}>
            {currentLine.eco} · As White · {currentLine.moves} moves
          </div>
        </div>
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <Counter label="Move" value="5" total="12" />
          <Counter label="Time" value="02:14" />
          <Counter label="Accuracy" value="80%" color={t.brand} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...card, padding: 18 }}>
            <ChessBoard dark={isDark} />
          </div>

          <div
            style={{
              ...card,
              padding: 18,
              borderColor: t.brand,
              background: isDark
                ? `linear-gradient(135deg, ${t.brandSoft} 0%, ${t.surface} 60%)`
                : `linear-gradient(135deg, ${t.brandSoft} 0%, ${t.surface} 60%)`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: t.brand,
                    fontWeight: 700,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  Your move · White
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: t.ink }}>
                  Continue the English Attack.
                </div>
                <div style={{ fontSize: 13, color: t.inkDim, marginTop: 3 }}>
                  Theory says one square forward, two diagonals to spare.
                </div>
              </div>
              <button
                style={{
                  ...secondaryBtn,
                  borderColor: t.brand,
                  color: t.brand,
                }}
              >
                <Lightbulb size={14} /> Hint
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button style={secondaryBtn}>
              <RotateCcw size={13} /> Restart
            </button>
            <button style={secondaryBtn}>
              <SkipForward size={13} /> Skip
            </button>
            <button style={{ ...secondaryBtn, color: t.red }}>
              <X size={13} /> Give up
            </button>
            <div style={{ flex: 1 }} />
            <button style={primaryBtn}>
              <Check size={13} /> Submit move
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={card}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>Move history</div>
            </div>
            <div style={{ padding: "10px 16px" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontFamily: mono,
                  fontSize: 13,
                }}
              >
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.n}>
                      <td style={{ color: t.inkSoft, fontWeight: 500, padding: "5px 0", width: 28 }}>{m.n}.</td>
                      <td style={{ fontWeight: 600, padding: "5px 8px", color: t.ink }}>{m.w}</td>
                      <td
                        style={{
                          fontWeight: 600,
                          padding: "5px 8px",
                          color: t.ink,
                          background: m.current ? t.brandSoft : "transparent",
                          borderRadius: 4,
                        }}
                      >
                        {m.b}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ color: t.inkSoft, padding: "5px 0" }}>6.</td>
                    <td colSpan={2} style={{ color: t.inkSoft, padding: "5px 8px", fontStyle: "italic" }}>
                      waiting for your move…
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.ink }}>Line progress</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: t.brand }}>42%</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 3 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: "1 / 1.5",
                    background: i < 5 ? t.brand : i === 5 ? t.amber : t.surfaceAlt,
                    border: i < 6 ? "none" : `1px solid ${t.border}`,
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 12, color: t.inkDim, marginTop: 10 }}>
              5 moves correct · 1 in progress · 6 remaining
            </div>
          </div>

          <div style={{ ...card, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, marginBottom: 14 }}>This session</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.ink, letterSpacing: -0.5 }}>4 / 5</div>
                <div style={{ fontSize: 12, color: t.inkDim, marginTop: 2 }}>moves correct</div>
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: t.brand, letterSpacing: -0.5 }}>80%</div>
                <div style={{ fontSize: 12, color: t.inkDim, marginTop: 2 }}>accuracy</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, total, color }) {
  const t = useT();
  return (
    <div>
      <div style={{ fontSize: 11, color: t.inkDim, fontWeight: 500, marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: color || t.ink,
            fontFamily: mono,
            letterSpacing: -0.3,
          }}
        >
          {value}
        </span>
        {total && <span style={{ fontSize: 12, color: t.inkDim, fontFamily: mono }}>/ {total}</span>}
      </div>
    </div>
  );
}

/* ============================================================
   PROGRESS — period-filtered analytics (under Profile menu)
   ============================================================ */

// Mock data per period — flow stats vary, current state stays current
const PERIOD_DATA = {
  "7d": {
    label: "last 7 days",
    drills: { value: 38, suffix: "reps", trend: "+12 vs prev week", up: true },
    accuracy: { value: "87%", trend: "+3% vs prev week", up: true },
    time: { value: "3h 22m", trend: "On pace for 5h", up: false, neutral: true },
    mastered: { value: 4, suffix: "lines", trend: "Najdorf, Winawer +2", up: true },
    chartLabels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    chartPoints: [82, 85, 80, 88, 86, 90, 87],
    chartHeadline: "87%",
    chartChange: "+3%",
  },
  "30d": {
    label: "last 30 days",
    drills: { value: 142, suffix: "reps", trend: "+38 vs prev month", up: true },
    accuracy: { value: "84%", trend: "+11% vs prev month", up: true },
    time: { value: "12h 30m", trend: "Avg 25 min/day", up: false, neutral: true },
    mastered: { value: 8, suffix: "lines", trend: "Best month yet", up: true },
    chartLabels: ["Apr 4", "Apr 11", "Apr 18", "Apr 25", "May 2"],
    chartPoints: [62, 65, 60, 68, 72, 70, 74, 71, 78, 76, 82, 80, 85, 83, 84],
    chartHeadline: "84%",
    chartChange: "+11%",
  },
  "1y": {
    label: "last year",
    drills: { value: 612, suffix: "reps", trend: "+184 vs prev year", up: true },
    accuracy: { value: "78%", trend: "+14% YoY", up: true },
    time: { value: "96h", trend: "≈ 4 days of chess", up: false, neutral: true },
    mastered: { value: 64, suffix: "lines", trend: "Up from 4 last year", up: true },
    chartLabels: ["Jun", "Aug", "Oct", "Dec", "Feb", "Apr"],
    chartPoints: [54, 58, 60, 64, 65, 70, 72, 75, 76, 78, 80, 82],
    chartHeadline: "78%",
    chartChange: "+14%",
  },
  all: {
    label: "all time",
    drills: { value: "1,240", suffix: "reps", trend: "Since Mar 2024", up: false, neutral: true },
    accuracy: { value: "76%", trend: "Lifetime average", up: false, neutral: true },
    time: { value: "156h", trend: "≈ 6.5 days", up: false, neutral: true },
    mastered: { value: 68, suffix: "/ 142 lines", trend: "48% complete", up: false, neutral: true },
    chartLabels: ["Mar '24", "Jul", "Nov", "Mar '25", "May '25"],
    chartPoints: [48, 52, 56, 60, 62, 65, 68, 72, 76, 80, 84],
    chartHeadline: "76%",
    chartChange: "lifetime",
  },
};

function Progress() {
  const t = useT();
  const card = getCardStyle(t);
  const [period, setPeriod] = useState("30d");
  const data = PERIOD_DATA[period];

  const periods = [
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
    { id: "1y", label: "1 year" },
    { id: "all", label: "All time" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <PageHeader title="Progress" subtitle={`Activity over the ${data.label}`} />

        {/* period filter pills */}
        <div
          style={{
            display: "inline-flex",
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 10,
            padding: 3,
          }}
        >
          {periods.map((p) => {
            const isActive = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                style={{
                  background: isActive ? t.surfaceAlt : "transparent",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? t.ink : t.inkDim,
                  cursor: "pointer",
                  fontFamily: sans,
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* period-filtered stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <Stat
          icon={Target}
          iconColor={t.brand}
          iconBg={t.brandSoft}
          value={data.drills.value}
          suffix={data.drills.suffix}
          label="Drills completed"
          trend={data.drills.trend}
          trendUp={data.drills.up}
        />
        <Stat
          icon={Trophy}
          iconColor={t.blue}
          iconBg={t.blueSoft}
          value={data.accuracy.value}
          label="Average accuracy"
          trend={data.accuracy.trend}
          trendUp={data.accuracy.up}
        />
        <Stat
          icon={Clock}
          iconColor={t.violet}
          iconBg={t.violetSoft}
          value={data.time.value}
          label="Time invested"
          trend={data.time.trend}
        />
        <Stat
          icon={Library}
          iconColor={t.amber}
          iconBg={t.amberSoft}
          value={data.mastered.value}
          suffix={data.mastered.suffix}
          label="Lines newly mastered"
          trend={data.mastered.trend}
          trendUp={data.mastered.up}
        />
      </div>

      {/* accuracy chart with period */}
      <div style={{ ...card, padding: 22 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: t.inkDim }}>Accuracy curve · {data.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: t.ink, letterSpacing: -0.5 }}>
                {data.chartHeadline}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: data.chartChange.startsWith("+") ? t.brand : t.inkDim,
                  fontWeight: 600,
                  background: data.chartChange.startsWith("+") ? t.brandSoft : "transparent",
                  padding: "2px 8px",
                  borderRadius: 999,
                }}
              >
                {data.chartChange}
              </span>
            </div>
          </div>
        </div>
        <AccuracyChart points={data.chartPoints} labels={data.chartLabels} />
      </div>

      {/* rankings — current state, NOT period-filtered */}
      <div>
        <div
          style={{
            fontSize: 12,
            color: t.inkSoft,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 10,
          }}
        >
          Current standings
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={card}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <Trophy size={15} color={t.amber} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>Strongest openings</span>
            </div>
            <RankRow rank={1} name="Italian Game" detail="11 of 11 lines mastered" pct={100} />
            <RankRow rank={2} name="Ruy López — Berlin" detail="4 of 5 lines mastered" pct={80} />
            <RankRow rank={3} name="French — Winawer" detail="7 of 9 lines mastered" pct={78} />
            <RankRow rank={4} name="Sicilian Najdorf" detail="9 of 14 lines mastered" pct={64} last />
          </div>
          <div style={card}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={15} color={t.red} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>Needs another rep</span>
            </div>
            <RankRow rank={1} name="King's Indian — Mar del Plata" detail="failed move 14 twice" pct={33} />
            <RankRow rank={2} name="Catalan — Open" detail="weak on …dxc4" pct={40} />
            <RankRow rank={3} name="Sicilian — Sveshnikov" detail="positional drift" pct={48} />
            <RankRow rank={4} name="Caro-Kann — Advance" detail="new line" pct={55} last />
          </div>
        </div>
      </div>
    </div>
  );
}

function AccuracyChart({ points, labels }) {
  const t = useT();
  const min = 40, max = 100, w = 100, h = 32;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min)) * h;
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const fill = `${path} L ${w} ${h} L 0 ${h} Z`;
  const isDark = t.bg === darkTheme.bg;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 200 }}>
        <defs>
          <linearGradient id="grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={t.brand} stopOpacity={isDark ? "0.4" : "0.25"} />
            <stop offset="100%" stopColor={t.brand} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 25, 50, 75, 100].map((p, i) => {
          const y = h - (p / 100) * h;
          return (
            <line
              key={i}
              x1={0}
              x2={w}
              y1={y}
              y2={y}
              stroke={t.border}
              strokeWidth="0.2"
              strokeDasharray="0.5,0.5"
            />
          );
        })}
        <path d={fill} fill="url(#grad)" />
        <path d={path} fill="none" stroke={t.brand} strokeWidth="0.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={w}
          cy={h - ((points[points.length - 1] - min) / (max - min)) * h}
          r={1.4}
          fill={t.brand}
          stroke={t.surface}
          strokeWidth="0.5"
        />
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: t.inkSoft,
          marginTop: 8,
          fontWeight: 500,
        }}
      >
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function RankRow({ rank, name, detail, pct, last }) {
  const t = useT();
  const color = pct >= 70 ? t.brand : pct >= 50 ? t.amber : t.red;
  const bg = pct >= 70 ? t.brandSoft : pct >= 50 ? t.amberSoft : t.redSoft;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 130px",
        alignItems: "center",
        gap: 14,
        padding: "12px 18px",
        borderBottom: last ? "none" : `1px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: t.inkSoft, fontFamily: mono }}>0{rank}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: t.ink }}>{name}</div>
        <div style={{ fontSize: 12, color: t.inkDim, marginTop: 2 }}>{detail}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: t.surfaceAlt, borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: color }} />
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color,
            background: bg,
            padding: "2px 7px",
            borderRadius: 999,
            fontFamily: mono,
            minWidth: 42,
            textAlign: "center",
          }}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}

/* ============================================================
   GAMES (renamed from Game Import)
   ============================================================ */
function Games() {
  const t = useT();
  const card = getCardStyle(t);
  const primaryBtn = getPrimaryBtn(t);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHeader
        title="Games"
        subtitle="Pull your real games from Chess.com or Lichess and turn every blunder, brilliancy, and missed tactic into a drill."
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ConnectCard name="Chess.com" handle="@anand_attacks" subtitle="Last sync: 2 hours ago" connected gamesCount={283} />
        <ConnectCard name="Lichess" subtitle="Tap to authorize via OAuth" />
      </div>

      <div style={card}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>Last 50 games</div>
            <div style={{ fontSize: 12, color: t.inkDim, marginTop: 2 }}>auto-tagged by engine analysis</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Chip label="Mistakes" count={14} color={t.red} bg={t.redSoft} active />
            <Chip label="Brilliancies" count={3} color={t.brand} bg={t.brandSoft} />
            <Chip label="Missed tactics" count={7} color={t.pink} bg={t.pinkSoft} />
            <Chip label="Endgames" count={11} color={t.blue} bg={t.blueSoft} />
          </div>
        </div>

        <GameRow opp="hikaru_fan_2009" opening="Sicilian Najdorf" tag="Mistake" tagColor={t.red} tagBg={t.redSoft} desc="Move 16: ...Bxh3?? lost a piece. Engine wanted ...Nd7." time="2 hr ago" result="0–1" />
        <GameRow opp="berlin_wall_88" opening="Ruy López — Berlin" tag="Brilliancy" tagColor={t.brand} tagBg={t.brandSoft} desc="Move 22: Rxf7! a clean exchange sac. +2.4 swing." time="Yesterday" result="1–0" />
        <GameRow opp="grunfeld_gremlin" opening="King's Indian" tag="Missed tactic" tagColor={t.pink} tagBg={t.pinkSoft} desc="Move 19: Nxe4! was winning. You played the quiet Re8." time="Yesterday" result="½–½" />
        <GameRow opp="endgame_emil" opening="Italian Game" tag="Endgame" tagColor={t.blue} tagBg={t.blueSoft} desc="K+R vs K+R+P — drawn in time-trouble. Drill the technique." time="2 days ago" result="½–½" last />

        <div
          style={{
            margin: 20,
            padding: 16,
            background: t.brandSoft,
            border: `1px solid ${t.brand}33`,
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: t.brand,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Zap size={18} color="#FFF" strokeWidth={2.4} fill="#FFF" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
              Drill all 14 mistakes in one session
            </div>
            <div style={{ fontSize: 12.5, color: t.inkDim, marginTop: 2 }}>
              Builds a custom playlist · estimated 38 minutes
            </div>
          </div>
          <button style={primaryBtn}>
            <Play size={13} fill="#FFF" /> Build playlist
          </button>
        </div>
      </div>

      <div
        style={{
          ...card,
          padding: 20,
          background: t.ink,
          color: t.bg === darkTheme.bg ? t.bg : "#FFF",
          borderColor: t.ink,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#86EFAC",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Coming next
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.2 }}>
          Play out the line versus an engine after you finish drilling
        </div>
        <div style={{ fontSize: 13.5, opacity: 0.7, marginTop: 6, maxWidth: 580 }}>
          Once you've nailed every theory move, the line drops you into a live position
          against Stockfish at your level. No more "now what?" after move 12.
        </div>
      </div>
    </div>
  );
}

function ConnectCard({ name, handle, subtitle, connected, gamesCount }) {
  const t = useT();
  const card = getCardStyle(t);
  const primaryBtn = getPrimaryBtn(t);
  const secondaryBtn = getSecondaryBtn(t);
  return (
    <div style={{ ...card, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: connected ? t.brand : t.surfaceAlt,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              color: connected ? "#FFF" : t.inkDim,
              border: connected ? "none" : `1px solid ${t.border}`,
            }}
          >
            ♞
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{name}</div>
            <div style={{ fontSize: 12.5, color: t.inkDim, marginTop: 2 }}>
              {connected ? handle : subtitle}
            </div>
          </div>
        </div>
        {connected ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: t.brandSoft,
              color: t.brand,
              fontSize: 11.5,
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: 999,
            }}
          >
            <Check size={11} strokeWidth={3} /> Connected
          </span>
        ) : (
          <span style={{ fontSize: 11.5, color: t.inkDim, fontWeight: 500 }}>Not linked</span>
        )}
      </div>

      {connected && (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: t.inkDim,
            paddingTop: 14,
            borderTop: `1px solid ${t.border}`,
          }}
        >
          <span>{subtitle}</span>
          <span>{gamesCount} games imported</span>
        </div>
      )}

      <button
        style={{
          ...(connected ? secondaryBtn : primaryBtn),
          marginTop: 14,
          width: "100%",
          justifyContent: "center",
        }}
      >
        {connected ? "Sync now" : "Connect account"} <ArrowRight size={13} />
      </button>
    </div>
  );
}

function Chip({ label, count, color, bg, active }) {
  const t = useT();
  return (
    <button
      style={{
        background: active ? bg : t.surface,
        color: active ? color : t.inkDim,
        border: `1px solid ${active ? `${color}40` : t.border}`,
        borderRadius: 999,
        padding: "5px 12px",
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        fontFamily: sans,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {label}
      <span style={{ fontSize: 11, fontWeight: 600, color: active ? color : t.inkSoft }}>{count}</span>
    </button>
  );
}

function GameRow({ opp, opening, tag, tagColor, tagBg, desc, time, result, last }) {
  const t = useT();
  return (
    <div
      className="row"
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 20px",
        borderBottom: last ? "none" : `1px solid ${t.border}`,
      }}
    >
      <span
        style={{
          background: tagBg,
          color: tagColor,
          fontSize: 11.5,
          fontWeight: 600,
          padding: "3px 9px",
          borderRadius: 999,
          width: 110,
          textAlign: "center",
        }}
      >
        {tag}
      </span>
      <div>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: t.ink }}>vs. {opp}</span>
          <span style={{ fontFamily: mono, fontSize: 11.5, color: t.inkDim }}>{opening}</span>
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, marginTop: 3 }}>{desc}</div>
      </div>
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: mono }}>{time}</div>
      <div
        style={{
          fontFamily: mono,
          fontWeight: 600,
          fontSize: 13,
          color: t.ink,
          background: t.surfaceAlt,
          padding: "4px 10px",
          borderRadius: 6,
          minWidth: 50,
          textAlign: "center",
        }}
      >
        {result}
      </div>
    </div>
  );
}

/* ---------- Root ---------- */
export default function ChessDrillApp() {
  const [active, setActive] = useState("dashboard");
  const [isDark, setIsDark] = useState(false);
  const [drillContext, setDrillContext] = useState(null);

  const t = isDark ? darkTheme : lightTheme;

  const titles = {
    dashboard: { title: "Dashboard", breadcrumb: "Sunday, May 3" },
    repertoire: { title: "Repertoire", breadcrumb: "Library" },
    drill: { title: drillContext?.name || "Drill", breadcrumb: "Practicing" },
    progress: { title: "Progress", breadcrumb: "Profile · Analytics" },
    games: { title: "Games", breadcrumb: "Real game review" },
  };

  const startDrill = (opening) => {
    setDrillContext(opening || { name: "Sicilian Najdorf" });
    setActive("drill");
  };

  return (
    <ThemeContext.Provider value={t}>
      <div style={{ background: t.bg, color: t.ink, fontFamily: sans, minHeight: "100vh" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
          * { box-sizing: border-box; }
          body { margin: 0; }
          button { transition: background 120ms, transform 80ms, border-color 120ms, opacity 120ms, box-shadow 120ms; }
          button:hover { opacity: 0.92; }
          button:active { transform: translateY(1px); }
          .nav-item:hover { background: ${t.surfaceAlt}; }
          .opening-card:hover { border-color: ${t.borderStrong}; box-shadow: ${t.shadow}; transform: translateY(-1px); }
          .row:hover { background: ${t.bg}; }
          .icon-btn:hover { border-color: ${t.borderStrong}; }
          .ghost-btn:hover { background: ${t.surfaceAlt}; }
          .line-switcher:hover { background: ${t.surfaceAlt} !important; border-color: ${t.border} !important; }
          input::placeholder { color: ${t.inkSoft}; }
        `}</style>

        <div style={{ display: "flex", minHeight: "100vh" }}>
          <Sidebar
            active={active}
            setActive={setActive}
            goToProgress={() => setActive("progress")}
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <TopBar
              title={titles[active].title}
              breadcrumb={titles[active].breadcrumb}
              onBack={active === "drill" ? () => setActive("repertoire") : undefined}
              isDark={isDark}
              setIsDark={setIsDark}
            />
            <main style={{ flex: 1, padding: "28px 32px 48px", overflow: "auto" }}>
              {active === "dashboard" && <Dashboard onStartDrill={startDrill} />}
              {active === "repertoire" && <Repertoire onOpenDrill={startDrill} />}
              {active === "drill" && <DrillMode opening={drillContext} />}
              {active === "progress" && <Progress />}
              {active === "games" && <Games />}
            </main>
          </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
