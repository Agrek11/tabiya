/**
 * AsyncSerialQueue — one-at-a-time async job runner (design §5 scheduling).
 *
 * OOB detection is CPU-bound; running detections serially keeps the sync
 * progress UI responsive without worker plumbing. Errors in one job are
 * isolated — the chain continues.
 */

export class AsyncSerialQueue {
  private tail: Promise<void> = Promise.resolve();

  enqueue(job: () => Promise<void>): Promise<void> {
    const next = this.tail.then(job).catch((err) => {
      console.warn('[lichess] queued job failed:', err);
    });
    this.tail = next;
    return next;
  }

  /** Resolves when every job enqueued so far has settled. */
  drain(): Promise<void> {
    return this.tail;
  }
}
