let currentEffect = null;
let componentStack = [];
let parent = null;

export function setParent(el) {
  parent = el;
}
export function getParent() {
  return parent;
}

export function setCurrentEffect(effect) {
  currentEffect = effect;
}

export function addComponent(component) {
  componentStack.push(component);
}
export function getLastComponent() {
  return componentStack[componentStack.length - 1];
}
export function removeLastComponent(){
  componentStack.pop()
}

export { currentEffect, componentStack };
