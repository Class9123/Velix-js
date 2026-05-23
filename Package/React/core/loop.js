import { useEffect } from "../index.js";
import { createInstance, destroy, resetInstance } from "./component.js";
import {
  getLastComponent,
  removeLastComponent,
  addComponent
} from "../globals.js";

function createCmpIns() {
  const instance = createInstance();

  const parent = getLastComponent();

  if (parent) {
    parent.childComponent.add(instance);
  }

  return instance;
}

function mount(createChildren, clone, item, before) {
  const root = clone.cloneNode(true).content.f;

  createChildren(root, item);

  before.before(root);

  return root;
}

function createRecord(createChildren, clone, item, anchor) {
  const instance = createCmpIns();

  addComponent(instance);

  const root = mount(createChildren, clone, item, anchor);

  removeLastComponent();

  return {
    instance,
    root
  };
}

export default function _setUpLoop(tpl, createChildren, source) {
  const clone = tpl.cloneNode(true);

  const map = [];

  const anchor = document.createComment("for-end");

  tpl.replaceWith(anchor);

  const instance = createCmpIns();

  useEffect((config = null) => {
    const data = source();

    addComponent(instance);

    const index = config?.index;

    if (!config || typeof config !== "object") {
      map.forEach(record => {
        record.root.remove();
        destroy(record.instance);
      });

      map.length = 0;

      data.forEach(item => {
        map.push(
          createRecord(createChildren, clone, item, anchor)
        );
      });
    } else if (config.push) {
      map.push(
        createRecord(createChildren, clone, data[index], anchor)
      );
    } else if (config.setAt) {
      const old = map[index];

      if (old) {
        addComponent(old.instance);

        const root = mount(
          createChildren,
          clone,
          data[index],
          old.root
        );

        removeLastComponent();

        old.root.remove();
        destroy(old.instance)
        resetInstance(old.instance);

        map[index] = {
          instance: old.instance,
          root
        };
      }
    } else if (config.remove) {
      const old = map[index];

      if (old) {
        old.root.remove();
        
        instance.childComponent.delete(old.instance)
        destroy(old.instance);

        map.splice(index, 1);
      }
    } else if (config.setNew) {
      map.forEach(record => {
        record.root.remove();
        destroy(record.instance);
      });

      map.length = 0;

      data.forEach(item => {
        map.push(
          createRecord(createChildren, clone, item, anchor)
        );
      });
    }

    removeLastComponent();
  });

  return anchor;
}