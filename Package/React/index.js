Object.defineProperties(Node.prototype, {
  f: {
    get() {
      return this.firstChild;
    }
  },
  n: {
    get() {
      return this.nextSibling;
    }
  },
  p: {
    get() {
      return this.previousSibling;
    }
  }
});
import { useState, useArray } from "./core/state.js";
import useEffect from "./core/effect.js";
import useMemo from "./core/memo.js";
import _$ from "../internal.js";

export function logT(){
  if (t) return console.log(makeSetArr(t))
  console.log(t)
}
let t = null
function makeSetArr(instance) {
  const obj = { childComponent: [] };
  Array.from(instance.childComponent).forEach(child => {
    obj.childComponent.push(makeSetArr(child));
  });
  obj.onMount = Array.from(instance.onMount);
  obj.onDestroy = Array.from(instance.onDestroy);
  obj.effects = Array.from(instance.effects);

  return obj;
}

function mount(App, root) {
  const tf = _$.mountCmp(App, root.firstElementChild);
  t = tf
  root.style.display = "";
}

export { useState, useEffect, useMemo, useArray, mount };
export { onMount, onDestroy } from "./core/component.js";
