/**
 * EventsBus — in-memory pub/sub for "new event appended" notifications.
 *
 * Hooks subscribe; the EventsRepository (via `wrapWithBusNotify`) publishes
 * after `append` and `clearAll`. Publishes coalesce via `requestAnimationFrame`
 * so a burst of appends during a fast drill (one event every 250 ms) collapses
 * to one subscriber callback per frame instead of one per write.
 *
 * Pure JS state — no IDB, no network, no React.
 */

export type Unsubscribe = () => void;

export interface EventsBus {
  subscribe(fn: () => void): Unsubscribe;
  publish(): void;
}

export function createEventsBus(): EventsBus {
  const subscribers = new Set<() => void>();
  let pending = false;

  const flush = (): void => {
    pending = false;
    // Snapshot to allow subscribers to (un)subscribe inside their callback
    // without invalidating the iteration.
    for (const fn of Array.from(subscribers)) {
      try {
        fn();
      } catch (err) {
        // A misbehaving subscriber must not poison the bus.
        console.error('EventsBus subscriber threw:', err);
      }
    }
  };

  return {
    subscribe(fn: () => void): Unsubscribe {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    publish(): void {
      if (pending) return;
      pending = true;
      // rAF when available — otherwise fall back to microtask (tests, SSR).
      if (
        typeof globalThis !== 'undefined' &&
        typeof (globalThis as { requestAnimationFrame?: (cb: () => void) => number })
          .requestAnimationFrame === 'function'
      ) {
        (
          globalThis as { requestAnimationFrame: (cb: () => void) => number }
        ).requestAnimationFrame(flush);
      } else {
        queueMicrotask(flush);
      }
    },
  };
}
