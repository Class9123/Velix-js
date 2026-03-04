import { useState, useArray } from "./core/state.js";
import useEffect from "./core/effect.js";
import useMemo from "./core/memo.js";
import _$ from "../internal.js"

function mount(App, root) {
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
  _$.setParent(root.firstElementChild);
  App();
  root.style.display = "";
}

export { useState, useEffect, useMemo, useArray, mount };
