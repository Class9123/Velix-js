import { setCurrentEffect, currentEffect } from "../globals.js";

import { queueEffect } from "./dom.js";

export default function useMemo(fn) {
  const effects = new Set();
  let cachedValue;
  let dirty = false;
  const trackingEffect = {
    fn: null,
    cleanup: null,
    cleanSelf: null
  };

  setCurrentEffect(trackingEffect);
  cachedValue = fn();
  setCurrentEffect(null);

  const compute = () => {
    dirty = false;
    cachedValue = fn();
  };

  trackingEffect.fn = () => {
    if (!dirty) {
      dirty = true;
      queueEffect(effects);
    }
  };

  // The memo getter
  function memo() {
    if (currentEffect) {
      const effect = currentEffect;
      effects.add(effect);
      currentEffect.cleanSelf = () => {
        effects.delete(effect);
      };
    }

    if (dirty) {
      compute();
    }

    return cachedValue;
  }

  return memo;
}
