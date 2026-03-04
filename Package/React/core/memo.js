import {
  setCurrentEffect,
  currentEffect
} from "../globals.js";

import {
  queueEffect
} from "./dom.js";

export default function useMemo(fn) {
  let cachedValue;
  let dirty = true;

  // Effects that depend on this memo
  const subscribers = new Set();

  // Recompute value (lazy)
  const compute = () => {
    dirty = false;

    // Track dependencies of this memo
    const trackingEffect = {
      fn: invalidate,
      cleanup: null
    };

    setCurrentEffect(trackingEffect);
    cachedValue = fn();
    setCurrentEffect(null);
  };

  // Called when a dependency of memo changes
  const invalidate = () => {
    if (!dirty) {
      dirty = true;

      // Notify subscribers (effects using this memo)
      queueEffect(subscribers);
    }
  };

  // The memo getter
  function memo() {
    // If inside an effect, register it
    if (currentEffect) {
      subscribers.add(currentEffect);
    }

    // Lazy recompute
    if (dirty) {
      compute();
    }

    return cachedValue;
  }

  return memo;
}