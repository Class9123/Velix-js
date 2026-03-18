import {
  addComponent,
  getLastComponent,
  removeLastComponent
} from "../globals.js";
import { queueEffect } from "./dom.js";
import _$ from "../../internal.js";

export function createInstance() {
  return {
    effects: new Set(),
    onMount: new Set(),
    onDestroy: new Set(),
    childComponent: new Set()
  };
}

export default function instanceComponent(component, parent) {
  const instance = createInstance();
  _$.setParent(parent);
  const parentInstance = getLastComponent();
  if (parentInstance) {
    parentInstance.childComponent.add(instance);
  }
  addComponent(instance);
  component();
  queueEffect(instance.onMount);
  removeLastComponent();
  return instance;
}

export function destroy(instance) {
  for (const childInstance of instance.childComponent) {
    destroy(childInstance);
  }

  for (const effect of instance.effects) {
    const fn = effect.cleanSelf;
    if (typeof fn === "function") fn();
  }
  queueEffect(instance.onDestroy);
}

export function onMount(fn) {
  const effect = {
    fn: fn,
    cleanup: null
  };
  const ins = getLastComponent();
  if (ins) ins.onMount.add(effect);
  else console.warn("getLastComponent is invalid");
}

export function onDestroy(fn) {
  const effect = {
    fn: fn,
    cleanup: null
  };
  const ins = getLastComponent();
  if (ins) ins.onDestroy.add(effect);
  else console.warn("getLastComponent is invalid");
}

export function resetInstance(instance) {
  instance.effects = new Set();
  instance.onMount = new Set();
  instance.onDestroy = new Set();
  instance.childComponent = new Set();
}
