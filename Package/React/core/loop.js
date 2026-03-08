import { useEffect } from "../index.js";
// hlepers
function readSource(source) {
  const src = source ?? [];
  return Array.isArray(src) ? src : [];
}

function clear(record) {
  if (!record) return;
  let node = record.first;
  while (node) {
    const next = node.nextSibling;
    node.remove();
    if (node === record.last) break;
    node = next;
  }
}

function mount(createChildren, clone, item, before) {
  const root = clone.cloneNode(true).content;
  createChildren(root, item);
  let first = root.firstChild;
  let last = root.lastChild;
  if (!first) {
    first = document.createComment("for-empty");
    last = first;
    root.appendChild(first);
  }
  before.before(root);
  return { first: first, last: last };
}

export default function _setUpLoop(tpl, createChildren, source) {
  console.log(createChildren)
  const clone = tpl.cloneNode(true);
  const map = [];
  const anchor = document.createComment("for-end");
  tpl.replaceWith(anchor);

  useEffect((config = null) => {
    const data = source();
    if (!config || typeof config !== "object") {
      map.forEach(clear);
      map.length = 0;
      data.forEach(local => {
        map.push(mount(createChildren, clone, local, anchor));
      });
      return;
    }
    const index = config.index;
    if (config.push) {
      map.push(mount(createChildren, clone, data[index], anchor));
    } else if (config.setAt) {
      const old = map[index];
      if (!old) return;
      const nextNode = old.first;
      map[index] = mount(createChildren, clone, data[index], nextNode);
      clear(old);
    } else if (config.remove) {
      const old = map[index];
      if (!old) return;
      clear(old);
      map.splice(index, 1);
    } else {
      map.forEach(clear);
      map.length = 0;
      data.forEach(local => {
        map.push(mount(createChildren, clone, local, anchor));
      });
    }
  });
}
