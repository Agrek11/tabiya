/**
 * Sound effect — single piece-move tap, sourced from Lichess (AGPL-3.0).
 *
 * Source: https://github.com/lichess-org/lila/blob/master/public/sound/standard/Move.mp3
 * License: AGPL-3.0 (declared in tech.md; allowed under Constitution Article 1).
 *
 * One sound for every move. Correct / wrong / illegal flashes are visual
 * (tick / cross overlay), not audible.
 *
 * Browser autoplay policy: HTMLAudioElement.play() returns a Promise that
 * rejects until a user gesture has occurred. We catch and swallow rejections
 * so calls before unlock are silent no-ops.
 */

const MOVE_FILE = '/sounds/Move.mp3';

let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audioEl) {
    audioEl = new Audio(MOVE_FILE);
    audioEl.preload = 'auto';
    audioEl.volume = 0.85;
  }
  return audioEl;
}

/**
 * Play the move sound. Safe to call before any user gesture — the autoplay
 * rejection is swallowed.
 */
export function playMove(): void {
  const a = getAudio();
  if (!a) return;
  try {
    a.currentTime = 0;
  } catch {
    // some browsers throw on currentTime if not loaded; ignore
  }
  const result = a.play();
  if (result && typeof result.catch === 'function') {
    void result.catch(() => {
      // autoplay blocked — first user gesture will unblock
    });
  }
}

/**
 * Pre-warm the audio element so subsequent calls are unblocked. Call from a
 * user-gesture handler (e.g. first pointer down).
 */
export function unlockAudio(): void {
  const a = getAudio();
  if (!a) return;
  const prevVolume = a.volume;
  a.volume = 0;
  const result = a.play();
  if (result && typeof result.then === 'function') {
    void result
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.volume = prevVolume;
      })
      .catch(() => {
        a.volume = prevVolume;
      });
  } else {
    a.volume = prevVolume;
  }
}
