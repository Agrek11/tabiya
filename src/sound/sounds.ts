/**
 * Sound module v2 — pool + global unlock + persisted settings.
 *
 * Pool of HTMLAudioElement instances avoids concurrent-play stomp when moves
 * fire in rapid succession (player + opponent + flash within ~500ms). Each
 * playMove() advances a round-robin index.
 *
 * Settings (mute + volume) persist to localStorage. Read on every playMove()
 * so Settings page changes take effect immediately.
 *
 * Browser autoplay policy: unlockAudio() should be called from any first user
 * gesture. App registers a global pointerdown+keydown listener at mount. The
 * listener uses { once: true, capture: true } so it fires before any
 * stopPropagation() from descendants and removes itself after firing.
 *
 * Source: Lichess (AGPL-3.0). See public/sounds/Move.mp3.
 */

const MOVE_FILE = '/sounds/Move.mp3';
const POOL_SIZE = 3;

let pool: HTMLAudioElement[] = [];
let poolIdx = 0;
let unlocked = false;

const SETTINGS_KEY = 'tabiya.sound';
export type SoundSettings = { muted: boolean; volume: number };
const DEFAULT_SETTINGS: SoundSettings = { muted: false, volume: 0.85 };

function readSettings(): SoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      volume:
        typeof parsed.volume === 'number'
          ? Math.max(0, Math.min(1, parsed.volume))
          : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function getSettings(): SoundSettings {
  return readSettings();
}

export function writeSettings(s: SoundSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* quota / private mode */
  }
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
  try {
    a.currentTime = 0;
  } catch {
    /* some browsers throw if not loaded */
  }
  const result = a.play();
  if (result && typeof result.catch === 'function') {
    void result.catch(() => {
      /* autoplay blocked — first gesture will unblock */
    });
  }
}

export function unlockAudio(): void {
  if (unlocked) return;
  unlocked = true;
  const p = ensurePool();
  for (const a of p) {
    const prev = a.volume;
    a.volume = 0;
    const r = a.play();
    if (r && typeof r.then === 'function') {
      void r
        .then(() => {
          a.pause();
          a.currentTime = 0;
          a.volume = prev;
        })
        .catch(() => {
          a.volume = prev;
        });
    } else {
      a.volume = prev;
    }
  }
}

/** TEST ONLY — reset module state between tests. */
export function __resetSoundForTests(): void {
  pool = [];
  poolIdx = 0;
  unlocked = false;
}
