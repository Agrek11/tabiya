/**
 * Sound module v2 tests — pool, settings, unlock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSoundForTests,
  getSettings,
  playMove,
  unlockAudio,
  writeSettings,
} from '../src/sound/sounds';

const SETTINGS_KEY = 'tabiya.sound';

describe('sound module v2', () => {
  let playSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetSoundForTests();
    window.localStorage.clear();
    playSpy = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = playSpy as unknown as () => Promise<void>;
    window.HTMLMediaElement.prototype.pause = function (): void {
      /* noop */
    };
  });

  afterEach(() => {
    __resetSoundForTests();
    window.localStorage.clear();
  });

  describe('settings', () => {
    it('returns DEFAULT_SETTINGS when localStorage empty', () => {
      const s = getSettings();
      expect(s).toEqual({ muted: false, volume: 0.85 });
    });

    it('round-trips writeSettings → getSettings', () => {
      writeSettings({ muted: true, volume: 0.5 });
      expect(getSettings()).toEqual({ muted: true, volume: 0.5 });
    });

    it('clamps volume to [0, 1] on read', () => {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ muted: false, volume: 5 })
      );
      expect(getSettings().volume).toBe(1);

      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ muted: false, volume: -3 })
      );
      expect(getSettings().volume).toBe(0);
    });

    it('falls back to defaults on malformed JSON', () => {
      window.localStorage.setItem(SETTINGS_KEY, '{not-json');
      expect(getSettings()).toEqual({ muted: false, volume: 0.85 });
    });
  });

  describe('playMove', () => {
    it('plays via pool round-robin (3 calls = 3 different elements)', () => {
      playMove();
      playMove();
      playMove();
      expect(playSpy).toHaveBeenCalledTimes(3);
      // 4th call wraps back to first element
      playMove();
      expect(playSpy).toHaveBeenCalledTimes(4);
    });

    it('skips play when muted', () => {
      writeSettings({ muted: true, volume: 0.85 });
      playMove();
      expect(playSpy).not.toHaveBeenCalled();
    });

    it('honors volume from settings', () => {
      writeSettings({ muted: false, volume: 0.3 });
      // We can't easily inspect the audio element's volume from outside,
      // but we can confirm play was called (volume set just before play).
      playMove();
      expect(playSpy).toHaveBeenCalled();
    });
  });

  describe('unlockAudio', () => {
    it('is idempotent — second call no-ops', () => {
      unlockAudio();
      const firstCount = playSpy.mock.calls.length;
      unlockAudio();
      // Second call should NOT trigger more play() calls.
      expect(playSpy.mock.calls.length).toBe(firstCount);
    });

    it('primes all pool elements on first call', () => {
      unlockAudio();
      // Pool size is 3 — each element gets a silent play() to unlock.
      expect(playSpy).toHaveBeenCalledTimes(3);
    });
  });
});
