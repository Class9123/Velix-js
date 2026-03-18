import useEffect from "./effect.js";
import { createInstance, destroy, resetInstance } from "./component.js";
import {
  getLastComponent,
  removeLastComponent,
  addComponent
} from "../globals.js";

export default function _setUpConditional(tmp, conditionExpr, createChildren) {
  const clone = tmp.cloneNode(true);
  const comment = document.createComment("con");
  tmp.replaceWith(comment);

  let prevConId = null;
  let mountedEl = null;
  let instance = createInstance();
  const parentInstance = getLastComponent();
  if (parentInstance) {
    parentInstance.childComponent.add(instance);
  }

  useEffect(() => {
    const con = !!conditionExpr();
    if (prevConId === con) return;
    if (con) {
      addComponent(instance);
      const root = clone.cloneNode(true).content.f;
      createChildren(root);
      comment.replaceWith(root);
      removeLastComponent();
      mountedEl = root;
    } else {
      if (!comment.isConnected) {
        if (mountedEl) {
          mountedEl.replaceWith(comment);

          destroy(instance);
          resetInstance(instance);

          mountedEl = null;
        }
      }
    }

    prevConId = con;
  });
}
