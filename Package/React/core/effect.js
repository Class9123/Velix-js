import { setCurrentEffect, getLastComponent } from "../globals.js";

// simple implementation of the useEffect function that supports , batching the effects and running them

function useEffect(callback, dependices = []) {
  const effect = {
    fn: callback,
    cleanup: null,
    cleanSelf: null // expected to be set as function by state.js
  };
  setCurrentEffect(effect);
  const pr = getLastComponent()
  if (pr) getLastComponent().effects.add(effect)
  else console.warn("Don't use useEffect outside a function ")
  effect.cleanup = callback();
  dependices.forEach(getter => {
    if (typeof getter === "function") getter();
    else throw new Error("Depedency of useEffect should be states only");
  });
  setCurrentEffect(null);
}

export default useEffect;
