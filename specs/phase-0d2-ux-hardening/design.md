# Phase 0d.2 — Design

## R1 — Sound module v2

### Module shape

```typescript
// src/sound/sounds.ts

const MOVE_FILE = '/sounds/Move.mp3';
const POOL_SIZE = 3;

let pool: HTMLAudioElement[] = [];
let poolIdx = 0;
let unlocked = false;

const SETTINGS_KEY = 'tabiya.sound';
type SoundSettings = { muted: boolean; volume: number };  // volume 0-1
const DEFAULT_SETTINGS: SoundSettings = { muted: false, volume: 0.85 };

function readSettings(): SoundSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      volume: typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 0.85,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(s: SoundSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function getSettings(): SoundSettings {
  return readSettings();
}

function ensurePool(): HTMLAudioElement[] {
  if (typeof window === 'undefined') return [];
  if (pool.length === 0) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const a = new Audio(MOVE_FILE);
      a.preload = 'auto';
      pool.push(a);
    }
  }
  return pool;
}

export function playMove(): void {
  const settings = readSettings();
  if (settings.muted) return;
  const p = ensurePool();
  if (p.length === 0) return;
  const a = p[poolIdx];
  poolIdx = (poolIdx + 1) % p.length;
  if (!a) return;
  a.volume = settings.volume;
  try { a.currentTime = 0; } catch { /* ignore */ }
  const result = a.play();
  if (result && typeof result.catch === 'function') {
    void result.catch(() => { /* autoplay blocked */ });
  }
}

export function unlockAudio(): void {
  if (unlocked) return;
  const p = ensurePool();
  for (const a of p) {
    const prev = a.volume;
    a.volume = 0;
    const r = a.play();
    if (r && typeof r.then === 'function') {
      void r.then(() => { a.pause(); a.currentTime = 0; a.volume = prev; })
            .catch(() => { a.volume = prev; });
    } else {
      a.volume = prev;
    }
  }
  unlocked = true;
}

/** Reset internal state — TEST ONLY. */
export function __resetSoundForTests(): void {
  pool = [];
  poolIdx = 0;
  unlocked = false;
}
```

### Global unlock wiring

```typescript
// src/App.tsx — useEffect at top of App component

useEffect(() => {
  const unlock = () => unlockAudio();
  document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });
  return () => {
    document.removeEventListener('pointerdown', unlock, { capture: true });
    document.removeEventListener('keydown', unlock, { capture: true });
  };
}, []);
```

Removes the board-specific `onPointerDown={unlockAudio}` from `ChessBoardPanel` (no longer needed; global wins).

### Settings page UI

```tsx
<Card padding={20}>
  <h2>Sound</h2>
  <Toggle label="Sound effects" checked={!muted} onChange={(v) => set({ muted: !v })} />
  <Slider
    label="Volume"
    min={0} max={100}
    value={Math.round(volume * 100)}
    onChange={(v) => set({ volume: v / 100 })}
    disabled={muted}
  />
  <Button onClick={playMove}>Test sound</Button>
</Card>
```

`Toggle` + `Slider` = 2 new primitives if not already present. Otherwise reuse existing input styles.

---

## R2 — Move rail collapse + next-move highlight

### State hook

```typescript
// src/drill/use-move-rail-collapsed.ts
import { useState, useEffect } from 'react';

const KEY = 'tabiya.moveRailCollapsed';

export function useMoveRailCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(KEY) === '1';
  });

  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      window.localStorage.setItem(KEY, v ? '1' : '0');
    } catch { /* quota / private mode */ }
  };

  return [collapsed, setCollapsed];
}
```

### DrillPage grid changes

```tsx
const [railCollapsed, setRailCollapsed] = useMoveRailCollapsed();

const layoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: railCollapsed ? '1fr' : '1fr 280px',
  gap: 24,
  alignItems: 'flex-start',
  position: 'relative',  // anchor for floating expand button
};
```

When collapsed, omit the right-rail `<div>`. Render a small floating chevron pill on the right edge of main column (absolute-positioned, top: 80px, right: 0) labeled "Show moves."

### Rail header chevron

Inside the rail's existing card, header row gets a button next to "Move history" label:

```tsx
<div style={{ padding: '12px 16px', borderBottom: ..., display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div>Move history</div>
  <button onClick={() => setRailCollapsed(true)} aria-label="Collapse moves">
    <ChevronRight size={16} />
  </button>
</div>
```

### Next-move accent

`MoveHistory` accepts new prop `nextIdx?: number`:

```tsx
<MoveHistory
  moves={drillMoves}
  state={state}
  nextIdx={state.kind === 'awaiting_player' ? state.lineIndex : undefined}
/>
```

Inside `MoveHistory`, td styling:

```tsx
const isCurrent = idx === currentIdx;
const isNext = idx === nextIdx;
const tdStyle: CSSProperties = {
  fontWeight: 600,
  padding: '5px 8px',
  color: isNext ? t.brand : t.ink,
  background: isCurrent ? t.brandSoft : 'transparent',
  borderBottom: isNext ? `2px solid ${t.brand}` : '2px solid transparent',
  borderRadius: 4,
};
```

Subtle but distinct: current = filled background, next = bottom border + accent text color.

---

## Test plan

### R1 sound tests (`tests/sound.test.ts`)

- pool round-robin: 3 calls to playMove cycle through 3 elements
- mute respected: when settings.muted true, no audio.play() call
- volume applied: playMove sets correct volume on element before play
- unlockAudio idempotent: 2nd call no-ops
- settings persistence: write then read returns same values
- defaults: empty localStorage returns DEFAULT_SETTINGS

### R2 rail tests

- `tests/use-move-rail-collapsed.test.ts`:
  - default false on empty localStorage
  - read '1' returns true, '0' returns false
  - setCollapsed writes correct string
  - SSR-safe: returns false when window undefined
- `tests/drill-page.test.tsx` extension:
  - chevron button collapses rail; rail not in DOM when collapsed
  - floating "Show moves" button visible when collapsed; click expands
  - next-move ply has accent style during awaiting_player
  - next-move accent absent during flash_correct, wrong_pending, complete

### Manual smoke (after implementation)

- Run `npm run dev` → /drill
- Drag piece → sound plays first try
- Multiple rapid moves → all sounds play (no swallow)
- Settings → toggle mute → no sound
- Settings → volume to 30% → sound noticeably quieter
- Move list chevron → collapses; floating pill → expands
- Reload → preference survives
- Active drill expanded rail → next-expected ply has accent

---

## Risks

- **Pool size 3 might be insufficient** for very rapid moves (player + opponent + flash all in <300ms). If issue, bump to 5. Real-world drill cadence ~500ms+ between moves, so 3 expected sufficient.
- **`once: true` on global unlock** means after first gesture, listener removes. If audio context lost (suspend/resume on tab background), sound may break. Acceptable for now; revisit if real issue.
- **`{ capture: true }`** chosen so unlock fires before any `stopPropagation` from descendants.

## Out of scope

- Capture-phase pointer events for unlock are sufficient; no need for AudioContext API.
- No audio sprite (single Move.mp3 reused).
- No different sounds per event (correct vs wrong vs flip). Plan stays single sound for now.
