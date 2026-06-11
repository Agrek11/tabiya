/**
 * SensitiveStore — localStorage wrapper for secrets (Phase 3, R1 AC6).
 *
 * Plain localStorage for v1 (design Open Q1 default): tabiya is single-user
 * local-first, the same trust boundary as the Coach API key (AISection.tsx
 * threat model). The wrapper exists so an encrypted-at-rest impl is a
 * one-file swap, and so every secret read funnels through one seam:
 *   - key names carry a `.sensitive` suffix (greppable, self-documenting)
 *   - dev mode warns once per key on first read, naming the XSS risk
 *   - values are NEVER logged here or by callers
 */

const warned = new Set<string>();

function fullKey(key: string): string {
  return `${key}.sensitive`;
}

export const sensitiveStore = {
  get<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(fullKey(key));
      if (raw === null) return null;
      if (import.meta.env.DEV && !warned.has(key)) {
        warned.add(key);
        console.warn(
          `[tabiya] reading sensitive key "${key}" from localStorage — ` +
            'readable by any XSS payload on this origin. Encryption-at-rest is a tracked follow-up.',
        );
      }
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(fullKey(key), JSON.stringify(value));
    } catch {
      /* quota / private mode — silently degrade (Article 11) */
    }
  },

  clear(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(fullKey(key));
    } catch {
      /* ignore */
    }
  },
};

/** Token storage key (without the `.sensitive` suffix the store appends). */
export const LICHESS_TOKEN_KEY = 'tabiya:lichess:token';
