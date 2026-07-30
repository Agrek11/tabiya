import 'fake-indexeddb/auto';

/**
 * Vitest test setup — runs once before any test file loads.
 *
 * Patches jsdom shortcomings that two of our deps rely on:
 *
 * 1. `Element.prototype.getBoundingClientRect`
 *    jsdom returns zero dimensions for everything, which causes
 *    react-chessboard to throw "Square width not found" during a passive
 *    layout-effect (it measures squares to size the board). Stub the method
 *    to return plausible 480x480 values so the library is happy.
 *
 * 2. `HTMLAudioElement.play`
 *    jsdom rejects with NotAllowedError, which our sound module already
 *    catches — but mocking it here keeps the test logs quieter.
 *
 * 3. `canvas-confetti` import
 *    The confetti animation calls `clearRect` on a null 2D context in jsdom.
 *    Individual test files that render `DrillView` should mock the module
 *    via `vi.mock('canvas-confetti', ...)` (see drill-view.test.tsx).
 */

const FAKE_RECT: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 480,
  bottom: 480,
  width: 480,
  height: 480,
  toJSON: () => ({}),
};

if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function (): DOMRect {
    return FAKE_RECT;
  };
}

// Direct prototype override (not vi.spyOn) so the patch is in place before
// any module that constructs an Audio() runs. jsdom's default play() returns
// undefined and prints a warning; here we make it return a resolved Promise.
if (typeof window !== 'undefined' && window.HTMLMediaElement) {
  window.HTMLMediaElement.prototype.play = function (): Promise<void> {
    return Promise.resolve();
  };
  window.HTMLMediaElement.prototype.pause = function (): void {
    /* no-op */
  };
}
