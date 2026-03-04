import {
  setCurrentEffect
} from "../globals.js";

// simple implementation of the useEffect function that supports , batching the effects and running them

function useEffect (callback, dependices=[]) {
  const effect = {
    fn: callback,
    cleanup : null
  };
  setCurrentEffect(effect);
  effect.cleanup = callback();
  dependices.forEach(getter => {
    if (typeof getter ==="function") getter()
    else throw new Error('Depedency of useEffect should be states only');
  });
  setCurrentEffect(null);
}

export default useEffect;