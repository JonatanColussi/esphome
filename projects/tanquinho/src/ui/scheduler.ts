/** Batches bursts of state events into one render per animation frame. */
export function createFrameScheduler(
  task: () => void,
  requestFrame: (callback: FrameRequestCallback) => number = callback =>
    window.requestAnimationFrame(callback),
): () => void {
  let scheduled = false;

  return () => {
    if (scheduled) {
      return;
    }

    scheduled = true;
    requestFrame(() => {
      scheduled = false;
      task();
    });
  };
}
