export function createPoller(fn, intervalMs) {
  let id = null;

  function start() {
    if (id !== null) return;
    id = setInterval(fn, intervalMs);
  }

  function stop() {
    if (id === null) return;
    clearInterval(id);
    id = null;
  }

  return { start, stop };
}
