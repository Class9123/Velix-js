import { currentEffect } from "../globals.js";
import { queueEffect } from "./dom.js";

export function useState(initialValue) {
  let value = initialValue;
  const effects = new Set();
  const getter = () => {
    if (currentEffect) {
      effects.add(currentEffect);
    }
    return value;
  };

  const setter = newValue => {
    const resolved =
      typeof newValue === "function" ? newValue(value) : newValue;
    if (resolved === value) return;
    value = resolved;
    queueEffect(effects);
  };

  return [getter, setter];
}

export function useArray(initialValue = []) {
  const array = Array.isArray(initialValue) ? [...initialValue] : [];
  const effects = new Set();
  const trigger = config => {
    const newEffects = [];
    for (const obj of effects) {
      newEffects.push({
        fn: () => obj.fn(config),
        cleanup: obj.cleanup
      });
    }
    queueEffect(newEffects);
  };
  const getter = () => {
    if (currentEffect) {
      effects.add(currentEffect);
    }
    return array;
  };

  getter.push = item => {
    array.push(item);
    trigger({
      push: true,
      index: array.length - 1
    });
  };

  getter.setAt = (index, item) => {
    if (index < 0 || index >= array.length) return;
    array[index] = item;
    trigger({
      setAt: true,
      index
    });
  };

  getter.remove = index => {
    if (index < 0 || index >= array.length) return;
    array.splice(index, 1);
    trigger({
      remove: true,
      index
    });
  };

  getter.pop = () => {
    if (!array.length) return;
    getter.remove(array.length - 1);
  };

  getter.setNew = next => {
    const resolved = typeof next === "function" ? next([...array]) : next;
    if (!Array.isArray(resolved)) {
      throw new Error("useArray.setNew expects an array or updater function.");
    }
    array.length = 0;
    for (let i = 0; i < resolved.length; i++) array.push(resolved[i]);
    trigger({
      setNew: true
    });
  };

  return getter;
}
