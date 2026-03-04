const globalEffectQueue = new Set();
let isScheduled = false;

export function queueEffect(effects) {
  for (const fn of effects) globalEffectQueue.add(fn);
  if (!isScheduled) {
    isScheduled = true;
    queueMicrotask(flushEffectQueue);
  }
}

function flushEffectQueue() {
  isScheduled = false;

  const effects = Array.from(globalEffectQueue);
  globalEffectQueue.clear();
  for (let i = 0; i < effects.length; i++) {
    try {
      const effect = effects[i];
      if (typeof effect.cleanup == "function") effect.cleanup();
      effect.cleanup = effect.fn();
    } catch (err) {
      console.error("Effect error:", err);
    }
  }
}
